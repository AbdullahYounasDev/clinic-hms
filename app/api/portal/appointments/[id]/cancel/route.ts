import { NextRequest } from "next/server";
import { requirePatientSession } from "@/lib/auth/require-portal";
import connectDB from "@/lib/db/mongoose";
import { Appointment } from "@/models/clinical.model";
import { apiSuccess, apiError, getIpFromHeaders } from "@/lib/utils";
import { auditLog } from "@/lib/auth/audit";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await requirePatientSession();
  if (authResult.error) return authResult.error;

  return apiError("Online appointment cancellation is currently disabled. Please contact clinic reception.", 403);
  if (!id) return apiError("Appointment ID is required", 400);

  const body = await req.json().catch(() => ({}));
  const cancellationReason = body.cancellationReason || "Cancelled by patient via portal";

  await connectDB();

  const appointment = await Appointment.findById(id);
  if (!appointment) return apiError("Appointment not found", 404);

  // Enforce patient ownership on the server
  if (appointment.patient.toString() !== authResult.patientId) {
    return apiError("You can only cancel your own appointments", 403);
  }

  // Prevent cancellation of non-eligible statuses
  const nonEligibleStatuses = ["completed", "cancelled", "no_show", "archived", "in_consultation"];
  if (nonEligibleStatuses.includes(appointment.status)) {
    return apiError(`This appointment cannot be cancelled because it is already ${appointment.status.replace(/_/g, " ")}.`, 400);
  }

  // Enforce 2-hour cancellation deadline prior to scheduled time
  const { getClinicTimezone } = await import("@/lib/time-utils");
  const clinicTz = await getClinicTimezone();
  const scheduledDateStr = appointment.scheduledDate ? appointment.scheduledDate.toISOString().slice(0, 10) : "";
  
  if (scheduledDateStr && appointment.scheduledTime) {
    const [y, m, d] = scheduledDateStr.split("-").map(Number);
    const timeParts = appointment.scheduledTime.match(/^(\d{1,2}):(\d{2})/);
    if (timeParts) {
      const hours = Number(timeParts[1]);
      const minutes = Number(timeParts[2]);
      const apptDateTime = new Date(y, m - 1, d, hours, minutes);
      const twoHoursMs = 2 * 60 * 60 * 1000;
      if (apptDateTime.getTime() - Date.now() < twoHoursMs) {
        return apiError("Appointments cannot be cancelled within 2 hours of the scheduled time. Please call the clinic directly.", 400);
      }
    }
  }

  appointment.status = "cancelled";
  appointment.cancellationReason = cancellationReason;
  await appointment.save();

  await auditLog({
    userId: authResult.session.user.id,
    action: "update",
    module: "portal_appointments",
    description: `Patient cancelled appointment ${appointment.appointmentId}`,
    resourceId: appointment._id.toString(),
    resourceType: "Appointment",
    ipAddress: getIpFromHeaders(req.headers),
  });

  return apiSuccess(appointment, "Appointment cancelled successfully");
}
