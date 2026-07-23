import mongoose from "mongoose";
import connectDB from "@/lib/db/mongoose";
import { Appointment } from "@/models/clinical.model";
import { startOfDay } from "@/lib/utils";

// ─── TYPES ────────────────────────────────────────────────

export interface DoctorQueueSummary {
  doctorId: string;
  doctorObjectId: string;
  doctorName: string;
  specialization: string;
  nowServing: number;
  totalTokens: number;
  waiting: number;
  completed: number;
  currentPatient: { name: string; patientId: string } | null;
}

export interface PatientQueueStatus {
  hasActiveQueue: boolean;
  queueNumber: number | null;
  nowServing: number;
  patientsAhead: number;
  doctorName: string;
  status: string;
  appointmentId: string;
  appointmentObjectId: string;
  scheduledTime?: string;
}

const ACTIVE_QUEUE_STATUSES = ["scheduled", "checked_in", "in_consultation"];
const EXCLUDED_STATUSES = ["cancelled", "no_show", "archived"];

// ─── HELPERS ──────────────────────────────────────────────

/** Normalize any date / YYYY-MM-DD string to local start-of-day (queue day key). */
export function toQueueDate(input: Date | string): Date {
  if (!input) return startOfDay(new Date());

  let year: number;
  let month: number;
  let day: number;

  if (typeof input === "string") {
    const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      year = Number(match[1]);
      month = Number(match[2]) - 1;
      day = Number(match[3]);
    } else {
      const d = new Date(input);
      year = d.getFullYear();
      month = d.getMonth();
      day = d.getDate();
    }
  } else if (input instanceof Date) {
    if (input.getUTCHours() === 0 && input.getUTCMinutes() === 0 && input.getUTCSeconds() === 0) {
      year = input.getUTCFullYear();
      month = input.getUTCMonth();
      day = input.getUTCDate();
    } else {
      year = input.getFullYear();
      month = input.getMonth();
      day = input.getDate();
    }
  } else {
    const d = new Date(input);
    year = d.getFullYear();
    month = d.getMonth();
    day = d.getDate();
  }

  return startOfDay(new Date(year, month, day));
}

export function hasQueueToken(queueNumber: unknown): boolean {
  return queueNumber != null && queueNumber !== "";
}

// ─── SERVICE ──────────────────────────────────────────────

export class QueueService {
  /**
   * Preview the next queue number for a doctor on a given day (does not write).
   */
  static async peekNextQueueNumber(
    doctorId: string,
    date: Date | string,
    excludeAppointmentId?: string
  ): Promise<number> {
    await connectDB();
    const queueDate = toQueueDate(date);

    const filter: Record<string, unknown> = {
      doctor: doctorId,
      queueDate,
      queueNumber: { $gt: 0 },
      status: { $nin: EXCLUDED_STATUSES },
    };
    if (excludeAppointmentId) {
      filter._id = { $ne: excludeAppointmentId };
    }

    const last = await Appointment.findOne(filter)
      .sort({ queueNumber: -1 })
      .select("queueNumber")
      .lean();

    return (last?.queueNumber ?? 0) + 1;
  }

  /**
   * Assign (or re-assign) a queue token for doctor + day.
   * Called when an appointment is created as scheduled, or doctor/date changes.
   * Emergency appointments get queueNumber = 0 (priority).
   */
  static async assignQueueToken(
    appointmentId: string,
    doctorId: string,
    date: Date | string,
    isEmergency: boolean
  ): Promise<number> {
    await connectDB();
    const queueDate = toQueueDate(date);

    if (isEmergency) {
      await Appointment.findByIdAndUpdate(appointmentId, {
        queueNumber: 0,
        queueDate,
      });
      return 0;
    }

    const nextToken = await this.peekNextQueueNumber(doctorId, queueDate, appointmentId);

    await Appointment.findByIdAndUpdate(appointmentId, {
      queueNumber: nextToken,
      queueDate,
    });

    return nextToken;
  }

  /**
   * "Now serving" for a doctor on a day (defaults to today).
   * 1. If someone is in_consultation → their token
   * 2. Else highest completed token + 1 (next patient starts after completion)
   * 3. Else 1
   */
  static async getNowServing(doctorId: string, date?: Date | string): Promise<number> {
    await connectDB();
    const queueDate = toQueueDate(date ?? new Date());

    const inConsultation = await Appointment.findOne({
      doctor: doctorId,
      queueDate,
      status: "in_consultation",
      queueNumber: { $ne: null },
    })
      .select("queueNumber")
      .lean();

    if (inConsultation?.queueNumber != null) {
      return inConsultation.queueNumber;
    }

    const lastCompleted = await Appointment.findOne({
      doctor: doctorId,
      queueDate,
      status: "completed",
      queueNumber: { $gt: 0 },
    })
      .sort({ queueNumber: -1 })
      .select("queueNumber")
      .lean();

    if (lastCompleted?.queueNumber != null) {
      return lastCompleted.queueNumber + 1;
    }

    return 1;
  }

