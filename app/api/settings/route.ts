import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Settings } from "@/models/operations.model";
import { apiSuccess, apiError } from "@/lib/utils";
import { updateSettingsSchema } from "@/lib/validations";
import { auditLog, hasPermission } from "@/lib/auth/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_SETTINGS = {
  clinicName: "ClinicHMS",
  clinicTagline: "Hospital Management System",
  clinicType: "clinic",
  logo: "/logo.png",
  logoPublicId: "",
  clinicAddress: "123 Healthcare Avenue, Medical District",
  phone: "+92 300 1234567",
  email: "info@clinichms.com",
  workingDays: [
    { day: "Monday", openingTime: "08:00", breakStart: "13:00", breakEnd: "14:00", closingTime: "17:00", isOpen: true },
    { day: "Tuesday", openingTime: "08:00", breakStart: "13:00", breakEnd: "14:00", closingTime: "17:00", isOpen: true },
    { day: "Wednesday", openingTime: "08:00", breakStart: "13:00", breakEnd: "14:00", closingTime: "17:00", isOpen: true },
    { day: "Thursday", openingTime: "08:00", breakStart: "13:00", breakEnd: "14:00", closingTime: "17:00", isOpen: true },
    { day: "Friday", openingTime: "08:00", breakStart: "13:00", breakEnd: "14:00", closingTime: "17:00", isOpen: true },
  ],
  closingDays: [],
};

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "settings", "view")) {
    return apiError("Forbidden", 403);
  }
  await connectDB();
  const settings = await Settings.findOne({}).lean();
  return apiSuccess(settings || DEFAULT_SETTINGS);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "settings", "update")) {
    return apiError("Forbidden", 403);
  }
  const body = await req.json();
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);
  await connectDB();
  const settings = await Settings.findOneAndUpdate({}, { ...parsed.data, updatedBy: session.user.id }, { upsert: true, new: true }).lean();
  await auditLog({ userId: session.user.id, action: "update", module: "settings", description: "Updated clinic settings" });
  return apiSuccess(settings, "Settings updated");
}
