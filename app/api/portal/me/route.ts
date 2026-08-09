import { NextRequest } from "next/server";
import { requirePatientSession } from "@/lib/auth/require-portal";
import connectDB from "@/lib/db/mongoose";
import { Patient } from "@/models/clinical.model";
import { apiSuccess, apiError, getIpFromHeaders } from "@/lib/utils";
import { auditLog } from "@/lib/auth/audit";

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

export async function PUT(req: NextRequest) {
  const authResult = await requirePatientSession();
  if (authResult.error) return authResult.error;

  await connectDB();
  const body = await req.json();

  const allowed = ["phone", "emergencyContact", "address", "gender", "bloodGroup"];
  const updateData: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updateData[key] = body[key];
  }

  const patient = await Patient.findByIdAndUpdate(authResult.patientId, updateData, { new: true }).lean();
  if (!patient) return apiError("Patient not found", 404);

  await auditLog({
    userId: authResult.session.user.id,
    action: "update",
    module: "patient_portal",
    description: `Patient updated portal profile details`,
    resourceId: authResult.patientId,
    resourceType: "Patient",
    ipAddress: getIpFromHeaders(req.headers),
  });

  const { password, ...safe } = patient as Record<string, unknown> & { password?: string };
  void password;

  return apiSuccess(safe, "Profile updated successfully");
}
