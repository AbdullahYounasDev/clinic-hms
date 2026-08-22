import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Doctor } from "@/models/clinical.model";
import { apiSuccess, apiError, getPaginationParams, buildPagination, applyRecordStatusFilter } from "@/lib/utils";
import { hasPermission } from "@/lib/auth/audit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "doctors", "view")) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const sp = req.nextUrl.searchParams;
  const { page, limit, skip } = getPaginationParams(sp);

  const search = sp.get("search") || "";
  const departmentId = sp.get("department") || "";
  const isAvailable = sp.get("isAvailable");
  const status = sp.get("status") || "";
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";

  const filter: Record<string, unknown> = {};
  applyRecordStatusFilter(filter, status || null);

  // Department filter
  if (departmentId) filter.department = departmentId;

  // Availability filter
  if (isAvailable !== undefined && isAvailable !== null && isAvailable !== "") {
    filter.isAvailable = isAvailable === "true";
  }

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

  // Search by name, email, specialization, or doctor ID
  if (search) {
    const { User } = await import("@/models/user.model");
    const userIds = await User.find({
      status: "active",
      $or: [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    }).distinct("_id");

    filter.$or = [
      { user: { $in: userIds } },
      { specialization: { $regex: search, $options: "i" } },
      { doctorId: { $regex: search, $options: "i" } },
    ];
  }

  const [doctors, total] = await Promise.all([
    Doctor.find(filter)
      .skip(skip).limit(limit).sort({ createdAt: -1 })
      .populate("user", "firstName lastName email phone avatar")
      .populate("department", "name code")
      .lean(),
    Doctor.countDocuments(filter),
  ]);

  return apiSuccess(doctors, "Doctors fetched", 200, buildPagination(total, page, limit));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "doctors", "create")) return apiError("Forbidden", 403);
  const body = await req.json();
  if (!body.user || !body.specialization) return apiError("User and specialization are required", 422);

  const durationNum = Number(body.appointmentDuration);
  const appointmentDuration = !isNaN(durationNum) && durationNum > 0 ? durationNum : 30;

  await connectDB();
  const { Doctor } = await import("@/models/clinical.model");
  const exists = await Doctor.findOne({ user: body.user });
  if (exists) return apiError("Doctor profile already exists for this user", 409);
  const doctor = await Doctor.create({
    ...body,
    appointmentDuration,
  });
  const populated = await Doctor.findById(doctor._id).populate("user", "firstName lastName email phone").populate("department", "name code").lean();
  const { auditLog: log } = await import("@/lib/auth/audit");
  await log({ userId: session.user.id, action: "create", module: "doctors", description: `Created doctor profile ${doctor.doctorId}`, resourceId: doctor._id.toString() });
  return apiSuccess(populated, "Doctor profile created", 201);
}
