/**
 * RxDB singleton database for ClinicHMS.
 *
 * Uses the built-in Dexie (IndexedDB) storage. Called only in the browser;
 * guard every import site with a `typeof window !== "undefined"` check or
 * use dynamic import inside a `useEffect`.
 *
 * The module exports a single async function `getDb()` that initialises the
 * database once and returns the same instance on subsequent calls.
 */

import {
  createRxDatabase,
  addRxPlugin,
  type RxDatabase,
  type RxCollection,
} from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { RxDBLeaderElectionPlugin } from "rxdb/plugins/leader-election";
import { RxDBUpdatePlugin } from "rxdb/plugins/update";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { patientSchema, type LocalPatient } from "./schema";

// ── Plugin registration (idempotent) ─────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  addRxPlugin(RxDBDevModePlugin);
}
addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBUpdatePlugin);

// ── Types ─────────────────────────────────────────────────────────────────────
export type ClinicCollections = {
  patients: RxCollection<LocalPatient>;
};

export type ClinicDB = RxDatabase<ClinicCollections>;

// ── Singleton ────────────────────────────────────────────────────────────────
let _db: ClinicDB | null = null;
let _initPromise: Promise<ClinicDB> | null = null;

export async function getDb(): Promise<ClinicDB> {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    // In dev mode RxDB requires a schema-validating storage wrapper (DVM1).
    // In production use raw Dexie for performance.
    const baseStorage = getRxStorageDexie();
    const storage =
      process.env.NODE_ENV !== "production"
        ? wrappedValidateAjvStorage({ storage: baseStorage })
        : baseStorage;

    const db = await createRxDatabase<ClinicCollections>({
      name: "clinic_hms",
      storage,
      // Allow multiple tabs — leader election handles replication
      multiInstance: true,
      eventReduce: true,
      ignoreDuplicate: true,
    });

    await db.addCollections({
      patients: {
        schema: patientSchema,
      },
    });

    _db = db;
    return db;
  })();

  return _initPromise;
}

/** For test teardown and HMR reloads only. Never call in production flows. */
export async function destroyDb() {
  if (_db) {
    await _db.remove();
    _db = null;
    _initPromise = null;
  }
}
