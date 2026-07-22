import { NextRequest } from "next/server";
import { requirePatientSession } from "@/lib/auth/require-portal";
import connectDB from "@/lib/db/mongoose";
import { EMR } from "@/models/clinical.model";
import { apiSuccess, getPaginationParams, buildPagination } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const authResult = await requirePatientSession();
  if (authResult.error) return authResult.error;

  await connectDB();
  const sp = req.nextUrl.searchParams;
  const { page, limit, skip } = getPaginationParams(sp);

  const filter = { patient: authResult.patientId, status: { $ne: "archived" } };

  const [records, total] = await Promise.all([
    EMR.find(filter)
      .populate({ path: "doctor", populate: { path: "user", select: "firstName lastName" } })
      .sort({ visitDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    EMR.countDocuments(filter),
  ]);

  return apiSuccess(records, "Medical records fetched", 200, buildPagination(total, page, limit));
}
