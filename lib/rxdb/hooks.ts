"use client";
/**
 * React hooks for the RxDB patients collection.
 *
 * `usePatientDb()` — returns the initialised DB + patients collection.
 * `usePatients(query)` — reactive patient list with RxDB subscription.
 * `useSyncStatus()` — returns active replication state counts.
 *
 * Note: These hooks must only be used inside a Client Component.
 * The DB is initialised lazily on first call and is shared via module-level state.
 */

import { useEffect, useState, useCallback } from "react";
import type { RxCollection, MangoQuery } from "rxdb";
import { getDb, type ClinicDB } from "./database";
import { startPatientSync } from "./patient-sync";
import type { LocalPatient, PatientSyncStatus } from "./schema";

// ── Module-level singletons (shared across hook instances) ────────────────────
let _dbInstance: ClinicDB | null = null;
let _dbInitPromise: Promise<ClinicDB> | null = null;

async function ensureDb(): Promise<ClinicDB> {
  if (_dbInstance) return _dbInstance;
  if (_dbInitPromise) return _dbInitPromise;
  _dbInitPromise = getDb().then((db) => {
    _dbInstance = db;
    return db;
  });
  return _dbInitPromise;
}

// ── Boot sync once per browser session ───────────────────────────────────────
let _syncStarted = false;

function maybeStartSync(collection: RxCollection<LocalPatient>) {
  if (_syncStarted) return;
  _syncStarted = true;

  const state = startPatientSync(collection);

  // Log unexpected errors in dev (ignore expected offline pause state)
  if (process.env.NODE_ENV !== "production") {
    state.error$.subscribe((err: unknown) => {
      const msg = typeof err === "object" && err !== null ? (err as { message?: string }).message || "" : String(err);
      if (!msg.includes("Offline") && !msg.includes("paused")) {
        console.error("[RxDB sync error]", err);
      }
    });
  }
}

// ── usePatientDb ──────────────────────────────────────────────────────────────
/** Returns the patients RxCollection once the DB is ready. */
export function usePatientDb() {
  const [collection, setCollection] = useState<RxCollection<LocalPatient> | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureDb().then((db) => {
      if (!cancelled) {
        const col = db.collections.patients;
        setCollection(col);
        maybeStartSync(col);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return collection;
}

// ── usePatients ───────────────────────────────────────────────────────────────
export type UsePatientOptions = {
  search?: string;
  status?: string;
  limit?: number;
};

export function usePatients(opts: UsePatientOptions = {}) {
  const { search = "", status = "", limit = 200 } = opts;
  const collection = usePatientDb();
  const [patients, setPatients] = useState<LocalPatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!collection) return;

    const selector: MangoQuery<LocalPatient>["selector"] = {
      _deleted: { $eq: false },
    };

    if (status) {
      selector.status = { $eq: status as LocalPatient["status"] };
    }

    const query = collection.find({
      selector,
      limit,
      sort: [{ updatedAt: "desc" }],
    });

    const sub = query.$.subscribe((docs) => {
      let results = docs.map((d) => d.toJSON());

      // Client-side text search across name / phone / CNIC / email / patientId
      if (search.trim()) {
        const lower = search.toLowerCase();
        results = results.filter(
          (p) =>
            p.firstName.toLowerCase().includes(lower) ||
            p.lastName.toLowerCase().includes(lower) ||
            (p.phone ?? "").includes(lower) ||
            (p.cnic ?? "").includes(lower) ||
            (p.email ?? "").toLowerCase().includes(lower) ||
            p.patientId.toLowerCase().includes(lower)
        );
      }

      setPatients(results);
      setIsLoading(false);
    });

    return () => sub.unsubscribe();
  }, [collection, search, status, limit]);

  return { patients, isLoading };
}

// ── useSyncStatusCounts ───────────────────────────────────────────────────────
export type SyncCounts = {
  pending: number;
  conflict: number;
};

export function useSyncStatusCounts(): SyncCounts {
  const collection = usePatientDb();
  const [counts, setCounts] = useState<SyncCounts>({ pending: 0, conflict: 0 });

  useEffect(() => {
    if (!collection) return;

    const pendingSub = collection
      .find({ selector: { syncStatus: "pending", _deleted: false } })
      .$.subscribe((docs) =>
        setCounts((prev) => ({ ...prev, pending: docs.length }))
      );

    const conflictSub = collection
      .find({ selector: { syncStatus: "conflict", _deleted: false } })
      .$.subscribe((docs) =>
        setCounts((prev) => ({ ...prev, conflict: docs.length }))
      );

    return () => {
      pendingSub.unsubscribe();
      conflictSub.unsubscribe();
    };
  }, [collection]);

  return counts;
}

// ── useUpsertPatient ──────────────────────────────────────────────────────────
/** Wraps collection.upsert so callers don't have to handle the collection null case. */
export function useUpsertPatient() {
  const collection = usePatientDb();

  const upsert = useCallback(
    async (doc: LocalPatient) => {
      if (!collection) throw new Error("DB not ready");
      await collection.upsert(doc);
    },
    [collection]
  );

  return { upsert, ready: !!collection };
}

// ── helpers ───────────────────────────────────────────────────────────────────
/** Generate a TEMP offline ID */
export function generateTempId(): string {
  return `TEMP-${crypto.randomUUID()}`;
}

export type { LocalPatient, PatientSyncStatus };
