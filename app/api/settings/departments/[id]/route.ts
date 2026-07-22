import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Department } from "@/models/clinical.model";
import { apiSuccess, apiError, getIpFromHeaders } from "@/lib/utils";
import { auditLog, hasPermission } from "@/lib/auth/audit";

interface Params { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "settings", "update")) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const { id } = await params;

  const existing = await Department.findById(id).lean();
  if (!existing) return apiError("Department not found", 404);
  if (!existing.isActive) return apiError("Department not found", 404);

  const department = await Department.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true }
  ).lean();

  await auditLog({
    userId: session.user.id,
    action: "delete",
    module: "settings",
    description: `Archived department: ${department.name} (${department.code})`,
    resourceId: id,
    resourceType: "Department",
    ipAddress: getIpFromHeaders(req.headers),
  });

  return apiSuccess(null, "Department deleted successfully");
}
