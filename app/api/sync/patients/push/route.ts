import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Patient } from "@/models/clinical.model";
import { apiError, getIpFromHeaders } from "@/lib/utils";
import { hasPermission, auditLog } from "@/lib/auth/audit";
import { normalizeCNIC } from "@/lib/utils/cnic-utils";
import { getNextSequenceValue } from "@/models/counter.model";

/**
 * POST /api/sync/patients/push
 *
 * Push endpoint for RxDB replication.
 *
 * Body: { rows: Array<{ newDocumentState, assumedMasterState? }> }
 *
 * For each row:
 *   1. If _id starts with "TEMP-" → create new patient, assign real PT-xxxxxx ID.
 *   2. If _id is a real MongoDB ObjectId → upsert (field-level merge).
 *   3. If _deleted is true → soft-delete (archive) the patient.
 *   4. If there's a conflict (phone/CNIC duplicate) → return conflicting docs array.
 *
 * Returns: { conflicts: LocalPatient[] }
 *   An empty array means all rows were accepted.
 *   Non-empty means RxDB should flag those docs as "conflict" on the client.
 */

type WireDoc = {
  _id?: string;
  tempId?: string;
  patientId?: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  cnic?: string;
  bloodGroup?: string;
  status?: string;
  notes?: string;
  address?: Record<string, unknown>;
  emergencyContact?: Record<string, unknown>;
  allergies?: string[];
  chronicDiseases?: string[];
  insuranceDetails?: Record<string, unknown>;
  _deleted?: boolean;
  updatedAt?: string;
  createdAt?: string;
};

type PushRow = {
  newDocumentState: WireDoc;
  assumedMasterState?: WireDoc;
};

