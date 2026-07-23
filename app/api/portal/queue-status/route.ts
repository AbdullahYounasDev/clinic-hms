import { requirePatientSession } from "@/lib/auth/require-portal";
import { apiSuccess, apiError } from "@/lib/utils";
import { QueueService } from "@/services/queue.service";

export async function GET() {
  const authResult = await requirePatientSession();
  if (authResult.error) return authResult.error;

  const queueStatus = await QueueService.getPatientQueuePosition(authResult.patientId);

  if (!queueStatus) {
    return apiSuccess({ hasActiveQueue: false }, "No active queue");
  }

  return apiSuccess(queueStatus, "Queue status fetched");
}
