export function getResourcePatientId(patientField: unknown): string | null {
  if (!patientField) return null;
  if (typeof patientField === "string") return patientField;
  if (typeof patientField === "object" && patientField !== null && "_id" in patientField) {
    return String((patientField as { _id: unknown })._id);
  }
  return null;
}

export function patientOwnsResource(sessionPatientId: string, patientField: unknown): boolean {
  const resourcePatientId = getResourcePatientId(patientField);
  return resourcePatientId === sessionPatientId;
}