/** Convert a Mongoose patient document to the wire format RxDB expects back */
function toRxDbConflict(raw: Record<string, unknown>) {
  const p = raw as {
    _id: { toString(): string };
    patientId?: string;
    firstName?: string;
    lastName?: string;
    gender?: string;
    dateOfBirth?: Date | string;
    phone?: string;
    email?: string;
    cnic?: string;
    bloodGroup?: string;
    status?: string;
    notes?: string;
    address?: Record<string, unknown>;
    emergencyContact?: Record<string, unknown>;
    allergies?: string[];
    chronicDiseases?: string[];
    insuranceDetails?: Record<string, unknown>;
    createdAt?: Date;
    updatedAt?: Date;
  };
  return {
    _id: p._id.toString(),
    patientId: p.patientId ?? "",
    firstName: p.firstName ?? "",
    lastName: p.lastName ?? "",
    gender: p.gender ?? "other",
    dateOfBirth:
      p.dateOfBirth instanceof Date
        ? p.dateOfBirth.toISOString().slice(0, 10)
        : String(p.dateOfBirth ?? ""),
    phone: p.phone ?? "",
    email: p.email,
    cnic: p.cnic,
    bloodGroup: p.bloodGroup,
    status: p.status ?? "active",
    notes: p.notes,
    address: p.address ?? null,
    emergencyContact: p.emergencyContact ?? null,
    allergies: p.allergies ?? [],
    chronicDiseases: p.chronicDiseases ?? [],
    insuranceDetails: p.insuranceDetails ?? null,
    _deleted: p.status === "archived" || p.status === "deceased",
    createdAt: p.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: p.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);

  // Need either create OR update permission to push
  const canCreate = hasPermission(
    session.user.permissions,
    session.user.isSuperAdmin,
    "patients",
    "create"
  );
  const canUpdate = hasPermission(
    session.user.permissions,
    session.user.isSuperAdmin,
    "patients",
    "update"
  );

  if (!canCreate && !canUpdate) {
    return apiError("Forbidden", 403);
  }

  let body: { rows: PushRow[] };
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  if (!Array.isArray(body?.rows)) {
    return apiError("rows must be an array", 400);
  }

  await connectDB();
  const ipAddress = getIpFromHeaders(req.headers);
  const conflicts: ReturnType<typeof toRxDbConflict>[] = [];
  const created: Array<{ tempId: string; patient: Record<string, unknown> }> = [];

  for (const row of body.rows) {
    const doc = row?.newDocumentState;
    if (!doc) continue;
    const isTemp = !doc._id || doc._id.startsWith("TEMP-");

    try {
      if (isTemp) {
        const incomingTempId = doc.tempId || doc._id;

        // If the temporary patient was deleted offline, do NOT create it on the server!
        if (doc._deleted) {
          if (incomingTempId) {
            await Patient.findOneAndUpdate(
              { tempId: incomingTempId },
              { $set: { status: "archived", updatedAt: new Date() } }
            );
          }
          continue;
        }

        // ── CREATE (offline-created patient) ──────────────────────────────
        if (!canCreate) {
          // Skip rows the user can't create; they'll stay pending
          continue;
        }

        // 1. Idempotency Check: if a patient with this tempId was already created, reuse it!
        if (incomingTempId) {
          const existingByTemp = await Patient.findOne({ tempId: incomingTempId }).lean();
          if (existingByTemp) {
            created.push({
              tempId: incomingTempId,
              patient: {
                _id: existingByTemp._id.toString(),
                patientId: existingByTemp.patientId,
                firstName: existingByTemp.firstName,
                lastName: existingByTemp.lastName,
                gender: existingByTemp.gender,
                dateOfBirth: existingByTemp.dateOfBirth
                  ? new Date(existingByTemp.dateOfBirth).toISOString().slice(0, 10)
                  : "",
                phone: existingByTemp.phone,
                email: existingByTemp.email,
                cnic: existingByTemp.cnic,
                bloodGroup: existingByTemp.bloodGroup,
                status: existingByTemp.status,
                notes: existingByTemp.notes,
                registeredBy: existingByTemp.registeredBy?.toString(),
                address: existingByTemp.address,
                emergencyContact: existingByTemp.emergencyContact,
                allergies: existingByTemp.allergies,
                chronicDiseases: existingByTemp.chronicDiseases,
                insuranceDetails: existingByTemp.insuranceDetails,
                createdAt: existingByTemp.createdAt ? new Date(existingByTemp.createdAt).toISOString() : undefined,
                updatedAt: existingByTemp.updatedAt ? new Date(existingByTemp.updatedAt).toISOString() : undefined,
              },
            });
            continue;
          }
        }

        const seq = await getNextSequenceValue("patient");
        const patientId = `PT-${String(seq).padStart(6, "0")}`;
        const normalizedCnic = doc.cnic ? normalizeCNIC(doc.cnic) : undefined;

        const patient = await Patient.create({
          tempId: incomingTempId,
          patientId,
          firstName: doc.firstName,
          lastName: doc.lastName,
          gender: doc.gender,
          dateOfBirth: doc.dateOfBirth ? new Date(doc.dateOfBirth) : undefined,
          phone: doc.phone,
          email: doc.email || undefined,
          cnic: normalizedCnic || undefined,
          bloodGroup: doc.bloodGroup || undefined,
          status: doc.status ?? "active",
          notes: doc.notes || undefined,
          address: doc.address || undefined,
          emergencyContact: doc.emergencyContact || undefined,
          allergies: doc.allergies?.length ? doc.allergies : undefined,
          chronicDiseases: doc.chronicDiseases?.length ? doc.chronicDiseases : undefined,
          insuranceDetails: doc.insuranceDetails || undefined,
          registeredBy: session.user.id,
        });

        created.push({
          tempId: doc.tempId || doc._id || "",
          patient: {
            _id: patient._id.toString(),
            patientId: patient.patientId,
            firstName: patient.firstName,
            lastName: patient.lastName,
            gender: patient.gender,
            dateOfBirth: patient.dateOfBirth
              ? patient.dateOfBirth.toISOString().slice(0, 10)
              : "",
            phone: patient.phone,
            email: patient.email,
            cnic: patient.cnic,
            bloodGroup: patient.bloodGroup,
            status: patient.status,
            notes: patient.notes,
            registeredBy: patient.registeredBy?.toString(),
            address: patient.address,
            emergencyContact: patient.emergencyContact,
            allergies: patient.allergies,
            chronicDiseases: patient.chronicDiseases,
            insuranceDetails: patient.insuranceDetails,
            createdAt: patient.createdAt?.toISOString(),
            updatedAt: patient.updatedAt?.toISOString(),
          },
        });

        await auditLog({
          userId: session.user.id,
          action: "sync_create",
          module: "patients",
          description: `Offline patient synced: ${patient.fullName} (${patientId})`,
          resourceId: patient._id.toString(),
          resourceType: "Patient",
          newData: { patientId, tempId: doc.tempId },
          ipAddress,
        });
      } else if (doc._deleted) {
        // ── SOFT DELETE (archive) ─────────────────────────────────────────
        if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "patients", "delete")) {
          continue;
        }

        const patient = await Patient.findByIdAndUpdate(
          doc._id,
          { $set: { status: "archived", updatedAt: new Date() } },
          { new: true }
        ).lean();

        if (patient) {
          await auditLog({
            userId: session.user.id,
            action: "sync_delete",
            module: "patients",
            description: `Offline patient archived: ${doc._id}`,
            resourceId: doc._id,
            resourceType: "Patient",
            ipAddress,
          });
        }
      } else {
        // ── UPDATE (existing patient) ─────────────────────────────────────
        if (!canUpdate) continue;

        // Validate ObjectId before querying
        if (!mongoose.Types.ObjectId.isValid(doc._id!)) {
          continue;
        }

        const existing = await Patient.findById(doc._id).lean() as Record<string, unknown> | null;
        if (!existing) {
          // Doc deleted server-side — emit as conflict so client soft-deletes locally
          conflicts.push({
            _id: doc._id!,
            patientId: doc.patientId ?? "",
            firstName: doc.firstName ?? "",
            lastName: doc.lastName ?? "",
            gender: (doc.gender ?? "other") as "male" | "female" | "other",
            dateOfBirth: doc.dateOfBirth ?? "",
            phone: doc.phone ?? "",
            email: doc.email,
            cnic: doc.cnic,
            bloodGroup: doc.bloodGroup,
            status: "archived",
            notes: doc.notes,
            address: doc.address ?? null,
            emergencyContact: doc.emergencyContact ?? null,
            allergies: doc.allergies ?? [],
            chronicDiseases: doc.chronicDiseases ?? [],
            insuranceDetails: doc.insuranceDetails ?? null,
            _deleted: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          continue;
        }

        const normalizedCnic = doc.cnic ? normalizeCNIC(doc.cnic) : undefined;

        // Field-level merge: offline wins for most fields; server wins for patientId
        const updateFields: Record<string, unknown> = {
          firstName: doc.firstName,
          lastName: doc.lastName,
          gender: doc.gender,
          dateOfBirth: doc.dateOfBirth ? new Date(doc.dateOfBirth) : undefined,
          phone: doc.phone,
          email: doc.email || undefined,
          bloodGroup: doc.bloodGroup || undefined,
          status: doc.status ?? "active",
          notes: doc.notes || undefined,
          updatedAt: new Date(),
        };

        if (normalizedCnic) updateFields.cnic = normalizedCnic;
        if (doc.address) updateFields.address = doc.address;
        if (doc.emergencyContact) updateFields.emergencyContact = doc.emergencyContact;
        if (doc.allergies?.length) updateFields.allergies = doc.allergies;
        if (doc.chronicDiseases?.length) updateFields.chronicDiseases = doc.chronicDiseases;
        if (doc.insuranceDetails) updateFields.insuranceDetails = doc.insuranceDetails;

        await Patient.findByIdAndUpdate(doc._id, { $set: updateFields });

        await auditLog({
          userId: session.user.id,
          action: "sync_update",
          module: "patients",
          description: `Offline patient update synced: ${doc._id}`,
          resourceId: doc._id,
          resourceType: "Patient",
          ipAddress,
        });
      }
    } catch (err: unknown) {
      const mongoError = err as { code?: number; message?: string; keyPattern?: Record<string, number> };

      const isDuplicateKey =
        mongoError.code === 11000 ||
        (typeof mongoError.message === "string" && mongoError.message.includes("E11000"));

      if (isDuplicateKey) {
        // Duplicate key — fetch the conflicting server document and return it
        let serverDoc: Record<string, unknown> | null = null;

        if (doc.cnic) {
          serverDoc = (await Patient.findOne({ cnic: normalizeCNIC(doc.cnic) }).lean()) as Record<string, unknown> | null;
        }
        if (!serverDoc && doc.email) {
          serverDoc = (await Patient.findOne({ email: doc.email.toLowerCase().trim() }).lean()) as Record<string, unknown> | null;
        }

        const incomingId = doc._id || doc.tempId || "";
        if (serverDoc) {
          const conflictObj = toRxDbConflict(serverDoc);
          // Set _id to the client's doc ID (tempId or _id) so RxDB matches the local pushed row
          conflictObj._id = incomingId;
          conflicts.push(conflictObj);
        } else {
          conflicts.push({
            _id: incomingId,
            patientId: doc.patientId ?? "",
            firstName: doc.firstName ?? "",
            lastName: doc.lastName ?? "",
            gender: (doc.gender ?? "other") as "male" | "female" | "other",
            dateOfBirth: doc.dateOfBirth ?? "",
            phone: doc.phone ?? "",
            email: doc.email,
            cnic: doc.cnic,
            bloodGroup: doc.bloodGroup,
            status: "active",
            notes: doc.notes,
            address: doc.address ?? null,
            emergencyContact: doc.emergencyContact ?? null,
            allergies: doc.allergies ?? [],
            chronicDiseases: doc.chronicDiseases ?? [],
            insuranceDetails: doc.insuranceDetails ?? null,
            _deleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        continue;
      }

      console.error("Push sync row error:", err);
      continue;
    }
  }

  return Response.json({ conflicts, created }, { status: 200 });
}
