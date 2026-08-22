/**
 * RxDB <-> Server replication for the patients collection.
 *
 * Uses `replicateRxCollection` from `rxdb/plugins/replication` (free, no premium).
 * Pull: checkpoint-based cursor over `updatedAt`.
 * Push: batch HTTP POST to /api/sync/patients/push.
 *
 * Call `startPatientSync(collection)` once (e.g., from the RxDB provider).
 * Returns the RxReplicationState so callers can subscribe to error / active events.
 */

import { replicateRxCollection, RxReplicationState } from "rxdb/plugins/replication";
import type { RxCollection } from "rxdb";
import type { LocalPatient } from "./schema";

export type PullCheckpoint = { updatedAt: number; id: string } | null;

/** Serialise a LocalPatient into the wire format the server can store */
function toWireDoc(doc: LocalPatient): Record<string, unknown> {
  return {
    // Server-side identifiers
    _id: doc.id.startsWith("TEMP-") ? undefined : doc.id,
    tempId: doc.id.startsWith("TEMP-") ? doc.id : undefined,
    patientId: doc.patientId,

    // Core fields
    firstName: doc.firstName,
    lastName: doc.lastName,
    gender: doc.gender,
    dateOfBirth: doc.dateOfBirth,
    phone: doc.phone,
    email: doc.email,
    cnic: doc.cnic,
    bloodGroup: doc.bloodGroup,
    status: doc.status,
    notes: doc.notes,

    // Sub-documents — server expects parsed objects
    address: doc.address ? JSON.parse(doc.address) : undefined,
    emergencyContact: doc.emergencyContact ? JSON.parse(doc.emergencyContact) : undefined,
    allergies: doc.allergies ? JSON.parse(doc.allergies) : undefined,
    chronicDiseases: doc.chronicDiseases ? JSON.parse(doc.chronicDiseases) : undefined,
    insuranceDetails: doc.insuranceDetails ? JSON.parse(doc.insuranceDetails) : undefined,

    // Soft-delete
    _deleted: doc._deleted,

    // Timestamps
    updatedAt: new Date(doc.updatedAt).toISOString(),
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

export function generateShortTempId(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `TEMP-${num}`;
}

export function startPatientSync(
  collection: RxCollection<LocalPatient>
): RxReplicationState<LocalPatient, PullCheckpoint> {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  const repState = replicateRxCollection<LocalPatient, PullCheckpoint>({
    replicationIdentifier: "clinic-hms-patients-v1",
    collection,
    deletedField: "_deleted",
    live: true,
    autoStart: isOnline,
    retryTime: 15_000,
    waitForLeadership: true,

    // ── PULL ──────────────────────────────────────────────────────────────
    pull: {
      async handler(lastCheckpoint, batchSize) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          return { documents: [], checkpoint: lastCheckpoint ?? null };
        }

        const cursor = lastCheckpoint ?? { updatedAt: 0, id: "" };

        let res: Response;
        try {
          res = await fetch(
            `/api/sync/patients/pull?updatedAt=${cursor.updatedAt}&lastId=${encodeURIComponent(cursor.id)}&limit=${batchSize}`,
            { credentials: "same-origin" }
          );
        } catch {
          // Network offline / fetch failed
          return { documents: [], checkpoint: lastCheckpoint ?? null };
        }

        if (!res.ok) {
          // Unauthenticated or server unavailable — return empty without crashing
          return { documents: [], checkpoint: lastCheckpoint ?? null };
        }

        let json: { documents?: unknown[] };
        try {
          json = await res.json();
        } catch {
          return { documents: [], checkpoint: lastCheckpoint ?? null };
        }

        const docs: LocalPatient[] = (json.documents ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (raw: any): LocalPatient => ({
            id: raw._id,
            syncStatus: "synced",
            serverPatientId: raw.patientId,
            _deleted: raw._deleted ?? false,

            patientId: raw.patientId ?? raw._id,
            firstName: raw.firstName,
            lastName: raw.lastName,
            gender: raw.gender,
            dateOfBirth:
              typeof raw.dateOfBirth === "string"
                ? raw.dateOfBirth.slice(0, 10)
                : new Date(raw.dateOfBirth).toISOString().slice(0, 10),
            phone: raw.phone,
            email: raw.email,
            cnic: raw.cnic,
            bloodGroup: raw.bloodGroup,
            status: raw.status ?? "active",
            notes: raw.notes,
            registeredBy:
              typeof raw.registeredBy === "object"
                ? raw.registeredBy?._id
                : raw.registeredBy,

            createdAt: new Date(raw.createdAt).getTime(),
            updatedAt: new Date(raw.updatedAt).getTime(),

            address: raw.address ? JSON.stringify(raw.address) : undefined,
            emergencyContact: raw.emergencyContact
              ? JSON.stringify(raw.emergencyContact)
              : undefined,
            allergies:
              Array.isArray(raw.allergies) && raw.allergies.length > 0
                ? JSON.stringify(raw.allergies)
                : undefined,
            chronicDiseases:
              Array.isArray(raw.chronicDiseases) && raw.chronicDiseases.length > 0
                ? JSON.stringify(raw.chronicDiseases)
                : undefined,
            insuranceDetails: raw.insuranceDetails
              ? JSON.stringify(raw.insuranceDetails)
              : undefined,
          })
        );

        const newCheckpoint: PullCheckpoint =
          docs.length > 0
            ? {
                updatedAt: docs[docs.length - 1].updatedAt,
                id: docs[docs.length - 1].id,
              }
            : (lastCheckpoint ?? null);

        return { documents: docs, checkpoint: newCheckpoint };
      },
      batchSize: 50,
    },

    // ── PUSH ──────────────────────────────────────────────────────────────
    push: {
      async handler(rows) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          throw new Error("Offline: push paused until reconnected");
        }

        if (!Array.isArray(rows) || rows.length === 0) {
          return [];
        }

        // Only send rows that have pending local changes!
        // This stops infinite push loops on already-synced rows.
        const pendingRows = rows.filter(
          (r) =>
            r?.newDocumentState &&
            (r.newDocumentState.syncStatus === "pending" ||
              (typeof r.newDocumentState.id === "string" &&
                r.newDocumentState.id.startsWith("TEMP-")))
        );

        if (pendingRows.length === 0) {
          return [];
        }

        const body = pendingRows.map((row) => ({
          newDocumentState: toWireDoc(row.newDocumentState),
          assumedMasterState: row?.assumedMasterState
            ? toWireDoc(row.assumedMasterState)
            : undefined,
        }));

        let res: Response;
        try {
          res = await fetch("/api/sync/patients/push", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ rows: body }),
          });
        } catch {
          // Network offline / fetch failed — throw so RxDB keeps pending rows in queue to retry
          throw new Error("Push network error - will retry");
        }

        if (!res.ok) {
          throw new Error(`Push failed with status ${res.status}`);
        }

        let json: {
          conflicts?: unknown[];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          created?: Array<{ tempId: string; patient: any }>;
        };
        try {
          json = await res.json();
        } catch {
          return [];
        }

        // 1. Reconcile newly created offline patients (replace TEMP-xxx with real server doc)
        if (Array.isArray(json.created) && json.created.length > 0) {
          for (const item of json.created) {
            if (item?.tempId && item?.patient) {
              const p = item.patient;
              try {
                // Remove the local TEMP doc
                const tempDoc = await collection.findOne(item.tempId).exec();
                if (tempDoc) {
                  await tempDoc.remove();
                }
                // Insert the new synced doc with MongoDB _id and PT-xxxxxx sequence ID
                await collection.upsert({
                  id: p._id,
                  syncStatus: "synced" as const,
                  serverPatientId: p.patientId,
                  _deleted: false,
                  patientId: p.patientId,
                  firstName: p.firstName,
                  lastName: p.lastName,
                  gender: p.gender,
                  dateOfBirth: p.dateOfBirth,
                  phone: p.phone,
                  email: p.email,
                  cnic: p.cnic,
                  bloodGroup: p.bloodGroup,
                  status: p.status ?? "active",
                  notes: p.notes,
                  registeredBy: p.registeredBy,
                  createdAt: new Date(p.createdAt).getTime(),
                  updatedAt: new Date(p.updatedAt).getTime(),
                  address: p.address ? JSON.stringify(p.address) : undefined,
                  emergencyContact: p.emergencyContact
                    ? JSON.stringify(p.emergencyContact)
                    : undefined,
                  allergies:
                    Array.isArray(p.allergies) && p.allergies.length > 0
                      ? JSON.stringify(p.allergies)
                      : undefined,
                  chronicDiseases:
                    Array.isArray(p.chronicDiseases) && p.chronicDiseases.length > 0
                      ? JSON.stringify(p.chronicDiseases)
                      : undefined,
                  insuranceDetails: p.insuranceDetails
                    ? JSON.stringify(p.insuranceDetails)
                    : undefined,
                });
              } catch (err) {
                console.error("Failed to reconcile temp patient doc:", err);
              }
            }
          }
        }

        // 2. Mark existing non-temp pushed rows as 'synced' in local RxDB
        for (const row of pendingRows) {
          const docId = row?.newDocumentState?.id;
          if (docId && !docId.startsWith("TEMP-")) {
            try {
              const localDoc = await collection.findOne(docId).exec();
              if (localDoc && localDoc.syncStatus === "pending") {
                await localDoc.incrementalPatch({ syncStatus: "synced" as const });
              }
            } catch {
              // Non-fatal
            }
          }
        }

        // 3. Mark conflicting rows in local RxDB so they display the amber badge
        if (Array.isArray(json.conflicts) && json.conflicts.length > 0) {
          for (const conflict of json.conflicts as any[]) {
            const conflictId = conflict._id || conflict.tempId;
            if (conflictId) {
              try {
                const localDoc = await collection.findOne(conflictId).exec();
                if (localDoc) {
                  await localDoc.incrementalPatch({ syncStatus: "conflict" as const });
                }
              } catch {
                // Non-fatal
              }
            }
          }
        }

        return [];
      },
      batchSize: 25,
    },
  });

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      repState.reSync();
    });

    window.addEventListener("offline", () => {
      repState.pause();
    });
  }

  return repState;
}
