import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { User } from "@/models/user.model";
import { apiSuccess, apiError, getPaginationParams, buildPagination, applyUserStatusFilter } from "@/lib/utils";
import { hasPermission } from "@/lib/auth/audit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "staff", "view")) return apiError("Forbidden", 403);
  await connectDB();
  const sp = req.nextUrl.searchParams;
  const { page, limit, skip } = getPaginationParams(sp);
  const search = sp.get("search") || "";
  const status = sp.get("status") || "";
  const department = sp.get("department") || "";
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";

  const filter: Record<string, unknown> = {};
  applyUserStatusFilter(filter, status || null);
  if (department) filter.department = department;

  if (from || to) {
    const { getClinicDayBounds, getClinicTimezone } = await import("@/lib/time-utils");
    const tz = await getClinicTimezone();
    filter.createdAt = {};
    if (from) {
      const bounds = getClinicDayBounds(from, tz);
      (filter.createdAt as Record<string, unknown>).$gte = bounds.start;
    }
    if (to) {
      const bounds = getClinicDayBounds(to, tz);
      (filter.createdAt as Record<string, unknown>).$lte = bounds.end;
    }
  }

  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { employeeId: { $regex: search, $options: "i" } },
    ];
  }

  const [staff, total] = await Promise.all([
    User.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("role", "name slug")
      .select("-password -passwordResetToken")
      .lean(),
    User.countDocuments(filter),
  ]);

  // Enrich doctor users with their clinical department
  const userIds = staff.map((u) => u._id);
  const { Doctor } = await import("@/models/clinical.model");
  const doctors = await Doctor.find({ user: { $in: userIds } })
    .populate("department", "name code")
    .lean();

  const doctorDeptMap = new Map<string, string>();
  for (const doc of doctors) {
    if (!doc.user) continue;
    const deptObj = doc.department as unknown as { name?: string; code?: string } | undefined;
    const deptName =
      deptObj?.name ||
      (typeof doc.department === "string" ? doc.department : "") ||
      doc.specialization ||
      "";
    if (deptName) {
      doctorDeptMap.set(doc.user.toString(), deptName);
    }
  }

  const enrichedStaff = staff.map((u) => ({
    ...u,
    department: doctorDeptMap.get(u._id.toString()) || u.department || "",
  }));

  return apiSuccess(enrichedStaff, "Staff fetched", 200, buildPagination(total, page, limit));
}
