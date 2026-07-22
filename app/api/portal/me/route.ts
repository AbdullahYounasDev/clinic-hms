import { requirePatientSession } from "@/lib/auth/require-portal";
import connectDB from "@/lib/db/mongoose";
import { Patient } from "@/models/clinical.model";
import { apiSuccess, apiError } from "@/lib/utils";

export async function GET() {
  const authResult = await requirePatientSession();
  if (authResult.error) return authResult.error;

  await connectDB();
  const patient = await Patient.findById(authResult.patientId).lean();
  if (!patient) return apiError("Patient not found", 404);

  const { password, ...safe } = patient as Record<string, unknown> & { password?: string };
  void password;

  return apiSuccess(safe);
}
