import dns from "dns/promises";

try {
  dns.setServers([
    "8.8.8.8",
    "8.8.4.4"
  ]);
} catch {}

export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Poppins } from "next/font/google";
import { Toaster } from "sonner";
import { SidebarProvider } from "@/components/sidebar-context";
import { ThemeProvider } from "next-themes";
import { NEXT_PUBLIC_CLINIC_NAME, NEXT_PUBLIC_CLINIC_TAGLINE, NEXT_PUBLIC_LOGO_URL, NEXT_PUBLIC_THEME_COLOR } from "@/constants/ClinicDetails";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

import connectDB from "@/lib/db/mongoose";
import { Settings } from "@/models/operations.model";

async function getClinicInfo() {
  const fallback = {
    name: NEXT_PUBLIC_CLINIC_NAME || "ClinicHMS",
    tagline: NEXT_PUBLIC_CLINIC_TAGLINE || "Hospital Management System",
    logo: NEXT_PUBLIC_LOGO_URL || "/logo.png",
    clinicAddress: "123 Healthcare Avenue, Medical District",
    phone: "+92 300 1234567",
    email: "info@clinichms.com",
    clinicType: "clinic",
    timezone: "Asia/Karachi",
    workingDays: [
      { day: "Monday", openingTime: "08:00 AM", breakStart: "01:00 PM", breakEnd: "02:00 PM", closingTime: "05:00 PM", isOpen: true },
      { day: "Tuesday", openingTime: "08:00 AM", breakStart: "01:00 PM", breakEnd: "02:00 PM", closingTime: "05:00 PM", isOpen: true },
      { day: "Wednesday", openingTime: "08:00 AM", breakStart: "01:00 PM", breakEnd: "02:00 PM", closingTime: "05:00 PM", isOpen: true },
      { day: "Thursday", openingTime: "08:00 AM", breakStart: "01:00 PM", breakEnd: "02:00 PM", closingTime: "05:00 PM", isOpen: true },
      { day: "Friday", openingTime: "08:00 AM", breakStart: "01:00 PM", breakEnd: "02:00 PM", closingTime: "05:00 PM", isOpen: true },
    ],
    closingDays: [] as unknown[],
  };
  try {
    await connectDB();
    const settings = await Settings.findOne({}).select(
      "clinicName clinicTagline logo logoPublicId clinicAddress phone email clinicType timezone workingDays closingDays"
    ).lean();
    if (!settings) return fallback;
    return {
      name: settings.clinicName || fallback.name,
      tagline: settings.clinicTagline || fallback.tagline,
      logo: settings.logo || fallback.logo,
      logoPublicId: settings.logoPublicId || "",
      clinicAddress: settings.clinicAddress || fallback.clinicAddress,
      phone: settings.phone || fallback.phone,
      email: settings.email || fallback.email,
      clinicType: settings.clinicType || fallback.clinicType,
      timezone: settings.timezone || fallback.timezone,
      workingDays: (settings.workingDays && settings.workingDays.length > 0)
        ? settings.workingDays
        : fallback.workingDays,
      closingDays: settings.closingDays || [],
    };
  } catch {
    return fallback;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const clinic = await getClinicInfo();

  return {
    title: {
      template: `%s | ${clinic.name}`,
      default: `${clinic.name} — ${clinic.tagline}`,
    },
    description: clinic.tagline,
    applicationName: clinic.name,
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: clinic.name,
    },
    themeColor: NEXT_PUBLIC_THEME_COLOR,
    robots: "noindex, nofollow",
  };
}

const CLINIC_NAME = NEXT_PUBLIC_CLINIC_NAME || "ClinicHMS";
const LOGO_URL = NEXT_PUBLIC_LOGO_URL || "/logo.png";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const clinic = await getClinicInfo();
  const activeLogo = clinic.logo || LOGO_URL;
  const activeName = clinic.name || CLINIC_NAME;

  // Serialize through JSON to strip all Mongoose-specific types (ObjectId, Buffer, etc.)
  // that cannot cross the Server→Client Component boundary.
  // This converts workingDays._id / closingDays._id ObjectIds into plain strings (or removes them).
  const rawClinic = clinic as Record<string, unknown>;
  const publicSettings = JSON.parse(JSON.stringify({
    clinicName: clinic.name,
    clinicTagline: clinic.tagline,
    logo: clinic.logo,
    logoPublicId: rawClinic.logoPublicId as string || "",
    clinicAddress: rawClinic.clinicAddress as string || "",
    phone: rawClinic.phone as string || "",
    email: rawClinic.email as string || "",
    clinicType: rawClinic.clinicType as string || "clinic",
    timezone: rawClinic.timezone as string || "Asia/Karachi",
    // Strip _id from each subdocument so only plain fields cross the boundary
    workingDays: ((rawClinic.workingDays as Record<string, unknown>[] | undefined) || []).map(
      ({ _id, ...day }) => day
    ),
    closingDays: ((rawClinic.closingDays as Record<string, unknown>[] | undefined) || []).map(
      ({ _id, ...cd }) => cd
    ),
  })) as import("@/components/providers/clinic-provider").ClinicSettings;

  return (
    <html lang="en" className={poppins.variable}>
      <head>
        {activeLogo && <link rel="icon" href={activeLogo} />}
        {activeLogo && <link rel="shortcut icon" href={activeLogo} />}
        {activeLogo && <link rel="apple-touch-icon" href={activeLogo} />}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content={activeName} />
        <meta name="theme-color" content={NEXT_PUBLIC_THEME_COLOR} />
        <script dangerouslySetInnerHTML={{
          __html: `
    (function() {
      try {
        if (localStorage.getItem("theme") === "dark") {
          document.documentElement.classList.add("dark");
        }
      } catch (e) {}
    })();
  `,
        }} />
      </head>
      <body className="antialiased">
        <RegisterServiceWorker />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <SidebarProvider>
            {/* Pass server-fetched clinic settings as a prop so ClinicProvider
                gets real DB data on first render — no script injection needed */}
            <Providers initialClinicSettings={publicSettings}>{children}</Providers>
            <Toaster
              position="top-right"
              expand={false}
              richColors
              closeButton
              toastOptions={{
                style: {
                  background: '#0d9488',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  fontSize: '14px',
                },
              }}
            />
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}