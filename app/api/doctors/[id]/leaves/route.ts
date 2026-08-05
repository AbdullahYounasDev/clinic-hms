import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Doctor } from "@/models/clinical.model";
import { apiSuccess, apiError, getIpFromHeaders, isInactiveRecord } from "@/lib/utils";
import { hasPermission, auditLog } from "@/lib/auth/audit";
import { doctorLeaveSchema } from "@/lib/validations";
import { SchedulingService } from "@/services/scheduling.service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "doctors", "view")) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const { id } = await params;
  const doctor = await Doctor.findById(id).select("leaves doctorId specialization").lean();
  if (!doctor || isInactiveRecord(doctor)) return apiError("Doctor not found", 404);

  return apiSuccess(doctor.leaves || [], "Doctor leaves fetched");
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "doctors", "update")) {
    return apiError("Forbidden", 403);
  }

  const body = await req.json();
  const parsed = doctorLeaveSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);

  await connectDB();
  const { id } = await params;
  const doctor = await Doctor.findById(id);
  if (!doctor || isInactiveRecord(doctor)) return apiError("Doctor not found", 404);

  const sDateStr = parsed.data.date || parsed.data.startDate;
  const eDateStr = parsed.data.date || parsed.data.endDate || sDateStr;

  if (!sDateStr) {
    return apiError("Date is required", 422);
  }

  let startDate: Date;
  let endDate: Date;

  if (/^\d{4}-\d{2}-\d{2}$/.test(sDateStr)) {
    const [sy, sm, sd] = sDateStr.split("-").map(Number);
    startDate = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
  } else {
    startDate = new Date(sDateStr);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(eDateStr)) {
    const [ey, em, ed] = eDateStr.split("-").map(Number);
    endDate = new Date(ey, em - 1, ed, 23, 59, 59, 999);
  } else {
    endDate = new Date(eDateStr);
  }

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return apiError("Invalid date format", 422);
  }

  if (startDate > endDate) {
    return apiError("Start date cannot be after end date", 422);
  }

  // Check scheduling conflicts with existing appointments
  const conflicts = await SchedulingService.checkLeaveConflicts(
    id,
    sDateStr,
    eDateStr || sDateStr
  );

  const newLeave = {
    startDate,
    endDate,
    reason: parsed.data.reason || "",
    notes: parsed.data.notes || "",
    createdAt: new Date(),
  };

  doctor.leaves.push(newLeave as any);
  await doctor.save();

  await auditLog({
    userId: session.user.id,
    action: "update",
    module: "doctors",
    description: `Added leave for doctor ${doctor.doctorId} (${parsed.data.startDate} to ${parsed.data.endDate})`,
    resourceId: id,
    resourceType: "Doctor",
    ipAddress: getIpFromHeaders(req.headers),
  });

  const createdLeave = doctor.leaves[doctor.leaves.length - 1];

  return apiSuccess(
    {
      leave: createdLeave,
      conflicts,
    },
    conflicts.conflictCount > 0
      ? `Doctor leave added. Warning: ${conflicts.conflictCount} existing appointment(s) conflict with this leave period.`
      : "Doctor leave added successfully",
    201
  );
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "doctors", "update")) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const leaveId = sp.get("leaveId");

  if (!leaveId) return apiError("leaveId query parameter is required", 422);

  const doctor = await Doctor.findById(id);
  if (!doctor || isInactiveRecord(doctor)) return apiError("Doctor not found", 404);

  const initialCount = doctor.leaves.length;
  doctor.leaves = doctor.leaves.filter((l) => l._id?.toString() !== leaveId) as any;

  if (doctor.leaves.length === initialCount) {
    return apiError("Leave entry not found", 404);
  }

  await doctor.save();

  await auditLog({
    userId: session.user.id,
    action: "update",
    module: "doctors",
    description: `Deleted leave entry from doctor ${doctor.doctorId}`,
    resourceId: id,
    resourceType: "Doctor",
    ipAddress: getIpFromHeaders(req.headers),
  });

  return apiSuccess(doctor.leaves, "Leave entry deleted successfully");
}
