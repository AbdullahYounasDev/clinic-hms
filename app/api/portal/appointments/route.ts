import { NextRequest } from "next/server";
import { requirePatientSession } from "@/lib/auth/require-portal";
import connectDB from "@/lib/db/mongoose";
import { Appointment, Doctor, Patient } from "@/models/clinical.model";
import { apiSuccess, apiError, getPaginationParams, buildPagination, applyAppointmentStatusFilter, getIpFromHeaders, formatDate } from "@/lib/utils";
import { SchedulingService } from "@/services/scheduling.service";
import { QueueService } from "@/services/queue.service";
import { NotificationService } from "@/services/notification.service";
import { auditLog } from "@/lib/auth/audit";

export async function GET(req: NextRequest) {
  const authResult = await requirePatientSession();
  if (authResult.error) return authResult.error;

  await connectDB();
  const sp = req.nextUrl.searchParams;
  const { page, limit, skip } = getPaginationParams(sp);

  const filter: Record<string, unknown> = { patient: authResult.patientId };
  applyAppointmentStatusFilter(filter, "");

  const [appointments, total] = await Promise.all([
    Appointment.find(filter)
      .populate({ path: "doctor", populate: { path: "user", select: "firstName lastName" }, select: "doctorId specialization consultationFee" })
      .populate("department", "name code")
      .sort({ scheduledDate: -1, scheduledTime: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Appointment.countDocuments(filter),
  ]);

  return apiSuccess(appointments, "Appointments fetched", 200, buildPagination(total, page, limit));
}

export async function POST(req: NextRequest) {
  const authResult = await requirePatientSession();
  if (authResult.error) return authResult.error;

  const body = await req.json();
  const { doctor: doctorId, scheduledDate, scheduledTime, type = "opd", chiefComplaint = "" } = body;

  if (!doctorId || typeof doctorId !== "string") return apiError("Doctor is required", 422);
  if (!scheduledDate || typeof scheduledDate !== "string") return apiError("Appointment date is required", 422);
  if (!scheduledTime || typeof scheduledTime !== "string") return apiError("Appointment time is required", 422);

  await connectDB();

  // Validate patient status
  const patient = await Patient.findById(authResult.patientId).lean();
  if (!patient) return apiError("Patient account not found", 404);
  if (patient.status === "deceased" || patient.status === "archived") {
    return apiError("Your patient account is inactive", 403);
  }

  // Validate doctor & retrieve default duration strictly
  const doctor = await Doctor.findById(doctorId).lean();
  if (!doctor || doctor.status === "archived" || !doctor.isAvailable) {
    return apiError("Selected doctor is currently unavailable", 404);
  }

  const duration = doctor.appointmentDuration || 30;
  const consultationFee = doctor.consultationFee || 0;

  // Validate scheduling rules (clinic hours, doctor schedule, breaks, leave, availability, slot overlap)
  const validation = await SchedulingService.validateAppointmentBooking({
    doctor: doctorId,
    scheduledDate,
    scheduledTime,
    duration,
    type,
  });

  if (!validation.valid) {
    return apiError(validation.error || "Selected time slot is unavailable", 409);
  }

  const { toClinicNoonDate } = await import("@/lib/time-utils");
  const targetDateObj = toClinicNoonDate(scheduledDate);

  let appointment;
  try {
    appointment = await Appointment.create({
      patient: authResult.patientId,
      doctor: doctorId,
      department: doctor.department || undefined,
      type,
      scheduledDate: targetDateObj,
      scheduledTime,
      duration,
      consultationFee,
      chiefComplaint,
      createdBy: authResult.session.user.id,
    });
  } catch (err: unknown) {
    const mongoErr = err as { code?: number };
    if (mongoErr.code === 11000) {
      return apiError("This time slot has just been booked by another patient. Please select another slot.", 409);
    }
    throw err;
  }

  const isEmergency = type === "emergency";
  const queueToken = await QueueService.assignQueueToken(
    appointment._id.toString(),
    doctorId,
    scheduledDate,
    isEmergency
  );

  const populated = await Appointment.findById(appointment._id)
    .populate("patient", "firstName lastName patientId")
    .populate({ path: "doctor", populate: { path: "user", select: "firstName lastName" } })
    .lean();

  await auditLog({
    userId: authResult.session.user.id,
    action: "create",
    module: "portal_appointments",
    description: `Patient booked appointment ${appointment.appointmentId} — Queue #${queueToken}`,
    resourceId: appointment._id.toString(),
    resourceType: "Appointment",
    ipAddress: getIpFromHeaders(req.headers),
  });

  // Notify Doctor
  const doctorData = populated?.doctor as Record<string, unknown> | null | undefined;
  const doctorUser = doctorData?.user as Record<string, unknown> | null | undefined;
  if (doctorUser?._id) {
    const patientData = populated?.patient as Record<string, unknown> | null | undefined;
    const formattedDate = populated?.scheduledDate ? formatDate(populated.scheduledDate) : "";
    await NotificationService.create({
      userId: String(doctorUser._id),
      type: "appointment_reminder",
      title: "New Patient Portal Booking",
      message: `${patientData?.firstName || ""} ${patientData?.lastName || ""} booked an appointment on ${formattedDate} at ${populated?.scheduledTime}`,
      priority: "medium",
      actionUrl: `/appointments/${appointment._id}`,
      metadata: { appointmentId: appointment._id.toString() },
    });
  }

  return apiSuccess(populated, "Appointment booked successfully", 201);
}
