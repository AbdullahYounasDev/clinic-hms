import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Appointment } from "@/models/clinical.model";
import { apiSuccess, apiError, getPaginationParams, buildPagination, getIpFromHeaders, startOfDay, endOfDay, applyAppointmentStatusFilter, isArchivedStatus } from "@/lib/utils";
import { createAppointmentSchema } from "@/lib/validations";
import { auditLog, hasPermission } from "@/lib/auth/audit";
import { NotificationService } from "@/services/notification.service";
import { QueueService } from "@/services/queue.service";

import { getClinicTimezone, getClinicDateString, getClinicDayBounds } from "@/lib/time-utils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "appointments", "view")) {
    return apiError("Forbidden", 403);
  }

  await connectDB();

  const sp = req.nextUrl.searchParams;
  const { page, limit, skip } = getPaginationParams(sp);
  const filter: Record<string, unknown> = {};

  // Doctor scope: only show their own appointments
  if (!session.user.isSuperAdmin) {
    const { Doctor } = await import("@/models/clinical.model");
    const doctor = await Doctor.findOne({ user: session.user.id }).lean();
    if (doctor) {
      filter.doctor = doctor._id;
    }
  }

  // Admin can filter by specific doctor
  if (session.user.isSuperAdmin) {
    const doctorId = sp.get("doctor") || "";
    if (doctorId) filter.doctor = doctorId;
  }

  const status = sp.get("status") || "";
  const date = sp.get("date") || "";
  const patientId = sp.get("patient") || "";
  const today = sp.get("today") === "true";
  const search = sp.get("search") || "";

  applyAppointmentStatusFilter(filter, status || null);
  if (patientId) filter.patient = patientId;

  const clinicTz = await getClinicTimezone();

  if (today) {
    const todayStr = getClinicDateString(new Date(), clinicTz);
    const { start, end } = getClinicDayBounds(todayStr, clinicTz);
    filter.scheduledDate = { $gte: start, $lte: end };
  } else if (date) {
    const { start, end } = getClinicDayBounds(date, clinicTz);
    filter.scheduledDate = { $gte: start, $lte: end };
  }

  // Search by patient name, doctor name, or appointment ID
  if (search) {
    const { Patient } = await import("@/models/clinical.model");
    const patientIds = await Patient.find({
      status: "active",
      $or: [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { patientId: { $regex: search, $options: "i" } },
      ],
    }).distinct("_id");

    const { User } = await import("@/models/user.model");
    const userIds = await User.find({
      $or: [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
      ],
    }).distinct("_id");

    const { Doctor } = await import("@/models/clinical.model");
    const doctorIds = await Doctor.find({ user: { $in: userIds }, status: { $ne: "archived" } }).distinct("_id");

    filter.$or = [
      { patient: { $in: patientIds } },
      { doctor: { $in: doctorIds } },
      { appointmentId: { $regex: search, $options: "i" } },
    ];
  }

  const [appointments, total] = await Promise.all([
    Appointment.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ scheduledDate: 1, scheduledTime: 1 })
      .populate("patient", "firstName lastName patientId phone")
      .populate({ path: "doctor", populate: { path: "user", select: "firstName lastName" }, select: "consultationFee specialization" })
      .populate("department", "name code")
      .lean(),
    Appointment.countDocuments(filter),
  ]);

  return apiSuccess(appointments, "Appointments fetched", 200, buildPagination(total, page, limit));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "appointments", "create")) {
    return apiError("Forbidden", 403);
  }

  const body = await req.json();
  const parsed = createAppointmentSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);

  await connectDB();

  // Import Patient model
  const { Patient } = await import("@/models/clinical.model");

  // Check patient status
  const patient = await Patient.findById(parsed.data.patient).lean();
  if (!patient) return apiError("Patient not found", 404);

  if (patient.status === "deceased") {
    return apiError("Cannot create appointment for deceased patient", 403);
  }

  if (patient.status === "archived") {
    return apiError("Cannot create appointment for archived patient", 403);
  }

  // Check doctor default duration vs custom requested duration permission
  const { Doctor } = await import("@/models/clinical.model");
  const doctorDoc = await Doctor.findById(parsed.data.doctor).lean();
  if (!doctorDoc) return apiError("Doctor not found", 404);

  const defaultDuration = doctorDoc.appointmentDuration || 30;
  if (parsed.data.duration && parsed.data.duration !== defaultDuration) {
    const canOverride = session.user.isSuperAdmin || hasPermission(session.user.permissions, session.user.isSuperAdmin, "appointments", "create") || hasPermission(session.user.permissions, session.user.isSuperAdmin, "appointments", "override_duration");
    if (!canOverride) {
      return apiError("You do not have permission to override the doctor's default appointment duration", 403);
    }
  }

  // Validate appointment scheduling rules (clinic hours, doctor schedule, breaks, leave, availability)
  const { SchedulingService } = await import("@/services/scheduling.service");
  const validation = await SchedulingService.validateAppointmentBooking(parsed.data);
  if (!validation.valid) {
    return apiError(validation.error || "Selected slot is unavailable", 409);
  }

  const { toClinicNoonDate } = await import("@/lib/time-utils");
  const scheduledDate = toClinicNoonDate(parsed.data.scheduledDate);

  let appointment;
  try {
    appointment = await Appointment.create({
      ...parsed.data,
      scheduledDate,
      createdBy: session.user.id,
    });
  } catch (err: unknown) {
    const mongoErr = err as { code?: number };
    if (mongoErr.code === 11000) {
      return apiError("This time slot has just been booked by another user. Please select another slot.", 409);
    }
    throw err;
  }

  const isEmergency = parsed.data.type === "emergency";
  const queueToken = await QueueService.assignQueueToken(
    appointment._id.toString(),
    parsed.data.doctor,
    parsed.data.scheduledDate,
    isEmergency
  );

  const populated = await Appointment.findById(appointment._id)
    .populate("patient", "firstName lastName patientId")
    .populate({ path: "doctor", populate: { path: "user", select: "firstName lastName" } })
    .lean();

  await auditLog({
    userId: session.user.id,
    action: "create",
    module: "appointments",
    description: `Created appointment ${appointment.appointmentId} — Queue #${queueToken}`,
    resourceId: appointment._id.toString(),
    resourceType: "Appointment",
    ipAddress: getIpFromHeaders(req.headers),
  });

  const doctorData = populated?.doctor as Record<string, unknown> | null | undefined;
  const doctorUser = doctorData?.user as Record<string, unknown> | null | undefined;
  if (doctorUser?._id) {
    const patientData = populated?.patient as Record<string, unknown> | null | undefined;
    const formattedDate = populated?.scheduledDate ? new Date(populated.scheduledDate).toLocaleDateString() : "";
    await NotificationService.create({
      userId: String(doctorUser._id),
      type: "appointment_reminder",
      title: "New Appointment",
      message: `${patientData?.firstName || ""} ${patientData?.lastName || ""} has an appointment on ${formattedDate} at ${populated?.scheduledTime}`,
      priority: "medium",
      actionUrl: `/appointments/${appointment._id}`,
      metadata: { appointmentId: appointment._id.toString() },
    });
  }
  return apiSuccess(populated, "Appointment created successfully", 201);
}
