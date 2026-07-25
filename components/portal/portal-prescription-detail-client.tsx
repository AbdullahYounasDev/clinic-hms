"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { pdf } from "@react-pdf/renderer";
import { toast } from "sonner";
import { Card, CardBody, StatusBadge, Skeleton, Alert } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { PortalDetailHeader } from "./portal-detail-header";
import { generatePrescriptionPrintHtml, PrescriptionPdfTemplate } from "@/components/printTemplates/prescription-print-template";

import { useClinicSettings } from "@/components/providers/clinic-provider";

export function PortalPrescriptionDetailClient({ prescriptionId }: { prescriptionId: string }) {
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const clinicSettings = useClinicSettings();

  const { data, isLoading } = useQuery({
    queryKey: ["portal-prescription", prescriptionId],
    queryFn: () => axios.get(`/api/portal/prescriptions/${prescriptionId}`).then((r) => r.data),
  });

  const rx = data?.data;

  const handlePrint = () => {
    if (!rx) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow pop-ups to print.");
      return;
    }
    printWindow.document.write(generatePrescriptionPrintHtml(rx, clinicSettings.logoUrl, clinicSettings));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const handleDownloadPdf = async () => {
    if (!rx) return;
    setIsPdfLoading(true);
    try {
      const blob = await pdf(<PrescriptionPdfTemplate prescription={rx} logoUrl={clinicSettings.logoUrl} clinicDetails={clinicSettings} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${rx.prescriptionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded!");
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setIsPdfLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!rx) {
    return (
      <div className="space-y-4">
        <PortalDetailHeader title="Prescription" backHref="/portal/prescriptions" showActions={false} />
        <Alert type="error">Prescription not found.</Alert>
      </div>
    );
  }

  const doctor = rx.doctor?.user || rx.doctor;

  return (
    <div className="space-y-4">
      <PortalDetailHeader
        title={rx.prescriptionId}
        subtitle={`Dr. ${doctor?.firstName || ""} ${doctor?.lastName || ""} • ${formatDate(rx.createdAt)}`}
        backHref="/portal/prescriptions"
        onPrint={handlePrint}
        onDownloadPdf={handleDownloadPdf}
        isPdfLoading={isPdfLoading}
      />

      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
            <StatusBadge status={rx.status} />
            <p className="text-xs text-gray-500 capitalize">{rx.type} prescription</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-200">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Patient</p>
              <p className="text-xs font-semibold text-gray-900">{rx.patient?.firstName} {rx.patient?.lastName}</p>
              <p className="text-xs text-gray-500">{rx.patient?.patientId}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Prescribed By</p>
              <p className="text-xs text-gray-700">Dr. {doctor?.firstName} {doctor?.lastName}</p>
              <p className="text-xs text-gray-500 mt-0.5">{formatDate(rx.createdAt)}</p>
            </div>
          </div>

          <div className="mb-4 pb-4 border-b border-gray-200">
            <div className="hidden sm:grid sm:grid-cols-12 gap-2 mb-2 px-2">
              <div className="col-span-4 text-xs font-semibold text-gray-400 uppercase">Medicine</div>
              <div className="col-span-2 text-xs font-semibold text-gray-400 uppercase">Dosage</div>
              <div className="col-span-2 text-xs font-semibold text-gray-400 uppercase">Frequency</div>
              <div className="col-span-2 text-xs font-semibold text-gray-400 uppercase">Duration</div>
              <div className="col-span-1 text-xs font-semibold text-gray-400 uppercase">Route</div>
              <div className="col-span-1 text-xs font-semibold text-gray-400 uppercase text-right">Qty</div>
            </div>
            <div className="space-y-1">
              {(rx.medicines || []).map((med: any, i: number) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-2 p-2 bg-gray-50 rounded-lg">
                  <div className="sm:col-span-4">
                    <span className="text-xs font-medium text-gray-900">{med.medicineName}{med.strength ? ` (${med.strength})` : ""}</span>
                    {med.genericName && <span className="text-xs text-gray-400 block">{med.genericName}</span>}
                  </div>
                  <div className="sm:col-span-2"><span className="text-xs text-gray-600">{med.dosage}</span></div>
                  <div className="sm:col-span-2"><span className="text-xs text-gray-600">{med.frequency}</span></div>
                  <div className="sm:col-span-2"><span className="text-xs text-gray-600">{med.duration || "—"}</span></div>
                  <div className="sm:col-span-1"><span className="text-xs text-gray-600 capitalize">{med.route}</span></div>
                  <div className="sm:col-span-1 sm:text-right"><span className="text-xs text-gray-600">{med.quantity ?? "—"}</span></div>
                  {med.instructions && (
                    <div className="sm:col-span-12 mt-1">
                      <span className="text-[10px] text-gray-500">Instructions: {med.instructions}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {rx.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Notes</p>
              <p className="text-xs text-gray-600">{rx.notes}</p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
