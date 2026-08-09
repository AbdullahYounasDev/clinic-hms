// Pure time calculation utilities (usable in both Client and Server components)

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const cleaned = timeStr.trim();
  
  // Handle 12-hour format e.g. "08:00 AM", "05:00 PM", "12:00 PM"
  const match12 = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  // Handle 24-hour format e.g. "08:00", "17:00"
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }

  return 0;
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function minutesToDisplayTime(mins: number): string {
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

export function normalizeTimeString(timeStr: string): string {
  const mins = timeToMinutes(timeStr);
  return minutesToTime(mins);
}

export function getWeekdayKey(date: Date): "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
  return days[date.getDay()];
}

export function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isValidIANATimezone(timeZone?: string | null): boolean {
  if (!timeZone || typeof timeZone !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function resolveClinicTimezone(timeZone?: string | null): string {
  return isValidIANATimezone(timeZone) ? timeZone! : "Asia/Karachi";
}

export async function getClinicTimezone(): Promise<string> {
  try {
    const { Settings } = await import("@/models/operations.model");
    const settings = await Settings.findOne({}).select("timezone").lean();
    return resolveClinicTimezone(settings?.timezone);
  } catch {
    return "Asia/Karachi";
  }
}

export function getClinicDateString(referenceDate: Date = new Date(), timeZone?: string | null): string {
  const tz = resolveClinicTimezone(timeZone);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(referenceDate);
}

function getTimezoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const getVal = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || "0", 10);
  let hour = getVal("hour");
  if (hour === 24) hour = 0;
  const localAsUtc = Date.UTC(
    getVal("year"),
    getVal("month") - 1,
    getVal("day"),
    hour,
    getVal("minute"),
    getVal("second"),
    date.getMilliseconds()
  );
  return localAsUtc - date.getTime();
}

/**
 * Calculates exact UTC start-of-day (00:00:00.000 local) and end-of-day (23:59:59.999 local) Date objects
 * for a clinic calendar date string ("YYYY-MM-DD") in the given IANA timezone.
 * Uses a 2-pass refinement algorithm to handle DST transitions (spring forward / fall back) accurately.
 */
export function getClinicDayBounds(dateString: string, timeZone?: string | null): { start: Date; end: Date } {
  const tz = resolveClinicTimezone(timeZone);
  const [y, m, d] = dateString.split("-").map(Number);

  // Start of day (00:00:00.000 local)
  const utcStartGuess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const offsetStart = getTimezoneOffsetMs(utcStartGuess, tz);
  let start = new Date(utcStartGuess.getTime() - offsetStart);
  const refinedStartOffset = getTimezoneOffsetMs(start, tz);
  if (refinedStartOffset !== offsetStart) {
    start = new Date(utcStartGuess.getTime() - refinedStartOffset);
  }

  // End of day (23:59:59.999 local)
  const utcEndGuess = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  const offsetEnd = getTimezoneOffsetMs(utcEndGuess, tz);
  let end = new Date(utcEndGuess.getTime() - offsetEnd);
  const refinedEndOffset = getTimezoneOffsetMs(end, tz);
  if (refinedEndOffset !== offsetEnd) {
    end = new Date(utcEndGuess.getTime() - refinedEndOffset);
  }

  return { start, end };
}

/**
 * Safely converts any Date or ISO string into a YYYY-MM-DD form value in the clinic timezone.
 */
export function toClinicDateString(input: Date | string | null | undefined, timeZone?: string | null): string {
  if (!input) return "";
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }
  const dateObj = typeof input === "string" ? new Date(input) : input;
  if (isNaN(dateObj.getTime())) return "";
  return getClinicDateString(dateObj, timeZone);
}

/**
 * Converts a YYYY-MM-DD calendar date string into UTC Noon Date object (12:00:00.000Z) for storage.
 * Storing at UTC Noon ensures the calendar date remains 100% immune to date shifting across all timezones.
 */
export function toClinicNoonDate(dateString: string): Date {
  const clean = (dateString || "").trim().slice(0, 10);
  const [y, m, d] = clean.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

// ─── GLOBAL DATE & TIME FORMATTING UTILITIES ─────────────
export type DateFormatPattern = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY/MM/DD";
export type TimeFormatPattern = "12-hour" | "24-hour";

function getActiveClientSettings() {
  if (typeof window === "undefined") return null;
  try {
    const winSettings = (window as any).__CLINIC_SETTINGS__;
    if (winSettings && (winSettings.dateFormat || winSettings.timeFormat || winSettings.timezone)) {
      return winSettings;
    }
    const cached = localStorage.getItem("clinic_hms_settings");
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {}
  return null;
}

/**
 * Formats a Date or ISO string into the configured clinic Date Format (e.g. DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD).
 */
export function formatClinicDate(
  input: Date | string | null | undefined,
  dateFormat?: DateFormatPattern | null,
  timeZone?: string | null
): string {
  if (!input) return "";
  const activeSettings = getActiveClientSettings();
  const pattern = dateFormat || activeSettings?.dateFormat || "DD/MM/YYYY";
  const tz = timeZone || activeSettings?.timezone;

  const dateStr = toClinicDateString(input, tz);
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return "";

  const [y, m, d] = dateStr.split("-").map(Number);
  const day = String(d).padStart(2, "0");
  const month = String(m).padStart(2, "0");
  const year = String(y);

  if (pattern === "MM/DD/YYYY") {
    return `${month}/${day}/${year}`;
  }
  if (pattern === "YYYY/MM/DD") {
    return `${year}/${month}/${day}`;
  }
  // Default: DD/MM/YYYY
  return `${day}/${month}/${year}`;
}

/**
 * Formats a time string ("08:00 AM" or "14:30") or Date into configured Time Format ("12-hour" or "24-hour").
 */
export function formatClinicTime(
  input: Date | string | null | undefined,
  timeFormat?: TimeFormatPattern | null,
  timeZone?: string | null
): string {
  if (!input) return "";
  const activeSettings = getActiveClientSettings();
  const pattern = timeFormat || activeSettings?.timeFormat || "12-hour";
  const tz = timeZone || activeSettings?.timezone;

  let hours = 0;
  let minutes = 0;

  if (input instanceof Date || (typeof input === "string" && (input.includes("T") || input.includes("Z")))) {
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return "";
    const activeTz = resolveClinicTimezone(tz);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: activeTz,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(d);

    const hVal = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    hours = hVal === 24 ? 0 : hVal;
    minutes = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  } else if (typeof input === "string") {
    const mins = timeToMinutes(input);
    hours = Math.floor(mins / 60);
    minutes = mins % 60;
  }

  const mm = String(minutes).padStart(2, "0");

  if (pattern === "24-hour") {
    const hh = String(hours).padStart(2, "0");
    return `${hh}:${mm}`;
  } else {
    const period = hours >= 12 ? "PM" : "AM";
    let displayH = hours % 12;
    if (displayH === 0) displayH = 12;
    const hh = String(displayH).padStart(2, "0");
    return `${hh}:${mm} ${period}`;
  }
}

/**
 * Formats a Date/Timestamp into both Date Format + Time Format in the clinic timezone.
 */
export function formatClinicDateTime(
  input: Date | string | null | undefined,
  dateFormat?: DateFormatPattern | null,
  timeFormat?: TimeFormatPattern | null,
  timeZone?: string | null
): string {
  if (!input) return "";
  const dStr = formatClinicDate(input, dateFormat, timeZone);
  const tStr = formatClinicTime(input, timeFormat, timeZone);
  if (!dStr) return "";
  if (!tStr) return dStr;
  return `${dStr} ${tStr}`;
}

