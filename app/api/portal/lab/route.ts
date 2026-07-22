import { NextRequest } from "next/server";
import { requirePatientSession } from "@/lib/auth/require-portal";
import connectDB from "@/lib/db/mongoose";
import { LabTest } from "@/models/operations.model";
import { apiSuccess, getPaginationParams, buildPagination } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const authResult = await requirePatientSession();
  if (authResult.error) return authResult.error;

  await connectDB();
  const sp = req.nextUrl.searchParams;
  const { page, limit, skip } = getPaginationParams(sp);

  const filter = { patient: authResult.patientId, status: { $ne: "cancelled" } };

  const [tests, total] = await Promise.all([
    LabTest.find(filter)
      .populate("requestedBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LabTest.countDocuments(filter),
  ]);

  return apiSuccess(tests, "Lab tests fetched", 200, buildPagination(total, page, limit));
}
