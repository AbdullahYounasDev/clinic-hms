import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Patient } from "@/models/clinical.model";
import { apiSuccess, apiError, getIpFromHeaders, sanitizeForLog, isArchivedPatient } from "@/lib/utils";
import { updatePatientSchema } from "@/lib/validations";
import { auditLog, hasPermission } from "@/lib/auth/audit";
import { resolvePatientPortalFields } from "@/lib/patient-portal-fields";

import { normalizeCNIC } from "@/lib/utils/cnic-utils";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "patients", "view")) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const { id } = await params;

  const patient = await Patient.findById(id)
    .populate("registeredBy", "firstName lastName email")
    .lean();

  if (!patient) return apiError("Patient not found", 404);
  if (isArchivedPatient(patient.status)) return apiError("Patient not found", 404);

  return apiSuccess(patient);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "patients", "update")) {
    return apiError("Forbidden", 403);
  }

  const body = await req.json();
  const parsed = updatePatientSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);

  await connectDB();
  const { id } = await params;

  const existing = await Patient.findById(id).lean();
  if (!existing) return apiError("Patient not found", 404);
  if (isArchivedPatient(existing.status)) return apiError("Patient not found", 404);

  const updateFields = { ...parsed.data };
  if (typeof updateFields.cnic === "string") {
    updateFields.cnic = normalizeCNIC(updateFields.cnic);
  }

  const resolved = await resolvePatientPortalFields(updateFields as Record<string, unknown>, id);
  if (resolved.error) return apiError(resolved.error, 422);

  try {
    const updated = await Patient.findByIdAndUpdate(id, resolved.data, { new: true }).lean();

    await auditLog({
      userId: session.user.id,
      action: "update",
      module: "patients",
      description: `Updated patient: ${existing.firstName} ${existing.lastName}`,
      resourceId: id,
      resourceType: "Patient",
      previousData: sanitizeForLog(existing as unknown as Record<string, unknown>),
      newData: sanitizeForLog(parsed.data as Record<string, unknown>),
      ipAddress: getIpFromHeaders(req.headers),
    });

    return apiSuccess(updated, "Patient updated successfully");
  } catch (err: unknown) {
    const mongoError = err as { code?: number; keyPattern?: Record<string, number> };
    if (mongoError.code === 11000 && mongoError.keyPattern?.cnic) {
      return apiError("A patient with this CNIC already exists.", 422);
    }
    if (mongoError.code === 11000 && mongoError.keyPattern?.email) {
      return apiError("A patient with this email address already exists.", 422);
    }
    throw err;
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "patients", "delete")) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const { id } = await params;

  // Soft delete — archive instead of hard delete
  const patient = await Patient.findByIdAndUpdate(
    id,
    { status: "archived" },
    { new: true }
  ).lean();

  if (!patient) return apiError("Patient not found", 404);

  await auditLog({
    userId: session.user.id,
    action: "delete",
    module: "patients",
    description: `Archived patient: ${patient.firstName || ""} ${patient.lastName || ""}`,
    resourceId: id,
    resourceType: "Patient",
    ipAddress: getIpFromHeaders(req.headers),
  });

  return apiSuccess(null, "Patient archived successfully");
}
