import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import { apiSuccess, apiError } from "@/lib/utils";
import { SchedulingService } from "@/services/scheduling.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);

  const sp = req.nextUrl.searchParams;
  const doctor = sp.get("doctor");
  const date = sp.get("date");
  const durationStr = sp.get("duration");
  const requestedDuration = durationStr ? parseInt(durationStr, 10) : undefined;

  if (!doctor) return apiError("Doctor ID is required", 422);
  if (!date) return apiError("Date (YYYY-MM-DD) is required", 422);

  try {
    const slotResult = await SchedulingService.getAvailableSlots(doctor, date, requestedDuration);
    return apiSuccess(slotResult, "Available slots fetched");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to calculate available slots";
    return apiError(msg, 500);
  }
}
