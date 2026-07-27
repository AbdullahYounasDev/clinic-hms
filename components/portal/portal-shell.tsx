"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Session } from "next-auth";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  Clipboard,
  Pill,
  FlaskConical,
  Receipt,
  UserCircle,
  KeyRound,
  LogOut,
  Hospital,
  Menu,
  X,
  Sun,
  Moon,
} from "lucide-react";
import { usePortalSidebar } from "./portal-sidebar-context";
import { useState, useEffect } from "react";
import { useClinicSettings } from "@/components/providers/clinic-provider";

const NAV = [
  { label: "Overview", href: "/portal", icon: LayoutDashboard },
  { label: "Appointments", href: "/portal/appointments", icon: Calendar },
  { label: "Medical Records", href: "/portal/emr", icon: Clipboard },
  { label: "Prescriptions", href: "/portal/prescriptions", icon: Pill },
  { label: "Lab Tests", href: "/portal/lab", icon: FlaskConical },
  { label: "Billing", href: "/portal/billing", icon: Receipt },
  { label: "My Profile", href: "/portal/profile", icon: UserCircle },
  { label: "Change Password", href: "/portal/change-password", icon: KeyRound },
];

function PortalNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href ||
          (item.href !== "/portal" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
              active ? "bg-teal-50 text-teal-700" : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function PortalShell({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const { mobileOpen, setMobileOpen, toggleMobile } = usePortalSidebar();
  const { clinicName, logoUrl } = useClinicSettings();
  const isChangePasswordOnly = session.user.mustChangePassword;
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    }
  }, [isDark]);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {!isChangePasswordOnly && (
        <>
          {mobileOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-90 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
          )}

          <aside
            className={cn(
              "bg-white border-r border-gray-200 flex flex-col shrink-0 h-screen transition-transform duration-200 ease-in-out",
              "fixed top-0 left-0 z-100 w-64",
              mobileOpen ? "translate-x-0" : "-translate-x-full",
              "md:static md:translate-x-0 md:z-auto md:w-56 md:flex"
            )}
          >
            <div className="p-4 border-b border-gray-200 flex items-center gap-2 relative">
              <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center overflow-hidden shrink-0 p-0.5">
                {logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={logoUrl}
                    alt=""
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.src.endsWith("/logo.png")) {
                        target.src = "/logo.png";
                      }
                    }}
                  />
                ) : (
                  <Hospital className="w-5 h-5 text-teal-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-900 truncate">
                  {clinicName || "Patient Portal"}
                </p>
                <p className="text-[10px] text-gray-400 truncate">Patient Portal</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="md:hidden p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <PortalNav onNavigate={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="min-h-14 bg-white border-b border-gray-200 px-4 sm:px-6 py-2 shrink-0 z-10">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {!isChangePasswordOnly && (
              <button
                type="button"
                onClick={toggleMobile}
                className="md:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-50 cursor-pointer shrink-0"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">
                  {session.user.fullName}
                </p>
                <p className="text-[10px] text-gray-400">
                  {session.user.patientDisplayId || "Patient"}
                </p>
              </div>
            </div>

            <div className="hidden md:block flex-1 min-w-0" />

            <div className="flex items-center gap-1 shrink-0 ml-auto w-full justify-end md:w-auto">
              <button
                onClick={toggleDark}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-50 cursor-pointer shrink-0"
                aria-label="Toggle dark mode"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {!isChangePasswordOnly && (
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/patient/login" })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 border border-gray-200 hover:bg-gray-50 cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}