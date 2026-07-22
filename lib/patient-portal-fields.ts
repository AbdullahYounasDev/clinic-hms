import {
  hashPatientPassword,
  validatePatientPortalEmail,
} from "@/lib/auth/patient-portal";

export async function resolvePatientPortalFields(
  body: Record<string, unknown>,
  excludePatientId?: string
): Promise<{ data: Record<string, unknown>; error?: string }> {
  const portalPassword = body.portalPassword as string | undefined;
  const portalEnabled = body.portalEnabled as boolean | undefined;
  const cleaned = { ...body };
  delete cleaned.portalPassword;

  if (portalPassword) {
    const email = (cleaned.email as string | undefined)?.trim();
    if (!email) {
      return { data: cleaned, error: "Email is required when assigning a portal password" };
    }
    const emailError = await validatePatientPortalEmail(email, excludePatientId);
    if (emailError) return { data: cleaned, error: emailError };

    cleaned.password = await hashPatientPassword(portalPassword);
    cleaned.portalEnabled = true;
    cleaned.mustChangePassword = true;
  } else if (portalEnabled === false) {
    cleaned.portalEnabled = false;
    cleaned.mustChangePassword = false;
  }

  return { data: cleaned };
}
