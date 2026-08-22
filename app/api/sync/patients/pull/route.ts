import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Patient } from "@/models/clinical.model";
import { apiError } from "@/lib/utils";
import { hasPermission } from "@/lib/auth/audit";

/**
 * GET /api/sync/patients/pull
 *
 * Cursor-based pull endpoint for RxDB replication.
 *
 * Query params:
 *   updatedAt  — Unix ms timestamp of the last pulled document (0 = full pull)
 *   lastId     — _id of the last pulled document (for tie-breaking)
 *   limit      — number of documents to return (default 50, max 200)
 *
 * Only syncs active patients (status: "active").
 * Returns documents in ascending updatedAt order so RxDB checkpointing is stable.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);

  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "patients", "view")) {
    return apiError("Forbidden", 403);
  }

  await connectDB();

  const sp = req.nextUrl.searchParams;
  const updatedAtCursor = parseInt(sp.get("updatedAt") || "0", 10);
  const lastId = sp.get("lastId") || "";
  const limit = Math.min(200, Math.max(1, parseInt(sp.get("limit") || "50", 10)));

  // Build cursor filter — standard pagination-by-timestamp pattern
  // We sync active patients only; server-deleted / archived patients are
  // pushed as _deleted:true so RxDB soft-deletes them locally.
  const filter: Record<string, unknown> = {};

  if (updatedAtCursor > 0) {
    const cursorDate = new Date(updatedAtCursor);
    filter.$or = [
      { updatedAt: { $gt: cursorDate } },
      // Tie-break: same updatedAt but _id > lastId
      { updatedAt: { $eq: cursorDate }, _id: { $gt: lastId } },
    ];
  }

  const rawPatients = await Patient.find(filter)
    .sort({ updatedAt: 1, _id: 1 })
    .limit(limit)
    .populate("registeredBy", "firstName lastName")
    .lean();

  const documents = rawPatients.map((p) => ({
    _id: (p._id as { toString(): string }).toString(),
    patientId: p.patientId,
    firstName: p.firstName,
    lastName: p.lastName,
    gender: p.gender,
    dateOfBirth: p.dateOfBirth,
    phone: p.phone,
    email: p.email,
    cnic: p.cnic,
    bloodGroup: p.bloodGroup,
    status: p.status,
    notes: p.notes,
    registeredBy:
      typeof p.registeredBy === "object" && p.registeredBy !== null
        ? (p.registeredBy as { _id: { toString(): string } })._id.toString()
        : (p.registeredBy as unknown as { toString(): string } | undefined)?.toString(),

    address: p.address ?? null,
    emergencyContact: p.emergencyContact ?? null,
    allergies: p.allergies ?? [],
    chronicDiseases: p.chronicDiseases ?? [],
    insuranceDetails: p.insuranceDetails ?? null,

    // Soft-delete: we use _deleted=true to signal archival / deceased records
    // so the RxDB client removes them from the active local store.
    _deleted: p.status === "archived" || p.status === "deceased",

    createdAt: (p.createdAt as Date | undefined)?.toISOString() ?? new Date().toISOString(),
    updatedAt: (p.updatedAt as Date | undefined)?.toISOString() ?? new Date().toISOString(),
  }));

  return Response.json({ documents }, { status: 200 });
}
