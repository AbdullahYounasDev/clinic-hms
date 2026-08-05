import { NextRequest } from "next/server";
import { requirePatientSession } from "@/lib/auth/require-portal";
import connectDB from "@/lib/db/mongoose";
import { Appointment, Doctor } from "@/models/clinical.model";
import { apiSuccess, apiError, getIpFromHeaders } from "@/lib/utils";
import { SchedulingService } from "@/services/scheduling.service";
import { QueueService } from "@/services/queue.service";
import { auditLog } from "@/lib/auth/audit";
import { getClinicTimezone, getClinicDayBounds } from "@/lib/time-utils";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await requirePatientSession();
  if (authResult.error) return authResult.error;

  const { id } = await params;
  if (!id) return apiError("Appointment ID is required", 400);

  const body = await req.json().catch(() => ({}));
  const { doctor: doctorIdInput, scheduledDate, scheduledTime } = body;

  if (!scheduledDate || typeof scheduledDate !== "string") return apiError("Appointment date is required", 422);
  if (!scheduledTime || typeof scheduledTime !== "string") return apiError("Appointment time is required", 422);

  await connectDB();

  const appointment = await Appointment.findById(id);
  if (!appointment) return apiError("Appointment not found", 404);

  // Enforce patient ownership on server
  if (appointment.patient.toString() !== authResult.patientId) {
    return apiError("You can only reschedule your own appointments", 403);
  }

  // Prevent rescheduling non-eligible statuses
  const nonEligibleStatuses = ["completed", "cancelled", "no_show", "archived", "in_consultation"];
  if (nonEligibleStatuses.includes(appointment.status)) {
    return apiError(`This appointment cannot be rescheduled because it is already ${appointment.status.replace(/_/g, " ")}.`, 400);
  }

  const targetDoctorId = doctorIdInput || appointment.doctor.toString();

  // Validate doctor
  const doctorDoc = await Doctor.findById(targetDoctorId).lean();
  if (!doctorDoc || doctorDoc.status === "archived" || !doctorDoc.isAvailable) {
    return apiError("Selected doctor is currently unavailable", 404);
  }

  const duration = appointment.duration || doctorDoc.appointmentDuration || 30;

  // Validate scheduling rules (clinic hours, doctor schedule, breaks, leave, availability, slot overlap)
  const validation = await SchedulingService.validateAppointmentBooking({
    doctor: targetDoctorId,
    scheduledDate,
    scheduledTime,
    duration,
    type: appointment.type,
  });

  if (!validation.valid) {
    return apiError(validation.error || "Selected time slot is unavailable", 409);
  }

  const { toClinicNoonDate } = await import("@/lib/time-utils");
  const targetDateObj = toClinicNoonDate(scheduledDate);

  const doctorOrDateChanged =
    targetDoctorId !== appointment.doctor.toString() ||
    scheduledDate !== (appointment.scheduledDate ? appointment.scheduledDate.toISOString().slice(0, 10) : "");

  appointment.doctor = targetDoctorId as any;
  appointment.scheduledDate = targetDateObj;
  appointment.scheduledTime = scheduledTime;
  if (doctorDoc.department) appointment.department = doctorDoc.department as any;

  await appointment.save();

  if (doctorOrDateChanged) {
    const isEmergency = appointment.type === "emergency";
    await QueueService.assignQueueToken(appointment._id.toString(), targetDoctorId, scheduledDate, isEmergency);
  }

  await auditLog({
    userId: authResult.session.user.id,
    action: "update",
    module: "portal_appointments",
    description: `Patient rescheduled appointment ${appointment.appointmentId} to ${scheduledDate} at ${scheduledTime}`,
    resourceId: appointment._id.toString(),
    resourceType: "Appointment",
    ipAddress: getIpFromHeaders(req.headers),
  });

  const populated = await Appointment.findById(appointment._id)
    .populate({ path: "doctor", populate: { path: "user", select: "firstName lastName" }, select: "doctorId specialization consultationFee" })
    .populate("department", "name code")
    .lean();

  return apiSuccess(populated, "Appointment rescheduled successfully");
}
