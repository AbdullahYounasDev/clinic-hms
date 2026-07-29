import { NextRequest } from "next/server";
import { requirePatientSession } from "@/lib/auth/require-portal";
import connectDB from "@/lib/db/mongoose";
import { Doctor } from "@/models/clinical.model";
import { apiSuccess } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authResult = await requirePatientSession();
  if (authResult.error) return authResult.error;

  await connectDB();

  const doctors = await Doctor.find({ status: { $ne: "archived" }, isAvailable: true })
    .populate("user", "firstName lastName email phone avatar")
    .populate("department", "name code")
    .sort({ createdAt: -1 })
    .lean();

  return apiSuccess(doctors, "Portal doctors fetched");
}
