"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import {
  formatClinicDate,
  formatClinicTime,
  formatClinicDateTime,
  DateFormatPattern,
  TimeFormatPattern,
} from "@/lib/time-utils";

export interface WorkingDay {
  day: string;
  openingTime: string;
  breakStart?: string;
  breakEnd?: string;
  closingTime: string;
  isOpen?: boolean;
}

export interface ClosingDay {
  _id?: string;
  date: string;
  reason: string;
}

export interface ClinicSettings {
  clinicName: string;
  clinicTagline: string;
  clinicType?: string;
  logo: string;
  logoPublicId?: string;
  clinicAddress: string;
  phone: string;
  email: string;
  timezone?: string;
  dateFormat?: DateFormatPattern;
  timeFormat?: TimeFormatPattern;
  workingDays: WorkingDay[];
  closingDays: ClosingDay[];
}

const DEFAULT_SETTINGS: ClinicSettings = {
  clinicName: "ClinicHMS",
  clinicTagline: "Hospital Management System",
  clinicType: "clinic",
  logo: "/logo.png",
  logoPublicId: "",
  clinicAddress: "123 Healthcare Avenue, Medical District",
  phone: "+92 300 1234567",
  email: "info@clinichms.com",
  timezone: "Asia/Karachi",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "12-hour",
  workingDays: [
    { day: "Monday", openingTime: "08:00 AM", breakStart: "01:00 PM", breakEnd: "02:00 PM", closingTime: "05:00 PM", isOpen: true },
    { day: "Tuesday", openingTime: "08:00 AM", breakStart: "01:00 PM", breakEnd: "02:00 PM", closingTime: "05:00 PM", isOpen: true },
    { day: "Wednesday", openingTime: "08:00 AM", breakStart: "01:00 PM", breakEnd: "02:00 PM", closingTime: "05:00 PM", isOpen: true },
    { day: "Thursday", openingTime: "08:00 AM", breakStart: "01:00 PM", breakEnd: "02:00 PM", closingTime: "05:00 PM", isOpen: true },
    { day: "Friday", openingTime: "08:00 AM", breakStart: "01:00 PM", breakEnd: "02:00 PM", closingTime: "05:00 PM", isOpen: true },
  ],
  closingDays: [],
};

interface ClinicContextValue {
  settings: ClinicSettings;
  isLoading: boolean;
  refetchSettings: () => void;
  clinicName: string;
  clinicTagline: string;
  logoUrl: string;
  clinicAddress: string;
  phone: string;
  email: string;
  timezone: string;
  dateFormat: DateFormatPattern;
  timeFormat: TimeFormatPattern;
  formatDate: (date: Date | string | null | undefined) => string;
  formatTime: (time: Date | string | null | undefined) => string;
  formatDateTime: (date: Date | string | null | undefined) => string;
  workingDays: WorkingDay[];
  closingDays: ClosingDay[];
}

const ClinicContext = createContext<ClinicContextValue>({
  settings: DEFAULT_SETTINGS,
  isLoading: false,
  refetchSettings: () => { },
  clinicName: DEFAULT_SETTINGS.clinicName,
  clinicTagline: DEFAULT_SETTINGS.clinicTagline,
  logoUrl: DEFAULT_SETTINGS.logo,
  clinicAddress: DEFAULT_SETTINGS.clinicAddress,
  phone: DEFAULT_SETTINGS.phone,
  email: DEFAULT_SETTINGS.email,
  timezone: DEFAULT_SETTINGS.timezone || "Asia/Karachi",
  dateFormat: DEFAULT_SETTINGS.dateFormat || "DD/MM/YYYY",
  timeFormat: DEFAULT_SETTINGS.timeFormat || "12-hour",
  formatDate: (date) => formatClinicDate(date, "DD/MM/YYYY", "Asia/Karachi"),
  formatTime: (time) => formatClinicTime(time, "12-hour", "Asia/Karachi"),
  formatDateTime: (date) => formatClinicDateTime(date, "DD/MM/YYYY", "12-hour", "Asia/Karachi"),
  workingDays: DEFAULT_SETTINGS.workingDays,
  closingDays: DEFAULT_SETTINGS.closingDays,
});

