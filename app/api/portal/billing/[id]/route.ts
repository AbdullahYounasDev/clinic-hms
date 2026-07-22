import { NextRequest } from "next/server";
import { requirePatientSession } from "@/lib/auth/require-portal";
import connectDB from "@/lib/db/mongoose";
import { Invoice } from "@/models/operations.model";
import { apiSuccess, apiError } from "@/lib/utils";
import { patientOwnsResource } from "@/lib/portal/assert-patient-resource";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const authResult = await requirePatientSession();
  if (authResult.error) return authResult.error;

  await connectDB();
  const { id } = await params;

  const invoice = await Invoice.findById(id)
    .populate("patient", "firstName lastName patientId phone email address")
    .populate("doctor", "firstName lastName")
    .populate("items.medicine", "name genericName unit")
    .populate("createdBy", "firstName lastName")
    .populate("payments.receivedBy", "firstName lastName")
    .lean();

  if (!invoice) return apiError("Invoice not found", 404);
  if (invoice.status === "cancelled" || invoice.status === "refunded") {
    return apiError("Invoice not found", 404);
  }
  if (!patientOwnsResource(authResult.patientId, invoice.patient)) {
    return apiError("Forbidden", 403);
  }

  return apiSuccess(invoice);
}
