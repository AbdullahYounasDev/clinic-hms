"use client";

import { RefreshCw, Hash } from "lucide-react";
import { Button } from "@/components/ui";
import { useClinicSettings } from "@/components/providers/clinic-provider";

export interface PatientQueueBannerData {
  hasActiveQueue: boolean;
  queueNumber: number | null;
  nowServing: number;
  patientsAhead: number;
  doctorName: string;
  status: string;
  scheduledTime?: string;
}

export function PatientQueueBanner({
  data,
  onReload,
  isReloading,
}: {
  data?: PatientQueueBannerData | null;
  onReload: () => void;
  isReloading?: boolean;
}) {
  const { formatTime } = useClinicSettings();
  if (!data?.hasActiveQueue) return null;

  return (
    <div className="rounded-lg border border-teal-200 bg-gradient-to-r from-teal-50 to-white p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse shrink-0" />
          <span className="text-xs font-semibold text-teal-800">Live Queue</span>
          <span className="text-[10px] text-teal-500 truncate">· {data.doctorName}</span>
        </div>
        <Button
          size="sm"
          onClick={onReload}
          disabled={isReloading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? "animate-spin" : ""}`} />
          Reload
        </Button>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-teal-200 shadow-sm">
            <Hash className="w-4 h-4 text-teal-600" />
            <span className="text-2xl font-bold text-teal-700">
              {data.queueNumber === 0 ? "P" : data.queueNumber}
            </span>
          </div>
          <p className="text-[10px] text-teal-600 mt-1.5 font-medium">Your Token</p>
        </div>
        <div className="h-10 w-px bg-teal-200" />
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-700">
            {data.nowServing === 0 ? "None" : `#${data.nowServing}`}
          </p>
          <p className="text-[10px] text-gray-500 mt-1.5">Now Serving</p>
        </div>
        <div className="h-10 w-px bg-teal-200" />
        <div className="text-center">
          <p className="text-2xl font-bold text-amber-600">{data.status === "in_consultation" ? "0" : data.patientsAhead}</p>
          <p className="text-[10px] text-gray-500 mt-1.5">
            {data.status === "in_consultation"
              ? "Serving You"
              : data.patientsAhead === 0
                ? "You're next!"
                : "Ahead of you"}
          </p>
        </div>
      </div>
      {data.status === "in_consultation" && (
        <div className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-100 border border-teal-200 w-fit">
          <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
          <span className="text-xs font-semibold text-teal-800">Your consultation is in progress</span>
        </div>
      )}
      {data.status === "checked_in" && (
        <div className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 w-fit">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs font-semibold text-amber-800">Checked In — Waiting in queue</span>
        </div>
      )}
      {data.status === "scheduled" && (
        <p className="mt-3 text-[10px] text-teal-600">
          Your appointment is scheduled{data.scheduledTime ? ` at ${formatTime(data.scheduledTime)}` : ""}. Please check in at reception upon arrival.
        </p>
      )}
    </div>
  );
}
