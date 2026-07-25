"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { pdf } from "@react-pdf/renderer";
import { toast } from "sonner";
import {
  Card, CardBody, StatusBadge, Badge, Skeleton, Alert,
} from "@/components/ui";
import { CheckCircle, User } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PortalDetailHeader } from "./portal-detail-header";
import { generateInvoicePrintHtml, InvoicePdfTemplate } from "@/components/printTemplates/invoice-print-template";

import { useClinicSettings } from "@/components/providers/clinic-provider";

export function PortalBillingDetailClient({ invoiceId }: { invoiceId: string }) {
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const clinicSettings = useClinicSettings();

  const { data, isLoading } = useQuery({
    queryKey: ["portal-invoice", invoiceId],
    queryFn: () => axios.get(`/api/portal/billing/${invoiceId}`).then((r) => r.data),
  });

  const inv = data?.data;

  const handlePrint = () => {
    if (!inv) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow pop-ups to print.");
      return;
    }
    printWindow.document.write(generateInvoicePrintHtml(inv, clinicSettings.logoUrl, clinicSettings));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const handleDownloadPdf = async () => {
    if (!inv) return;
    setIsPdfLoading(true);
    try {
      const blob = await pdf(<InvoicePdfTemplate invoice={inv} logoUrl={clinicSettings.logoUrl} clinicDetails={clinicSettings} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${inv.invoiceNumber}.pdf`;
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

  if (!inv) {
    return (
      <div className="space-y-4">
        <PortalDetailHeader title="Invoice" backHref="/portal/billing" showActions={false} />
        <Alert type="error">Invoice not found.</Alert>
      </div>
    );
  }

  const isPaid = inv.status === "paid";
  const typeLabel = (type: string) => {
    const labels: Record<string, string> = {
      opd: "OPD Consultation",
      pharmacy_sale: "Pharmacy Sale",
      lab: "Lab Test",
      procedure: "Procedure",
      other: "Other",
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-4">
      <PortalDetailHeader
        title={inv.invoiceNumber}
        subtitle={`${typeLabel(inv.invoiceType)} • ${formatDate(inv.createdAt)}`}
        backHref="/portal/billing"
        onPrint={handlePrint}
        onDownloadPdf={handleDownloadPdf}
        isPdfLoading={isPdfLoading}
      />

      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <StatusBadge status={inv.status} />
              <Badge variant="outline">{typeLabel(inv.invoiceType)}</Badge>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900">{formatCurrency(inv.total)}</p>
              {inv.balanceDue > 0 ? (
                <p className="text-xs text-red-500 font-medium">Balance: {formatCurrency(inv.balanceDue)}</p>
              ) : isPaid ? (
                <p className="text-xs text-teal-600 font-medium flex items-center gap-1 justify-end">
                  <CheckCircle className="w-3 h-3" /> Paid in full
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-200">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Bill To</p>
              {inv.patient ? (
                <>
                  <p className="text-xs font-semibold text-gray-900">{inv.patient.firstName} {inv.patient.lastName}</p>
                  <p className="text-xs text-gray-500">{inv.patient.patientId}</p>
                  <p className="text-xs text-gray-500">{inv.patient.phone}</p>
                  {inv.patient.email && <p className="text-xs text-gray-500">{inv.patient.email}</p>}
                </>
              ) : inv.patientName ? (
                <>
                  <p className="text-xs font-semibold text-gray-900 flex items-center gap-1"><User className="w-3 h-3" /> {inv.patientName}</p>
                </>
              ) : null}
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Issued</p>
              <p className="text-xs text-gray-700">{formatDate(inv.createdAt)}</p>
              {inv.doctor && <p className="text-xs text-gray-500 mt-0.5">Dr. {inv.doctor.firstName} {inv.doctor.lastName}</p>}
              {inv.dueDate && <p className="text-xs text-gray-400 mt-0.5">Due: {formatDate(inv.dueDate)}</p>}
            </div>
          </div>

          <div className="mb-4 pb-4 border-b border-gray-200">
            <div className="hidden sm:grid sm:grid-cols-12 gap-2 mb-2 px-2">
              <div className="col-span-5 text-xs font-semibold text-gray-400 uppercase">Description</div>
              <div className="col-span-2 text-xs font-semibold text-gray-400 uppercase">Category</div>
              <div className="col-span-1 text-xs font-semibold text-gray-400 uppercase text-right">Qty</div>
              <div className="col-span-2 text-xs font-semibold text-gray-400 uppercase text-right">Unit Price</div>
              <div className="col-span-2 text-xs font-semibold text-gray-400 uppercase text-right">Total</div>
            </div>
            <div className="space-y-1">
              {inv.items.map((item: any, i: number) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-2 p-2 bg-gray-50 rounded-lg">
                  <div className="sm:col-span-5">
                    <span className="text-xs font-medium text-gray-900">{item.description}</span>
                    {item.medicine?.name && <span className="text-xs text-gray-400 block">{item.medicine.name}</span>}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-xs bg-white border border-gray-200 px-1.5 py-0.5 rounded">{item.category}</span>
                  </div>
                  <div className="sm:col-span-1 sm:text-right"><span className="text-xs text-gray-600">{item.quantity}</span></div>
                  <div className="sm:col-span-2 sm:text-right"><span className="text-xs text-gray-600">{formatCurrency(item.unitPrice)}</span></div>
                  <div className="sm:col-span-2 sm:text-right"><span className="text-xs font-semibold text-gray-700">{formatCurrency(item.total)}</span></div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end mb-4 pb-4 border-b border-gray-200">
            <div className="w-full sm:w-56 space-y-1">
              <div className="flex justify-between text-xs"><span className="text-gray-400">Subtotal</span><span className="text-gray-700">{formatCurrency(inv.subtotal)}</span></div>
              {inv.discount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-teal-600">Discount {inv.discountType === "percentage" ? `(${inv.discount}%)` : ""}</span>
                  <span className="text-teal-600">-{formatCurrency(inv.discountType === "percentage" ? inv.subtotal * inv.discount / 100 : inv.discount)}</span>
                </div>
              )}
              {inv.taxAmount > 0 && (
                <div className="flex justify-between text-xs"><span className="text-gray-400">Tax ({inv.taxRate}%)</span><span className="text-gray-700">{formatCurrency(inv.taxAmount)}</span></div>
              )}
              <div className="flex justify-between font-semibold text-sm border-t border-gray-300 pt-1.5 mt-1"><span className="text-gray-900">Total</span><span className="text-gray-900">{formatCurrency(inv.total)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-teal-600">Amount Paid</span><span className="text-teal-600">{formatCurrency(inv.paidAmount)}</span></div>
              {inv.balanceDue > 0 && (
                <div className="flex justify-between font-semibold text-sm text-red-500 border-t border-red-200 pt-1.5 mt-1"><span>Balance Due</span><span>{formatCurrency(inv.balanceDue)}</span></div>
              )}
            </div>
          </div>

          {inv.payments?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">Payment History</p>
              <div className="space-y-1">
                {inv.payments.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-700">{formatCurrency(p.amount)}</span>
                      <span className="text-xs bg-white border border-gray-200 px-1.5 py-0.5 rounded capitalize">{p.method.replace(/_/g, " ")}</span>
                      {p.transactionRef && <span className="text-xs text-gray-400">Ref: {p.transactionRef}</span>}
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(p.paidAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {inv.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Notes</p>
              <p className="text-xs text-gray-600">{inv.notes}</p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
