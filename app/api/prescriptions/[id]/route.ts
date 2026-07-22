import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Prescription } from "@/models/clinical.model";
import { apiSuccess, apiError, getIpFromHeaders, isArchivedStatus } from "@/lib/utils";
import { auditLog, hasPermission } from "@/lib/auth/audit";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "prescriptions", "view")) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const { id } = await params;

  const prescription = await Prescription.findById(id)
    .populate("patient", "firstName lastName patientId")
    .populate({ path: "doctor", populate: { path: "user", select: "firstName lastName" } })
    .populate("emr")
    .lean();

  if (!prescription) return apiError("Prescription not found", 404);
  if (isArchivedStatus(prescription.status)) return apiError("Prescription not found", 404);

  return apiSuccess(prescription);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "prescriptions", "delete")) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const { id } = await params;

  const existing = await Prescription.findById(id).lean();
  if (!existing) return apiError("Prescription not found", 404);
  if (isArchivedStatus(existing.status)) return apiError("Prescription not found", 404);

  await Prescription.findByIdAndUpdate(id, { status: "archived" });

  await auditLog({
    userId: session.user.id,
    action: "delete",
    module: "prescriptions",
    description: `Archived prescription ${existing.prescriptionId}`,
    resourceId: id,
    resourceType: "Prescription",
    ipAddress: getIpFromHeaders(req.headers),
  });

  return apiSuccess(null, "Prescription deleted successfully");
}
