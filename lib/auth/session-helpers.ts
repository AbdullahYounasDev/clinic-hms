import type { Session } from "next-auth";

export type AccountType = "staff" | "patient";

export function getAccountType(session: Session | null): AccountType {
  return (session?.user?.accountType as AccountType) || "staff";
}

export function isPatientSession(session: Session | null): boolean {
  return getAccountType(session) === "patient";
}

export function isStaffSession(session: Session | null): boolean {
  return getAccountType(session) === "staff";
}
