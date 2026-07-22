import { NextRequest } from "next/server";
import { requirePatientSession } from "@/lib/auth/require-portal";
import connectDB from "@/lib/db/mongoose";
import { LabTest } from "@/models/operations.model";
import { Report } from "@/models/operations.model";
import { apiSuccess, apiError } from "@/lib/utils";
import { patientOwnsResource } from "@/lib/portal/assert-patient-resource";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const authResult = await requirePatientSession();
  if (authResult.error) return authResult.error;

  await connectDB();
  const { id } = await params;

  const test = await LabTest.findById(id)
    .populate("patient", "firstName lastName patientId dateOfBirth gender bloodGroup phone")
    .populate("requestedBy", "firstName lastName")
    .populate("approvedBy", "firstName lastName")
    .populate("tests.catalogId", "testName testCode category")
    .lean();

  if (!test) return apiError("Lab test not found", 404);
  if (test.status === "cancelled") return apiError("Lab test not found", 404);
  if (!patientOwnsResource(authResult.patientId, test.patient)) {
    return apiError("Forbidden", 403);
  }

  let report = null;
  if (["completed", "delivered"].includes(test.status)) {
    report = await Report.findOne({ labTest: id, status: { $ne: "archived" } })
      .sort({ createdAt: -1 })
      .lean();
  }

  return apiSuccess({ test, report });
}
