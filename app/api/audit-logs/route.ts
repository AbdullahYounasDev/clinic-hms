import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { AuditLog } from "@/models/user.model";
import { apiSuccess, apiError, getPaginationParams, buildPagination } from "@/lib/utils";
import { hasPermission } from "@/lib/auth/audit";
import { getClinicTimezone, getClinicDayBounds } from "@/lib/time-utils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "audit_logs", "view")) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const sp = req.nextUrl.searchParams;
  const { page, limit, skip } = getPaginationParams(sp);
  const action = sp.get("action") || "";
  const moduleFilter = sp.get("module") || "";
  const userId = sp.get("user") || "";
  const status = sp.get("status") || "";
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  const search = sp.get("search") || "";
  const isPortal = sp.get("isPortal") === "true" || sp.get("portal") === "true";

  const filter: Record<string, unknown> = {};
  if (action) filter.action = action;
  
  if (isPortal) {
    filter.module = { $in: ["patient_portal", "portal_appointments"] };
  } else if (moduleFilter) {
    filter.module = moduleFilter;
  }

  if (userId) filter.user = userId;
  if (status) filter.status = status;

  if (search) {
    filter.$or = [
      { description: { $regex: search, $options: "i" } },
      { ipAddress: { $regex: search, $options: "i" } },
    ];
  }

  if (from || to) {
    const clinicTz = await getClinicTimezone();
    const dateRange: Record<string, Date> = {};

    if (from) {
      dateRange.$gte = getClinicDayBounds(from, clinicTz).start;
    }
    if (to) {
      dateRange.$lte = getClinicDayBounds(to, clinicTz).end;
    }
    filter.createdAt = dateRange;
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate({
        path: "user",
        select: "firstName lastName email employeeId role",
        populate: { path: "role", select: "name slug" },
      })
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  // Resolve Patient names for patient portal audit logs
  const { Patient } = await import("@/models/clinical.model");
  const missingUserLogIds = logs.filter(l => !l.user).map(l => l._id.toString());

  if (missingUserLogIds.length > 0) {
    const rawLogs = await AuditLog.find({ _id: { $in: missingUserLogIds } }).select("user resourceId resourceType module").lean();
    const candidateIds = Array.from(
      new Set(
        rawLogs
          .flatMap(l => [l.user?.toString(), l.resourceId?.toString()])
          .filter((id): id is string => Boolean(id && id.length === 24))
      )
    );

    if (candidateIds.length > 0) {
      const patients = await Patient.find({ _id: { $in: candidateIds } }).select("firstName lastName email patientId").lean();
      const patientMap = new Map(patients.map(p => [p._id.toString(), p]));

      for (const log of logs as any[]) {
        if (!log.user) {
          const raw = rawLogs.find(r => r._id.toString() === log._id.toString());
          const matchKey = raw?.user?.toString() || raw?.resourceId?.toString();
          const p = matchKey ? patientMap.get(matchKey) : null;
          if (p) {
            log.user = {
              firstName: p.firstName,
              lastName: p.lastName,
              email: p.email,
              employeeId: p.patientId,
              isPatient: true,
            };
          }
        }
      }
    }
  }

  return apiSuccess(logs, "Audit logs fetched", 200, buildPagination(total, page, limit));
}
