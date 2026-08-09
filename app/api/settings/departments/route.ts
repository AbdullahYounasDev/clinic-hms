import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Department } from "@/models/clinical.model";
import { apiSuccess, apiError, getIpFromHeaders } from "@/lib/utils";
import { auditLog, hasPermission } from "@/lib/auth/audit";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  await connectDB();
  const departments = await Department.find({ isActive: true }).sort({ name: 1 }).lean();
  return apiSuccess(departments);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "settings", "update")) return apiError("Forbidden", 403);
  const body = await req.json();
  if (!body.name || !body.code) return apiError("Name and code are required", 422);
  await connectDB();
  const codeUpper = body.code.trim().toUpperCase();

  const existing = await Department.findOne({ code: codeUpper });
  if (existing) {
    if (existing.isActive) {
      return apiError("A department with this code already exists", 409);
    }
    // Reactivate and update
    existing.isActive = true;
    existing.name = body.name.trim();
    existing.description = body.description || "";
    await existing.save();

    await auditLog({
      userId: session.user.id,
      action: "update",
      module: "settings",
      description: `Reactivated department: ${existing.name} (${existing.code})`,
      resourceId: existing._id.toString(),
      resourceType: "Department",
      ipAddress: getIpFromHeaders(req.headers),
    });

    return apiSuccess(existing, "Department reactivated", 200);
  }

  const dept = await Department.create({ name: body.name.trim(), code: codeUpper, description: body.description });

  await auditLog({
    userId: session.user.id,
    action: "create",
    module: "settings",
    description: `Created department: ${dept.name} (${dept.code})`,
    resourceId: dept._id.toString(),
    resourceType: "Department",
    ipAddress: getIpFromHeaders(req.headers),
  });

  return apiSuccess(dept, "Department created", 201);
}