  /**
   * Queue summary for all doctors (or one) for today — staff dashboard / appointments.
   */
  static async getDoctorQueueSummaries(doctorId?: string): Promise<DoctorQueueSummary[]> {
    await connectDB();
    const today = toQueueDate(new Date());

    const matchFilter: Record<string, unknown> = {
      queueDate: today,
      queueNumber: { $ne: null },
      status: { $nin: EXCLUDED_STATUSES },
    };
    if (doctorId) {
      matchFilter.doctor = typeof doctorId === "string" && mongoose.Types.ObjectId.isValid(doctorId)
        ? new mongoose.Types.ObjectId(doctorId)
        : doctorId;
    }

    const pipeline = [
      { $match: matchFilter },
      {
        $group: {
          _id: "$doctor",
          totalTokens: { $sum: 1 },
          waiting: {
            $sum: {
              $cond: [
                { $in: ["$status", ["scheduled", "checked_in"]] },
                1,
                0,
              ],
            },
          },
          inConsultation: {
            $sum: { $cond: [{ $eq: ["$status", "in_consultation"] }, 1, 0] },
          },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          nowServingToken: {
            $max: {
              $cond: [
                { $eq: ["$status", "in_consultation"] },
                "$queueNumber",
                null,
              ],
            },
          },
          lastCompletedToken: {
            $max: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "completed"] },
                    { $gt: ["$queueNumber", 0] },
                  ],
                },
                "$queueNumber",
                null,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: "doctors",
          localField: "_id",
          foreignField: "_id",
          as: "doctorDoc",
        },
      },
      { $unwind: "$doctorDoc" },
      {
        $lookup: {
          from: "users",
          localField: "doctorDoc.user",
          foreignField: "_id",
          as: "userDoc",
        },
      },
      { $unwind: "$userDoc" },
    ];

    const results = (await Appointment.aggregate(pipeline)) as {
      _id: string;
      totalTokens: number;
      waiting: number;
      inConsultation: number;
      completed: number;
      nowServingToken: number | null;
      lastCompletedToken: number | null;
      doctorDoc: { doctorId: string; specialization: string };
      userDoc: { firstName: string; lastName: string };
    }[];

    const summaries: DoctorQueueSummary[] = [];

    for (const r of results) {
      const activeQueueCount = r.waiting + r.inConsultation;

      const nowServing =
        r.nowServingToken != null && r.nowServingToken > 0
          ? r.nowServingToken
          : r.waiting > 0
            ? r.lastCompletedToken != null && r.lastCompletedToken > 0
              ? r.lastCompletedToken + 1
              : 1
            : 0;

      // Only include doctors who have active waiting/in-consultation queue tokens for today
      if (activeQueueCount === 0) {
        continue;
      }

      let currentPatient: DoctorQueueSummary["currentPatient"] = null;
      if (r.inConsultation > 0) {
        const currentAppt = await Appointment.findOne({
          doctor: r._id,
          queueDate: today,
          status: "in_consultation",
          queueNumber: { $ne: null },
        })
          .populate("patient", "firstName lastName patientId")
          .select("patient")
          .lean();

        if (currentAppt?.patient) {
          const p = currentAppt.patient as unknown as {
            firstName: string;
            lastName: string;
            patientId: string;
          };
          currentPatient = {
            name: `${p.firstName} ${p.lastName}`,
            patientId: p.patientId,
          };
        }
      }

      summaries.push({
        doctorObjectId: r._id.toString(),
        doctorId: r.doctorDoc.doctorId,
        doctorName: `Dr. ${r.userDoc.firstName} ${r.userDoc.lastName}`,
        specialization: r.doctorDoc.specialization,
        nowServing,
        totalTokens: activeQueueCount,
        waiting: r.waiting,
        completed: r.completed,
        currentPatient,
      });
    }

    return summaries;
  }

  /**
   * Patient's live queue for today (scheduled / checked_in / in_consultation with a token).
   */
  static async getPatientQueuePosition(
    patientId: string
  ): Promise<PatientQueueStatus | null> {
    await connectDB();
    const today = toQueueDate(new Date());

    const appointment = await Appointment.findOne({
      patient: patientId,
      queueDate: today,
      queueNumber: { $ne: null },
      status: { $in: ACTIVE_QUEUE_STATUSES },
    })
      .populate({
        path: "doctor",
        populate: { path: "user", select: "firstName lastName" },
        select: "doctorId specialization",
      })
      .select("appointmentId queueNumber status doctor scheduledTime")
      .sort({ queueNumber: 1 })
      .lean();

    if (!appointment) return null;

    const doctor = appointment.doctor as unknown as {
      _id: string;
      user: { firstName: string; lastName: string };
    };

    const nowServing = await this.getNowServing(doctor._id.toString(), today);
    const queueNum = appointment.queueNumber ?? 0;
    const patientsAhead = Math.max(0, queueNum === 0 ? 0 : queueNum - nowServing);

    return {
      hasActiveQueue: true,
      queueNumber: queueNum,
      nowServing,
      patientsAhead,
      doctorName: `Dr. ${doctor.user.firstName} ${doctor.user.lastName}`,
      status: appointment.status,
      appointmentId: appointment.appointmentId,
      appointmentObjectId: appointment._id.toString(),
      scheduledTime: appointment.scheduledTime,
    };
  }
}
