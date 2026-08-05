import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Patient } from "@/models/clinical.model";
import { apiSuccess, apiError } from "@/lib/utils";
import { hasPermission } from "@/lib/auth/audit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "patients", "view")) {
    return apiError("Forbidden", 403);
  }

  const phone = req.nextUrl.searchParams.get("phone")?.trim();
  const excludeId = req.nextUrl.searchParams.get("excludeId")?.trim();

  if (!phone || phone.length < 5) {
    return apiSuccess({ isDuplicate: false, matches: [] });
  }

  await connectDB();

  // Strip non-digits or query normalized phone
  const cleanPhone = phone.replace(/\D/g, "");
  const filter: Record<string, unknown> = {
    $or: [
      { phone: phone },
      { phone: { $regex: cleanPhone, $options: "i" } },
    ],
    status: { $ne: "archived" },
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  const matches = await Patient.find(filter)
    .select("_id patientId firstName lastName status")
    .limit(5)
    .lean();

  if (matches.length === 0) {
    return apiSuccess({ isDuplicate: false, matches: [] });
  }

  const safeMatches = matches.map((m) => ({
    _id: m._id.toString(),
    patientId: m.patientId,
    name: `${m.firstName} ${m.lastName}`,
    status: m.status,
  }));

  return apiSuccess({ isDuplicate: true, matches: safeMatches });
}
