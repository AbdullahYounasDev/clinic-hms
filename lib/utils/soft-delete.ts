type QueryFilter = Record<string, unknown>;

/** Patient: default active only; explicit ?status= still allowed */
export function applyPatientStatusFilter(filter: QueryFilter, statusParam?: string | null) {
  if (statusParam) {
    filter.status = statusParam;
  } else {
    filter.status = "active";
  }
}

/** User/staff: default active only */
export function applyUserStatusFilter(filter: QueryFilter, statusParam?: string | null) {
  if (statusParam) {
    filter.status = statusParam;
  } else {
    filter.status = "active";
  }
}

/** Entities with isActive flag (medicine, supplier, lab catalog, inventory, role) */
export function applyIsActiveFilter(filter: QueryFilter, isActiveParam?: string | null) {
  if (isActiveParam !== undefined && isActiveParam !== null && isActiveParam !== "") {
    filter.isActive = isActiveParam === "true";
  } else {
    filter.isActive = true;
  }
}

/** Doctor / EMR records with status active | archived */
export function applyRecordStatusFilter(filter: QueryFilter, statusParam?: string | null) {
  if (statusParam) {
    filter.status = statusParam;
  } else {
    filter.status = { $ne: "archived" };
  }
}

/** Invoice lists: hide cancelled/refunded unless ?status= passed */
export function applyInvoiceStatusFilter(filter: QueryFilter, statusParam?: string | null) {
  if (statusParam) {
    filter.status = statusParam;
  } else {
    filter.status = { $nin: ["cancelled", "refunded"] };
  }
}

/** Lab orders: hide cancelled unless ?status= passed */
export function applyLabTestStatusFilter(filter: QueryFilter, statusParam?: string | null) {
  if (statusParam) {
    filter.status = statusParam;
  } else {
    filter.status = { $ne: "cancelled" };
  }
}

/** Appointments: hide archived unless ?status= passed */
export function applyAppointmentStatusFilter(filter: QueryFilter, statusParam?: string | null) {
  if (statusParam === "in_queue" || statusParam === "queue") {
    filter.status = { $in: ["scheduled", "checked_in"] };
  } else if (statusParam === "all" || statusParam === "all_statuses") {
    filter.status = { $ne: "archived" };
  } else if (statusParam) {
    filter.status = { $in: statusParam.split(",") };
  } else {
    filter.status = { $ne: "archived" };
  }
}

/** Patient reports: hide archived unless ?status= passed */
export function applyReportStatusFilter(filter: QueryFilter, statusParam?: string | null) {
  if (statusParam) {
    filter.status = statusParam;
  } else {
    filter.status = { $ne: "archived" };
  }
}

/** Prescriptions: hide cancelled/archived unless ?status= passed */
export function applyPrescriptionStatusFilter(filter: QueryFilter, statusParam?: string | null) {
  if (statusParam) {
    filter.status = statusParam;
  } else {
    filter.status = { $nin: ["cancelled", "archived"] };
  }
}

export function isArchivedPatient(status?: string | null) {
  return status === "archived";
}

export function isArchivedStatus(status?: string | null) {
  return status === "archived";
}

export function isInactiveRecord(record?: { status?: string | null; isActive?: boolean | null } | null) {
  if (!record) return true;
  if (record.status === "archived") return true;
  if (record.isActive === false) return true;
  return false;
}
