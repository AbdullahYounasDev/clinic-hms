import { NextRequest } from "next/server";
import { requirePatientSession } from "@/lib/auth/require-portal";
import connectDB from "@/lib/db/mongoose";
import { Invoice } from "@/models/operations.model";
import { apiSuccess, getPaginationParams, buildPagination } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const authResult = await requirePatientSession();
  if (authResult.error) return authResult.error;

  await connectDB();
  const sp = req.nextUrl.searchParams;
  const { page, limit, skip } = getPaginationParams(sp);

  const filter = {
    patient: authResult.patientId,
    status: { $nin: ["cancelled", "refunded"] },
  };

  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Invoice.countDocuments(filter),
  ]);

  return apiSuccess(invoices, "Invoices fetched", 200, buildPagination(total, page, limit));
}
