import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { requirePatientSession } from "@/lib/auth/require-portal";
import connectDB from "@/lib/db/mongoose";
import { Patient } from "@/models/clinical.model";
import { apiSuccess, apiError, getIpFromHeaders } from "@/lib/utils";
import { changePasswordSchema } from "@/lib/validations";
import { auditLog } from "@/lib/auth/audit";

export async function POST(req: NextRequest) {
  const authResult = await requirePatientSession();
  if (authResult.error) return authResult.error;

  const body = await req.json();
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);

  await connectDB();
  const patient = await Patient.findById(authResult.patientId).select("+password");
  if (!patient) return apiError("Patient not found", 404);

  const isValid = await bcrypt.compare(parsed.data.currentPassword, patient.password || "");
  if (!isValid) return apiError("Current password is incorrect", 400);

  const isSame = await bcrypt.compare(parsed.data.newPassword, patient.password || "");
  if (isSame) return apiError("New password must be different from current password", 400);

  const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 12);
  await Patient.findByIdAndUpdate(authResult.patientId, {
    password: hashedPassword,
    passwordChangedAt: new Date(),
    mustChangePassword: false,
  });

  await auditLog({
    action: "update",
    module: "patient_portal",
    description: `Patient changed portal password: ${patient.patientId}`,
    resourceId: authResult.patientId,
    resourceType: "Patient",
    ipAddress: getIpFromHeaders(req.headers),
    status: "success",
  });

  return apiSuccess(null, "Password changed successfully");
}
