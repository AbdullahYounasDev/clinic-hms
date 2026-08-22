"use client";
/**
 * SyncStatusBadge — lightweight inline indicator for the patients list header.
 *
 * Shows:
 *   • Nothing when everything is synced.
 *   • An amber spinner badge when there are pending offline changes.
 *   • A red warning badge when there are conflicts that need attention.
 *
 * Uses only existing Tailwind classes already present in the project.
 * No new icon library — uses inline SVG that matches the Lucide style.
 */

import { useSyncStatusCounts } from "@/lib/rxdb/hooks";

export function SyncStatusBadge() {
  const { pending, conflict } = useSyncStatusCounts();

  if (pending === 0 && conflict === 0) return null;

  if (conflict > 0) {
    return (
      <span
        title={`${conflict} record${conflict !== 1 ? "s" : ""} have sync conflicts`}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200"
      >
        {/* Inline exclamation-circle SVG */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-3 h-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {conflict} conflict{conflict !== 1 ? "s" : ""}
      </span>
    );
  }

  return (
    <span
      title={`${pending} change${pending !== 1 ? "s" : ""} waiting to sync`}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200"
    >
      {/* Spinning loader SVG */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-3 h-3 animate-spin"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      {pending} pending
    </span>
  );
}
