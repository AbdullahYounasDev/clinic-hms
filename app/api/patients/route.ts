import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Patient } from "@/models/clinical.model";
import { apiSuccess, apiError, getPaginationParams, buildPagination, getIpFromHeaders, applyPatientStatusFilter } from "@/lib/utils";
import { createPatientSchema } from "@/lib/validations";
import { auditLog, hasPermission } from "@/lib/auth/audit";
import { resolvePatientPortalFields } from "@/lib/patient-portal-fields";
import { normalizeCNIC } from "@/lib/utils/cnic-utils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);

  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "patients", "view")) {
    return apiError("Forbidden", 403);
  }

  await connectDB();

  const sp = req.nextUrl.searchParams;
  const { page, limit, skip } = getPaginationParams(sp);
  const search = sp.get("search") || "";
  const status = sp.get("status") || "";
  const bloodGroup = sp.get("bloodGroup") || "";
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";

  const filter: Record<string, unknown> = {};

  applyPatientStatusFilter(filter, status);
  if (bloodGroup) filter.bloodGroup = bloodGroup;

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
    const rawSearch = search.trim();
    const cleanSearch = normalizeCNIC(rawSearch);
    filter.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { patientId: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { cnic: { $regex: search, $options: "i" } },
      ...(cleanSearch ? [{ cnic: cleanSearch }] : []),
    ];
  }

  const [patients, total] = await Promise.all([
    Patient.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("registeredBy", "firstName lastName")
      .lean(),
    Patient.countDocuments(filter),
  ]);

  return apiSuccess(patients, "Patients fetched", 200, buildPagination(total, page, limit));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);

  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "patients", "create")) {
    return apiError("Forbidden", 403);
  }

  const body = await req.json();
  const parsed = createPatientSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 422);
  }

  await connectDB();

  const { portalPassword, cnic, ...patientFields } = parsed.data;
  const normalizedCnic = cnic ? normalizeCNIC(cnic) : undefined;

  const resolved = await resolvePatientPortalFields({
    ...patientFields,
    ...(normalizedCnic ? { cnic: normalizedCnic } : {}),
    ...(portalPassword ? { portalPassword } : {}),
  });
  if (resolved.error) return apiError(resolved.error, 422);

  try {
    const patient = await Patient.create({
      ...resolved.data,
      registeredBy: session.user.id,
    });

    await auditLog({
      userId: session.user.id,
      action: "create",
      module: "patients",
      description: `Created patient: ${patient.fullName}`,
      resourceId: patient._id.toString(),
      resourceType: "Patient",
      newData: { patientId: patient.patientId, name: patient.fullName },
      ipAddress: getIpFromHeaders(req.headers),
    });

    return apiSuccess(patient, "Patient created successfully", 201);
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
