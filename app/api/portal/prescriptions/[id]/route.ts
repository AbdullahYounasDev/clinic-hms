import { NextRequest } from "next/server";
import { requirePatientSession } from "@/lib/auth/require-portal";
import connectDB from "@/lib/db/mongoose";
import { Prescription } from "@/models/clinical.model";
import { apiSuccess, apiError, isArchivedStatus } from "@/lib/utils";
import { patientOwnsResource } from "@/lib/portal/assert-patient-resource";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const authResult = await requirePatientSession();
  if (authResult.error) return authResult.error;

  await connectDB();
  const { id } = await params;

  const prescription = await Prescription.findById(id)
    .populate("patient", "firstName lastName patientId phone dateOfBirth gender allergies")
    .populate({ path: "doctor", populate: { path: "user", select: "firstName lastName email" } })
    .lean();

  if (!prescription) return apiError("Prescription not found", 404);
  if (isArchivedStatus(prescription.status)) return apiError("Prescription not found", 404);
  if (!patientOwnsResource(authResult.patientId, prescription.patient)) {
    return apiError("Forbidden", 403);
  }

  return apiSuccess(prescription);
}
