import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import { apiSuccess, apiError } from "@/lib/utils";
import { hasPermission } from "@/lib/auth/audit";
import { QueueService } from "@/services/queue.service";

/** Preview next queue number for doctor + date (staff booking form). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);

  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "appointments", "view")) {
    return apiError("Forbidden", 403);
  }

  const doctor = req.nextUrl.searchParams.get("doctor") || "";
  const date = req.nextUrl.searchParams.get("date") || "";

  if (!doctor || !date) {
    return apiError("doctor and date are required", 422);
  }

  const nextNumber = await QueueService.peekNextQueueNumber(doctor, date);
  return apiSuccess({ nextNumber, doctor, date }, "Next queue number");
}