function getInitialSettings(serverSettings?: ClinicSettings): ClinicSettings {
  // 1. Best: server-fetched data passed as prop from the Root Layout Server Component
  if (serverSettings) return serverSettings;
  // 2. Fallback: cached from last successful API fetch (for client-side navigations)
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("clinic_hms_settings");
      if (stored) return JSON.parse(stored);
    } catch {}
  }
  // 3. Last resort: hardcoded defaults
  return DEFAULT_SETTINGS;
}

export function ClinicProvider({
  children,
  initialSettings: serverSettings,
}: {
  children: React.ReactNode;
  /** Server-fetched clinic settings from the Root Layout. Eliminates branding flash. */
  initialSettings?: ClinicSettings;
}) {
  const [initialSettings] = React.useState<ClinicSettings>(() => getInitialSettings(serverSettings));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      try {
        const res = await axios.get("/api/settings/public");
        const fetched = res.data?.data as ClinicSettings;
        if (fetched && typeof window !== "undefined") {
          try {
            localStorage.setItem("clinic_hms_settings", JSON.stringify(fetched));
          } catch {}
        }
        return (fetched || initialSettings) as ClinicSettings;
      } catch {
        return initialSettings;
      }
    },
    // Pre-populate with server-passed data so first render has real values immediately
    initialData: initialSettings,
    // Forces TanStack Query to refetch on mount in the background immediately
    initialDataUpdatedAt: 0,
    // Still refetch in background to pick up any settings changes
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  React.useEffect(() => {
    if (data && typeof window !== "undefined") {
      (window as any).__CLINIC_SETTINGS__ = data;
      try {
        localStorage.setItem("clinic_hms_settings", JSON.stringify(data));
      } catch {}
    }
  }, [data]);

  const value = useMemo(() => {
    const s = data || initialSettings || DEFAULT_SETTINGS;
    const tz = s.timezone || DEFAULT_SETTINGS.timezone || "Asia/Karachi";
    const dFormat: DateFormatPattern = s.dateFormat || DEFAULT_SETTINGS.dateFormat || "DD/MM/YYYY";
    const tFormat: TimeFormatPattern = s.timeFormat || DEFAULT_SETTINGS.timeFormat || "12-hour";

    if (typeof window !== "undefined") {
      (window as any).__CLINIC_SETTINGS__ = s;
    }

    return {
      settings: s,
      isLoading,
      refetchSettings: refetch,
      clinicName: s.clinicName || DEFAULT_SETTINGS.clinicName,
      clinicTagline: s.clinicTagline || DEFAULT_SETTINGS.clinicTagline,
      logoUrl: s.logo || DEFAULT_SETTINGS.logo,
      clinicAddress: s.clinicAddress || DEFAULT_SETTINGS.clinicAddress,
      phone: s.phone || DEFAULT_SETTINGS.phone,
      email: s.email || DEFAULT_SETTINGS.email,
      timezone: tz,
      dateFormat: dFormat,
      timeFormat: tFormat,
      formatDate: (date: Date | string | null | undefined) => formatClinicDate(date, dFormat, tz),
      formatTime: (time: Date | string | null | undefined) => formatClinicTime(time, tFormat, tz),
      formatDateTime: (date: Date | string | null | undefined) => formatClinicDateTime(date, dFormat, tFormat, tz),
      workingDays: s.workingDays && s.workingDays.length > 0 ? s.workingDays : DEFAULT_SETTINGS.workingDays,
      closingDays: s.closingDays || [],
    };
  }, [data, initialSettings, isLoading, refetch]);

  // Dynamically update document title and favicons when clinic settings change
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const { clinicName, logoUrl } = value;

    // Update favicon links
    if (logoUrl) {
      let iconLink = document.querySelector("link[rel='icon']") as HTMLLinkElement;
      if (!iconLink) {
        iconLink = document.createElement("link");
        iconLink.rel = "icon";
        document.head.appendChild(iconLink);
      }
      iconLink.href = logoUrl;

      let shortcutLink = document.querySelector("link[rel='shortcut icon']") as HTMLLinkElement;
      if (!shortcutLink) {
        shortcutLink = document.createElement("link");
        shortcutLink.rel = "shortcut icon";
        document.head.appendChild(shortcutLink);
      }
      shortcutLink.href = logoUrl;
    }
  }, [value]);

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
}

export function useClinicSettings() {
  return useContext(ClinicContext);
}
