import Link from "next/link";
import connectDB from "@/lib/db/mongoose";
import { Settings } from "@/models/operations.model";
import {
  NEXT_PUBLIC_CLINIC_NAME,
  NEXT_PUBLIC_CLINIC_TAGLINE,
  NEXT_PUBLIC_THEME_COLOR,
} from "@/constants/ClinicDetails";

async function getClinicInfo() {
  try {
    await connectDB();
    const s = await Settings.findOne({}).select("clinicName clinicTagline").lean();
    return {
      name: s?.clinicName || NEXT_PUBLIC_CLINIC_NAME || "ClinicHMS",
      tagline: s?.clinicTagline || NEXT_PUBLIC_CLINIC_TAGLINE || "Hospital Management System",
    };
  } catch {
    return {
      name: NEXT_PUBLIC_CLINIC_NAME || "ClinicHMS",
      tagline: NEXT_PUBLIC_CLINIC_TAGLINE || "Hospital Management System",
    };
  }
}

export default async function OfflinePage() {
  const clinic = await getClinicInfo();

  return (
    <main
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: NEXT_PUBLIC_THEME_COLOR }}
    >
      <div className="max-w-md w-full rounded-2xl bg-white p-8 text-center shadow-xl">
        <h1 className="text-2xl font-bold text-gray-900">{clinic.name}</h1>
        <p className="mt-2 text-sm text-gray-600">{clinic.tagline}</p>
        <p className="mt-6 text-gray-700">You are offline. Reconnect to continue using the app.</p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: NEXT_PUBLIC_THEME_COLOR }}
        >
          Try again
        </Link>
      </div>
    </main>
  );
}
