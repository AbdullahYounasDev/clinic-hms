import { NextRequest } from "next/server";
import { requirePatientSession } from "@/lib/auth/require-portal";
import { apiSuccess, apiError } from "@/lib/utils";
import { SchedulingService } from "@/services/scheduling.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authResult = await requirePatientSession();
  if (authResult.error) return authResult.error;

  const sp = req.nextUrl.searchParams;
  const doctor = sp.get("doctor");
  const date = sp.get("date");

  if (!doctor) return apiError("Doctor ID is required", 422);
  if (!date) return apiError("Date (YYYY-MM-DD) is required", 422);

  try {
    // Strictly call getAvailableSlots WITHOUT custom duration to force Doctor's default duration
    const slotResult = await SchedulingService.getAvailableSlots(doctor, date);
    return apiSuccess(slotResult, "Available slots fetched");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to calculate available slots";
    return apiError(msg, 500);
  }
}
