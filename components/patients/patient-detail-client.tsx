// components/patients/patient-detail-client.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useSearchParams, useRouter } from "next/navigation";
import { PatientHeader } from "@/components/patients/patient-details/patient-header";
import { MedicalInfoCard } from "@/components/patients/patient-details/medical-info-card";
import { EmergencyContactCard } from "@/components/patients/patient-details/emergency-contact-card";
import { AppointmentsTab } from "@/components/patients/patient-details/appointments-tab";
import { LabTestsTab } from "@/components/patients/patient-details/lab-tests-tab";
import { PrescriptionsTab } from "@/components/patients/patient-details/prescriptions-tab";
import { BillingTab } from "@/components/patients/patient-details/billing-tab";
import { DocumentsTab } from "@/components/patients/patient-details/documents-tab";
import { EditPatientModal } from "@/components/patients/patient-details/edit-patient-modal";
import { Skeleton, Alert, Button, Modal } from "@/components/ui";
import { DeceasedBanner } from "./patient-details/deceased-banner";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ChevronDown, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";

const TABS = ["Overview", "Appointments", "Lab Tests", "Prescriptions", "Billing", "Documents"];

export function PatientDetailClient({ patientId }: { patientId: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const [tab, setTab] = useState("Overview");
  const [editOpen, setEditOpen] = useState(searchParams.get("edit") === "true");
  const [editError, setEditError] = useState("");
  const [mobileTabOpen, setMobileTabOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const isSA = session?.user.isSuperAdmin;
  const perms = session?.user.permissions || [];
  const canDelete = isSA || perms.includes("patients:delete");

  const { data: patientData, isLoading, error } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => axios.get(`/api/patients/${patientId}`).then(r => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => axios.put(`/api/patients/${patientId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", patientId] });
      setEditOpen(false);
      setEditError("");
      router.replace(`/patients/${patientId}`);
      toast.success("Patient updated successfully!");
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error || "Failed to update";
      setEditError(msg);
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => axios.delete(`/api/patients/${patientId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      toast.success("Patient deleted!");
      router.push("/patients");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed to delete"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (error) return <Alert type="error">Patient not found.</Alert>;

  const p = patientData.data;

  return (
    <div className="space-y-4">
      <PatientHeader
        p={p}
        onEdit={() => setEditOpen(true)}
        canDelete={canDelete}
        onDelete={() => setDeleteConfirmOpen(true)}
      />

      {/* Desktop Tabs */}
      <div className="hidden md:flex gap-2 border-b border-gray-300">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-2 text-xs font-medium border-b-2 cursor-pointer",
              tab === t
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-gray-500"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Mobile Tab Selector */}
      <div className="md:hidden relative">
        <button
          onClick={() => setMobileTabOpen(!mobileTabOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 cursor-pointer"
        >
          {tab}
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", mobileTabOpen && "rotate-180")} />
        </button>
        {mobileTabOpen && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg overflow-hidden">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setMobileTabOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs font-medium cursor-pointer",
                  tab === t
                    ? "bg-teal-50 text-teal-700"
                    : "text-gray-600"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tab Content */}
      {tab === "Overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MedicalInfoCard p={p} />
          <EmergencyContactCard p={p} />
          {patientData?.data?.status === "deceased" && (
            <div className="lg:col-span-2">
              <DeceasedBanner
                dateOfDeath={patientData.data.dateOfDeath}
                causeOfDeath={patientData.data.causeOfDeath}
              />
            </div>
          )}
        </div>
      )}

      {tab === "Appointments" && <AppointmentsTab patientId={patientId} />}
      {tab === "Lab Tests" && <LabTestsTab patientId={patientId} />}
      {tab === "Prescriptions" && <PrescriptionsTab patientId={patientId} />}
      {tab === "Billing" && <BillingTab patientId={patientId} />}
      {tab === "Documents" && <DocumentsTab />}

      {/* Backdrop for mobile tab dropdown */}
      {mobileTabOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          onClick={() => setMobileTabOpen(false)}
        />
      )}

      <EditPatientModal
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditError(""); }}
        patient={p}
        onUpdate={(data: any) => updateMutation.mutate(data)}
        isPending={updateMutation.isPending}
        error={editError}
      />

      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Delete Patient Record" size="sm">
        <div className="space-y-4 mt-2">
          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
            <Trash2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-800">Delete patient?</p>
              <p className="text-xs text-red-600 mt-0.5">This will delete <strong>{p.patientId}</strong> ({p.firstName} {p.lastName}). Historical medical and financial records will remain preserved.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-300">
            <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>Delete Patient</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}