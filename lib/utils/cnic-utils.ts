/**
 * Utility functions for Pakistan CNIC (Computerized National Identity Card) processing.
 * Standard format: 13 digits, formatted as XXXXX-XXXXXXX-X (e.g., 34104-2611716-1).
 */

/**
 * Strips all non-digit characters and limits output to at most 13 digits.
 */
export function normalizeCNIC(input?: string | null): string {
  if (!input) return "";
  return input.replace(/\D/g, "").slice(0, 13);
}

/**
 * Formats a raw or partial CNIC string into standard XXXXX-XXXXXXX-X format.
 */
export function formatCNIC(input?: string | null): string {
  const digits = normalizeCNIC(input);
  if (!digits) return "";

  if (digits.length <= 5) {
    return digits;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
}

/**
 * Validates whether CNIC is either completely empty OR contains exactly 13 numeric digits.
 */
export function isValidCNIC(input?: string | null): boolean {
  if (!input || !input.trim()) return true;
  const digits = normalizeCNIC(input);
  return digits.length === 13;
}
