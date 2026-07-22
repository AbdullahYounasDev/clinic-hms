"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, Download } from "lucide-react";
import { Button } from "@/components/ui";

export function PortalDetailHeader({
  title,
  subtitle,
  backHref,
  onPrint,
  onDownloadPdf,
  isPdfLoading,
  showActions = true,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  onPrint?: () => void;
  onDownloadPdf?: () => void;
  isPdfLoading?: boolean;
  showActions?: boolean;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => (backHref ? router.push(backHref) : router.back())}
          className="p-2 rounded-lg border border-gray-300 text-gray-400 cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
      {showActions && (onPrint || onDownloadPdf) && (
        <div className="flex items-center gap-2 shrink-0">
          {onPrint && (
            <Button variant="secondary" size="sm" onClick={onPrint}>
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          )}
          {onDownloadPdf && (
            <Button variant="secondary" size="sm" onClick={onDownloadPdf} loading={isPdfLoading}>
              <Download className="w-3.5 h-3.5" /> PDF
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
