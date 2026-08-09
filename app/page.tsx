import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth.config";
import { isPatientSession } from "@/lib/auth/session-helpers";
import "@/app/globals.css";

export default async function RootPage() {
  const session = await auth();
  if (!session) redirect("/patient/login");
  if (isPatientSession(session)) redirect("/portal");
  redirect("/dashboard");
}
