import { auth } from "@/lib/auth/auth.config";
import { redirect } from "next/navigation";
import { isPatientSession } from "@/lib/auth/session-helpers";
import { PortalShell } from "@/components/portal/portal-shell";
import { PortalSidebarProvider } from "@/components/portal/portal-sidebar-context";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/patient/login");
  if (!isPatientSession(session)) redirect("/dashboard");

  return (
    <PortalSidebarProvider>
      <PortalShell session={session}>{children}</PortalShell>
    </PortalSidebarProvider>
  );
}
