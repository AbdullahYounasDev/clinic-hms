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
} from "lucide-react";
import { useState, useEffect } from "react";
import { useClinicSettings } from "@/components/providers/clinic-provider";
import { PoweredByNyron, ThemeToggle } from "@/components/ui";

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
    <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
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
              "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-[0.98]",
              active
                ? "bg-teal-600 text-white shadow-xs"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800/80"
            )}
          >
            <Icon className={cn("w-4 h-4 shrink-0", active ? "text-white" : "text-gray-400 dark:text-gray-500")} />
            <span>{item.label}</span>
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
  const { clinicName, logoUrl } = useClinicSettings();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const isChangePasswordOnly = session.user?.mustChangePassword;

  useEffect(() => {
    const dark = localStorage.getItem("theme") === "dark" || document.documentElement.classList.contains("dark");
    setIsDark(dark);
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {!isChangePasswordOnly && (
        <>
          {mobileOpen && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden cursor-pointer"
              onClick={() => setMobileOpen(false)}
            />
          )}

          <aside
            className={cn(
              "bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0 h-screen transition-transform duration-200 ease-in-out z-50",
              "fixed top-0 left-0 w-64 md:static md:translate-x-0 md:w-60 md:z-auto",
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
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
                    <Hospital className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">
                    {clinicName || "Patient Portal"}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">Patient Portal</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="md:hidden p-1.5 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <PortalNav onNavigate={() => setMobileOpen(false)} />
            <div className="p-3 border-t border-gray-200 dark:border-gray-800">
              <PoweredByNyron />
            </div>
          </aside>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="min-h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-2 shrink-0 z-10">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {!isChangePasswordOnly && (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="md:hidden p-2 -ml-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer shrink-0"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {session.user.fullName}
                </p>
                <p className="text-[10px] text-gray-400">
                  {session.user.patientDisplayId || "Patient"}
                </p>
              </div>
            </div>

            <div className="hidden md:block flex-1 min-w-0" />

            <div className="flex items-center gap-2 shrink-0 ml-auto w-full justify-end md:w-auto">
              <ThemeToggle isDark={isDark} onToggle={toggleDark} />

              {!isChangePasswordOnly && (
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/patient/login" })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer shrink-0 transition-colors"
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