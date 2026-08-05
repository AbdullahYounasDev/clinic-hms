import bcrypt from "bcryptjs";
import connectDB from "@/lib/db/mongoose";
import { Patient } from "@/models/clinical.model";
import { User } from "@/models/user.model";

const BCRYPT_ROUNDS = 12;

export async function hashPatientPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function validatePatientPortalEmail(
  email: string,
  excludePatientId?: string
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return "Email is required for portal access";

  await connectDB();

  const staffConflict = await User.findOne({ email: normalized }).lean();
  if (staffConflict) return "This email is already used by a staff account";

  const patientFilter: Record<string, unknown> = {
    email: normalized,
    portalEnabled: true,
    status: "active",
  };
  if (excludePatientId) patientFilter._id = { $ne: excludePatientId };

  const patientConflict = await Patient.findOne(patientFilter).lean();
  if (patientConflict) return "This email is already used by another patient portal";

  return null;
}

export async function findPortalPatientByLogin(loginOrEmail: string) {
  const normalized = loginOrEmail.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;

  await connectDB();

  return Patient.findOne({
    email: normalized,
    portalEnabled: true,
  })
    .select("+password")
    .lean();
}

export function buildPatientPortalFields(password: string) {
  return {
    portalEnabled: true,
    mustChangePassword: true,
  };
}
