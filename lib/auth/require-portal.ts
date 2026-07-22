import { auth } from "@/lib/auth/auth.config";
import { apiError } from "@/lib/utils";
import { isPatientSession } from "@/lib/auth/session-helpers";
import type { Session } from "next-auth";

type PortalSessionResult =
  | { session: Session; patientId: string; error?: never }
  | { session?: never; patientId?: never; error: ReturnType<typeof apiError> };

export async function requirePatientSession(): Promise<PortalSessionResult> {
  const session = await auth();
  if (!session) return { error: apiError("Unauthorized", 401) };
  if (!isPatientSession(session)) return { error: apiError("Forbidden", 403) };
  if (session.user.status !== "active") {
    return { error: apiError("Your portal access is not active", 403) };
  }
  return { session, patientId: session.user.id };
}
