import { NextRequest } from "next/server";
import connectDB from "@/lib/db/mongoose";
import { Settings } from "@/models/operations.model";
import { apiSuccess } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_PUBLIC_SETTINGS = {
  clinicName: "ClinicHMS",
  clinicTagline: "Hospital Management System",
  clinicType: "clinic",
  logo: "/logo.png",
  logoPublicId: "",
  clinicAddress: "123 Healthcare Avenue, Medical District",
  phone: "+92 300 1234567",
  email: "info@clinichms.com",
  workingDays: [
    { day: "Monday", openingTime: "08:00 AM", breakStart: "01:00 PM", breakEnd: "02:00 PM", closingTime: "05:00 PM", isOpen: true },
    { day: "Tuesday", openingTime: "08:00 AM", breakStart: "01:00 PM", breakEnd: "02:00 PM", closingTime: "05:00 PM", isOpen: true },
    { day: "Wednesday", openingTime: "08:00 AM", breakStart: "01:00 PM", breakEnd: "02:00 PM", closingTime: "05:00 PM", isOpen: true },
    { day: "Thursday", openingTime: "08:00 AM", breakStart: "01:00 PM", breakEnd: "02:00 PM", closingTime: "05:00 PM", isOpen: true },
    { day: "Friday", openingTime: "08:00 AM", breakStart: "01:00 PM", breakEnd: "02:00 PM", closingTime: "05:00 PM", isOpen: true },
  ],
  closingDays: [],
};

export async function GET(_req: NextRequest) {
  try {
    await connectDB();
    const settings = await Settings.findOne({}).select(
      "clinicName clinicTagline clinicType logo logoPublicId clinicAddress phone email workingDays closingDays"
    ).lean();

    if (!settings) {
      return apiSuccess(DEFAULT_PUBLIC_SETTINGS);
    }

    return apiSuccess({
      clinicName: settings.clinicName || DEFAULT_PUBLIC_SETTINGS.clinicName,
      clinicTagline: settings.clinicTagline || DEFAULT_PUBLIC_SETTINGS.clinicTagline,
      clinicType: settings.clinicType || DEFAULT_PUBLIC_SETTINGS.clinicType,
      logo: settings.logo || DEFAULT_PUBLIC_SETTINGS.logo,
      logoPublicId: settings.logoPublicId || "",
      clinicAddress: settings.clinicAddress || DEFAULT_PUBLIC_SETTINGS.clinicAddress,
      phone: settings.phone || DEFAULT_PUBLIC_SETTINGS.phone,
      email: settings.email || DEFAULT_PUBLIC_SETTINGS.email,
      workingDays: settings.workingDays && settings.workingDays.length > 0 ? settings.workingDays : DEFAULT_PUBLIC_SETTINGS.workingDays,
      closingDays: settings.closingDays || [],
    });
  } catch {
    return apiSuccess(DEFAULT_PUBLIC_SETTINGS);
  }
}
