import { NextRequest } from "next/server";
import { requirePatientSession } from "@/lib/auth/require-portal";
import connectDB from "@/lib/db/mongoose";
import { Prescription } from "@/models/clinical.model";
import { apiSuccess, getPaginationParams, buildPagination, applyPrescriptionStatusFilter } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const authResult = await requirePatientSession();
  if (authResult.error) return authResult.error;

  await connectDB();
  const sp = req.nextUrl.searchParams;
  const { page, limit, skip } = getPaginationParams(sp);

  const filter: Record<string, unknown> = { patient: authResult.patientId };
  applyPrescriptionStatusFilter(filter, "");

  const [prescriptions, total] = await Promise.all([
    Prescription.find(filter)
      .populate({ path: "doctor", populate: { path: "user", select: "firstName lastName" } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Prescription.countDocuments(filter),
  ]);

  return apiSuccess(prescriptions, "Prescriptions fetched", 200, buildPagination(total, page, limit));
}
