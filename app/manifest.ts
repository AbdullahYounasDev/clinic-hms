import type { MetadataRoute } from "next";
import connectDB from "@/lib/db/mongoose";

export const dynamic = "force-dynamic";
import { Settings } from "@/models/operations.model";
import {
  NEXT_PUBLIC_CLINIC_NAME,
  NEXT_PUBLIC_CLINIC_TAGLINE,
  NEXT_PUBLIC_LOGO_URL,
  NEXT_PUBLIC_THEME_COLOR,
  PWA_BACKGROUND_COLOR,
  PWA_START_URL,
  PWA_ICON_192_URL,
  PWA_ICON_512_URL,
} from "@/constants/ClinicDetails";

async function getClinicInfo() {
  try {
    await connectDB();
    const s = await Settings.findOne({}).select("clinicName clinicTagline logo").lean();
    return {
      name: s?.clinicName || NEXT_PUBLIC_CLINIC_NAME || "ClinicHMS",
      tagline: s?.clinicTagline || NEXT_PUBLIC_CLINIC_TAGLINE || "Hospital Management System",
      logo: s?.logo || NEXT_PUBLIC_LOGO_URL || "/logo.png",
    };
  } catch {
    return {
      name: NEXT_PUBLIC_CLINIC_NAME || "ClinicHMS",
      tagline: NEXT_PUBLIC_CLINIC_TAGLINE || "Hospital Management System",
      logo: NEXT_PUBLIC_LOGO_URL || "/logo.png",
    };
  }
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const clinic = await getClinicInfo();

  const icons: MetadataRoute.Manifest["icons"] = [
    {
      src: PWA_ICON_192_URL,
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: PWA_ICON_512_URL,
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: PWA_ICON_512_URL,
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ];

  if (clinic.logo) {
    icons.push({
      src: clinic.logo,
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    });
  }

  return {
    id: PWA_START_URL,
    name: `${clinic.name} — ${clinic.tagline}`,
    short_name: clinic.name,
    description: clinic.tagline,
    start_url: PWA_START_URL,
    scope: PWA_START_URL,
    display: "standalone",
    orientation: "portrait-primary",
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: NEXT_PUBLIC_THEME_COLOR,
    categories: ["medical", "health", "productivity"],
    icons,
  };
}
