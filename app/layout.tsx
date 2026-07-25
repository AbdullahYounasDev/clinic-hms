import dns from "dns/promises";

dns.setServers([
  "8.8.8.8",
  "8.8.4.4"
]);

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
  try {
    await connectDB();
    const settings = await Settings.findOne({}).select("clinicName clinicTagline logo").lean();
    return {
      name: settings?.clinicName || NEXT_PUBLIC_CLINIC_NAME || "ClinicHMS",
      tagline: settings?.clinicTagline || NEXT_PUBLIC_CLINIC_TAGLINE || "Hospital Management System",
      logo: settings?.logo || NEXT_PUBLIC_LOGO_URL || "/logo.png",
    };
  } catch {
    return {
      name: NEXT_PUBLIC_CLINIC_NAME || "ClinicHMS",
      tagline: NEXT_PUBLIC_CLINIC_TAGLINE || "Hospital Management System",
      logo: NEXT_PUBLIC_LOGO_URL || "/logo.png",
    };
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
            <Providers>{children}</Providers>
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