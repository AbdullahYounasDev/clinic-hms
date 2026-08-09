import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Appointment } from "@/models/clinical.model";
import { apiSuccess, apiError, getIpFromHeaders, isArchivedStatus } from "@/lib/utils";
import { updateAppointmentSchema } from "@/lib/validations";
import { auditLog, hasPermission } from "@/lib/auth/audit";
import { QueueService, hasQueueToken } from "@/services/queue.service";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  await connectDB();
  const { id } = await params;
  const apt = await Appointment.findById(id)
    .populate("patient")
    .populate({ path: "doctor", populate: { path: "user", select: "firstName lastName" } })
    .populate("department")
    .lean();
  if (!apt) return apiError("Appointment not found", 404);
  if (isArchivedStatus(apt.status)) return apiError("Appointment not found", 404);
  return apiSuccess(apt);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "appointments", "update")) return apiError("Forbidden", 403);
  const body = await req.json();
  const parsed = updateAppointmentSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);
  await connectDB();
  const { id } = await params;
  const existing = await Appointment.findById(id).lean();
  if (!existing) return apiError("Appointment not found", 404);
  if (isArchivedStatus(existing.status)) return apiError("Appointment not found", 404);

  const { toClinicDateString, toClinicNoonDate } = await import("@/lib/time-utils");

  const doctorId = ((body.doctor as string) || existing.doctor).toString();
  const scheduledDateInput = parsed.data.scheduledDate || toClinicDateString(existing.scheduledDate);
  const scheduledTimeInput = parsed.data.scheduledTime || existing.scheduledTime;
  const durationInput = parsed.data.duration || existing.duration || 30;
  const typeInput = (body.type as string) || existing.type;
  const targetStatus = parsed.data.status || existing.status;

  // Validate appointment scheduling rules (clinic hours, doctor schedule, breaks, leave, availability, slot overlap)
  if (!["cancelled", "no_show", "archived"].includes(targetStatus)) {
    const { SchedulingService } = await import("@/services/scheduling.service");
    const validation = await SchedulingService.validateAppointmentBooking({
      doctor: doctorId,
      scheduledDate: scheduledDateInput,
      scheduledTime: scheduledTimeInput,
      duration: durationInput,
      type: typeInput,
      excludeAppointmentId: id,
    });
    if (!validation.valid) {
      return apiError(validation.error || "Selected slot is unavailable", 409);
    }
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "checked_in") updateData.checkedInAt = new Date();
  if (parsed.data.status === "completed") updateData.completedAt = new Date();
  if (parsed.data.scheduledDate) {
    updateData.scheduledDate = toClinicNoonDate(parsed.data.scheduledDate);
  }

  await Appointment.findByIdAndUpdate(id, updateData);

  const isEmergency = typeInput === "emergency";

  const doctorOrDateChanged =
    (body.doctor && body.doctor.toString() !== existing.doctor.toString()) ||
    (parsed.data.scheduledDate &&
      parsed.data.scheduledDate !== (existing.scheduledDate instanceof Date ? existing.scheduledDate.toISOString().slice(0, 10) : String(existing.scheduledDate)));

  const needsToken =
    !hasQueueToken(existing.queueNumber) || doctorOrDateChanged || (isEmergency && existing.queueNumber !== 0);

  let queueNote = "";
  if (needsToken && !["cancelled", "no_show", "archived"].includes(parsed.data.status || existing.status)) {
    const token = await QueueService.assignQueueToken(id, doctorId, scheduledDateInput, isEmergency);
    queueNote = ` — Queue #${token}`;
  }

  const apt = await Appointment.findById(id)
    .populate("patient", "firstName lastName patientId phone")
    .populate({ path: "doctor", populate: { path: "user", select: "firstName lastName" } })
    .lean();

  const statusMsg = parsed.data.status
    ? `Updated appointment status to ${parsed.data.status}${queueNote}`
    : `Updated appointment${queueNote}`;

  await auditLog({
    userId: session.user.id,
    action: "update",
    module: "appointments",
    description: statusMsg,
    resourceId: id,
    ipAddress: getIpFromHeaders(req.headers),
  });

  return apiSuccess(apt, statusMsg);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "appointments", "delete")) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const { id } = await params;

  const existing = await Appointment.findById(id).lean();
  if (!existing) return apiError("Appointment not found", 404);
  if (isArchivedStatus(existing.status)) return apiError("Appointment not found", 404);

  await Appointment.findByIdAndUpdate(id, { status: "archived" });

  await auditLog({
    userId: session.user.id,
    action: "delete",
    module: "appointments",
    description: `Archived appointment ${existing.appointmentId}`,
    resourceId: id,
    resourceType: "Appointment",
    ipAddress: getIpFromHeaders(req.headers),
  });

  return apiSuccess(null, "Appointment deleted successfully");
}
