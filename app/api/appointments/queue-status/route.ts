import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import { apiSuccess, apiError } from "@/lib/utils";
import { hasPermission } from "@/lib/auth/audit";
import { QueueService } from "@/services/queue.service";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);

  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "appointments", "view")) {
    return apiError("Forbidden", 403);
  }

  let doctorId = req.nextUrl.searchParams.get("doctor") || undefined;

  // Doctor scope: if user is a doctor, restrict queue status to their own doctor ID
  if (!session.user.isSuperAdmin) {
    const { Doctor } = await import("@/models/clinical.model");
    const doctor = await Doctor.findOne({ user: session.user.id }).lean();
    if (doctor) {
      doctorId = doctor._id.toString();
    }
  }

  const summaries = await QueueService.getDoctorQueueSummaries(doctorId);

  return apiSuccess(summaries, "Queue status fetched");
}
