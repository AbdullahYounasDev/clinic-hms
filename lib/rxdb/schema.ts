/**
 * RxDB JSON Schema for the local `patients` collection.
 *
 * Rules:
 *  - Primary key is `id` (string). For synced records this equals the MongoDB _id hex.
 *    For offline-created records it is `TEMP-<nanoid>` until pushed and confirmed.
 *  - `updatedAt` is a number (Unix ms). Used as the pull cursor.
 *  - `syncStatus` is a client-only field never sent to the server.
 *  - `_deleted` is the RxDB soft-delete flag (boolean).
 */

import type { RxJsonSchema } from "rxdb";

export type PatientSyncStatus = "synced" | "pending" | "conflict";

export type LocalPatient = {
  // ── Primary key ───────────────────────────────────────────
  id: string; // MongoDB _id hex OR "TEMP-<nanoid>"

  // ── Sync metadata (client-only) ───────────────────────────
  syncStatus: PatientSyncStatus;
  serverPatientId?: string; // real sequential PT-xxxxxx (null for TEMP records)

  // ── RxDB soft-delete ──────────────────────────────────────
  _deleted: boolean;

  // ── Core patient fields (mirrors IPatient from clinical.model.ts) ──
  patientId: string; // PT-xxxxxx OR "TEMP-<nanoid>" (same as id for TEMP)
  firstName: string;
  lastName: string;
  gender: "male" | "female" | "other";
  dateOfBirth: string; // ISO-8601 date string "YYYY-MM-DD"
  phone?: string;
  email?: string;
  cnic?: string;
  bloodGroup?: string;
  status: "active" | "archived" | "deceased";
  notes?: string;
  registeredBy?: string; // User _id string

  // ── Timestamps ─────────────────────────────────────────────
  createdAt: number; // Unix ms
  updatedAt: number; // Unix ms (pull cursor)

  // ── Optional sub-documents (stored as JSON strings to satisfy RxDB) ──
  address?: string; // JSON.stringify({ street, city, state, country, postalCode })
  emergencyContact?: string; // JSON.stringify({ name, relationship, phone, email })
  allergies?: string; // JSON.stringify(string[])
  chronicDiseases?: string; // JSON.stringify(string[])
  insuranceDetails?: string; // JSON.stringify({ provider, policyNumber, ... })
};

export const PATIENT_SCHEMA_VERSION = 0;

export const patientSchema: RxJsonSchema<LocalPatient> = {
  version: PATIENT_SCHEMA_VERSION,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 128 },

    // sync
    syncStatus: {
      type: "string",
      enum: ["synced", "pending", "conflict"],
      default: "pending",
      maxLength: 32,
    },
    serverPatientId: { type: "string" },
    _deleted: { type: "boolean", default: false },

    // core
    patientId: { type: "string", maxLength: 100 },
    firstName: { type: "string" },
    lastName: { type: "string" },
    gender: { type: "string", enum: ["male", "female", "other"] },
    dateOfBirth: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
    cnic: { type: "string" },
    bloodGroup: { type: "string" },
    status: {
      type: "string",
      enum: ["active", "archived", "deceased"],
      default: "active",
      maxLength: 32,
    },
    notes: { type: "string" },
    registeredBy: { type: "string" },

    // timestamps
    createdAt: { type: "number" },
    updatedAt: {
      type: "number",
      minimum: 0,
      maximum: 99999999999999,
      multipleOf: 1,
    },

    // sub-documents as JSON strings
    address: { type: "string" },
    emergencyContact: { type: "string" },
    allergies: { type: "string" },
    chronicDiseases: { type: "string" },
    insuranceDetails: { type: "string" },
  },
  required: ["id", "patientId", "firstName", "lastName", "gender", "dateOfBirth", "status", "syncStatus", "createdAt", "updatedAt"],
  indexes: ["updatedAt", "syncStatus", "status", "patientId"],
};
