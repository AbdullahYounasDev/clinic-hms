"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { pdf } from "@react-pdf/renderer";
import { toast } from "sonner";
import { AlertTriangle, FlaskConical, FileText } from "lucide-react";
import {
  Card, CardBody, StatusBadge, Badge, Skeleton, Alert,
} from "@/components/ui";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { PortalDetailHeader } from "./portal-detail-header";
import { generateLabReportPrintHtml, LabReportPdfTemplate } from "@/components/printTemplates/lab-report-print-template";

function calculateAge(dob?: string): string {
  if (!dob) return "—";
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return "—";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} years`;
}

function formatValue(value: unknown) {
  if (value === true) return "Positive";
  if (value === false) return "Negative";
  return String(value ?? "—");
}

const STATUS_MESSAGES: Record<string, { title: string; description: string }> = {
  pending: {
    title: "Report not yet available",
    description: "Your lab order has been received. Results will appear here once testing is complete.",
  },
  in_progress: {
    title: "Testing in progress",
    description: "Your samples are being processed. The report will be available when testing is finished.",
  },
  completed: {
    title: "Report being prepared",
    description: "Testing is complete. Your official report is being finalized and will be available shortly.",
  },
  delivered: {
    title: "Report being prepared",
    description: "Your results have been delivered to the clinic. The downloadable report will appear here once finalized.",
  },
};

import { useClinicSettings } from "@/components/providers/clinic-provider";

export function PortalLabDetailClient({ labTestId }: { labTestId: string }) {
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const clinicSettings = useClinicSettings();

  const { data, isLoading } = useQuery({
    queryKey: ["portal-lab-detail", labTestId],
    queryFn: () => axios.get(`/api/portal/lab/${labTestId}`).then((r) => r.data),
  });

  const test = data?.data?.test;
  const report = data?.data?.report;
  const isReportable = test && ["completed", "delivered"].includes(test.status);
  const hasReport = !!report;

  const handlePrint = () => {
    if (!test || !report) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow pop-ups to print.");
      return;
    }
    printWindow.document.write(generateLabReportPrintHtml(test, report, clinicSettings.logoUrl, clinicSettings));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
  };

  const handleDownloadPdf = async () => {
    if (!test || !report) return;
    setIsPdfLoading(true);
    try {
      const blob = await pdf(<LabReportPdfTemplate test={test} report={report} logoUrl={clinicSettings.logoUrl} clinicDetails={clinicSettings} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${test.labTestId}_${test.patient?.firstName}_${test.patient?.lastName}.pdf`;
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

  if (!test) {
    return (
      <div className="space-y-4">
        <PortalDetailHeader title="Lab Test" backHref="/portal/lab" showActions={false} />
        <Alert type="error">Lab test not found.</Alert>
      </div>
    );
  }

  const statusMsg = STATUS_MESSAGES[test.status] || STATUS_MESSAGES.pending;

  return (
    <div className="space-y-4">
      <PortalDetailHeader
        title={test.labTestId}
        subtitle={`${test.tests?.length || 0} test(s) • ${formatDate(test.createdAt)}`}
        backHref="/portal/lab"
        onPrint={hasReport ? handlePrint : undefined}
        onDownloadPdf={hasReport ? handleDownloadPdf : undefined}
        isPdfLoading={isPdfLoading}
        showActions={hasReport}
      />

      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
            <StatusBadge status={test.status} />
            <p className="text-sm font-semibold text-gray-900">{formatCurrency(test.totalCost || 0)}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-200">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Patient</p>
              <p className="text-xs font-semibold text-gray-900">{test.patient?.firstName} {test.patient?.lastName}</p>
              <p className="text-xs text-gray-500">{test.patient?.patientId}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Order Details</p>
              <p className="text-xs text-gray-700">{test.tests?.length} test{test.tests?.length !== 1 ? "s" : ""}</p>
              {test.requestedBy && (
                <p className="text-xs text-gray-500 mt-0.5">Requested by: {test.requestedBy.firstName} {test.requestedBy.lastName}</p>
              )}
            </div>
          </div>

          <div className="mb-4 pb-4 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-600 mb-2">Ordered Tests</p>
            <div className="flex flex-wrap gap-2">
              {test.tests?.map((t: any, i: number) => (
                <Badge key={i} variant="outline">{t.testName || t.catalogId?.testName || "Test"}</Badge>
              ))}
            </div>
          </div>

          {!hasReport && (
            <div className="text-center py-8 px-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center mx-auto mb-3">
                {isReportable ? (
                  <FileText className="w-5 h-5 text-amber-500" />
                ) : (
                  <FlaskConical className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1">{statusMsg.title}</p>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">{statusMsg.description}</p>
            </div>
          )}

          {hasReport && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 pb-4 border-b border-gray-200">
                <div><p className="text-xs text-gray-400">Gender</p><p className="text-xs text-gray-700 capitalize">{test.patient?.gender || "—"}</p></div>
                <div><p className="text-xs text-gray-400">Age</p><p className="text-xs text-gray-700">{calculateAge(test.patient?.dateOfBirth)}</p></div>
                <div><p className="text-xs text-gray-400">Blood Group</p><p className="text-xs text-gray-700">{test.patient?.bloodGroup || "—"}</p></div>
                <div><p className="text-xs text-gray-400">Priority</p><Badge variant={test.priority === "stat" ? "danger" : test.priority === "urgent" ? "warning" : "default"}>{test.priority}</Badge></div>
              </div>

              {test.results?.length > 0 && (
                <div className="mb-4 pb-4 border-b border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Test Results</p>
                  <div className="space-y-3">
                    {test.results.map((result: any, i: number) => (
                      <div key={i}>
                        <p className="text-xs font-semibold text-gray-900 mb-1.5">{result.testName}</p>
                        <div className="space-y-1">
                          {result.parameterResults?.map((pr: any, j: number) => (
                            <div
                              key={j}
                              className={cn(
                                "flex items-center justify-between p-2 rounded-lg border",
                                pr.isAbnormal ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-medium text-gray-700">{pr.parameterName}</span>
                                {pr.unit && <span className="text-[10px] text-gray-400">({pr.unit})</span>}
                              </div>
                              <div className="flex items-center gap-3 text-right">
                                <div>
                                  <p className={cn("text-xs font-bold", pr.isAbnormal ? "text-red-500" : "text-gray-900")}>{formatValue(pr.value)}</p>
                                  {pr.referenceRange && <p className="text-[10px] text-gray-400">Ref: {pr.referenceRange}</p>}
                                </div>
                                {pr.isAbnormal && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                              </div>
                            </div>
                          ))}
                        </div>
                        {result.notes && <p className="text-[10px] text-gray-400 mt-1 ml-1">{result.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                <div>
                  <p className="text-xs text-gray-400">Performed by</p>
                  <p className="text-xs font-medium text-gray-700">{report.labTechnician?.name || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Report Date</p>
                  <p className="text-xs font-medium text-gray-700">{formatDate(report.createdAt)}</p>
                </div>
              </div>

              {report.additionalNotes && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Additional Notes</p>
                  <p className="text-xs text-gray-600">{report.additionalNotes}</p>
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
