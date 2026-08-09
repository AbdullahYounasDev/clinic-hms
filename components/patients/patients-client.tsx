// components/patients/patients-client.tsx
"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { Search, Plus, Filter, ChevronDown, X, Archive, Eye, EyeOff, AlertTriangle, ShieldCheck, RefreshCw, RotateCcw } from "lucide-react";
import {
  Card, Table, Th, Td, StatusBadge,
  Button, Modal, FormField, Input, Select, EmptyState,
  Pagination, Badge, Alert,
} from "@/components/ui";
import { createPatientSchema, CreatePatientInput } from "@/lib/validations";
import { formatDate, cn } from "@/lib/utils";
import { formatCNIC, normalizeCNIC } from "@/lib/utils/cnic-utils";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface Patient {
  _id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  phone: string;
  cnic?: string;
  email?: string;
  bloodGroup?: string;
  status: string;
  createdAt: string;
}

function OptionalToggleHeader({
  label,
  checked,
  onChange,
  hint,
  icon: Icon,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  icon?: any;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-t border-gray-200 mt-3 select-none">
      <div>
        <span className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
          {Icon && <Icon className="w-4 h-4 text-teal-600 shrink-0" />}
          {label}
        </span>
        {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500 focus:ring-offset-0 accent-teal-600 cursor-pointer"
        />
      </label>
    </div>
  );
}

export function PatientsClient() {
  const { data: session } = useSession();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; label: string }>({ open: false, id: "", label: "" });
  const [showPortalPassword, setShowPortalPassword] = useState(false);

  // Optional Section Toggles (Hidden by default in Create Form)
  const [showCnic, setShowCnic] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [showGuardian, setShowGuardian] = useState(false);
  const [showMedical, setShowMedical] = useState(false);
  const [showInsurance, setShowInsurance] = useState(false);
  const [enablePortal, setEnablePortal] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const [phoneWarning, setPhoneWarning] = useState<{ isDuplicate: boolean; matches: any[] }>({
    isDuplicate: false,
    matches: [],
  });

  const perms = session?.user.permissions || [];
  const isSA = session?.user.isSuperAdmin;
  const canCreate = isSA || perms.includes("patients:create");
  const canDelete = isSA || perms.includes("patients:delete");

  const activeFiltersCount = [statusFilter].filter(Boolean).length;

  // Search Debouncing (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["patients", page, debouncedSearch, statusFilter],
    queryFn: () =>
      axios
        .get("/api/patients", { params: { page, limit: 20, search: debouncedSearch || undefined, status: statusFilter || undefined } })
        .then((r) => r.data),
  });

  const patients: Patient[] = data?.data || [];
  const pagination = data?.pagination;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<CreatePatientInput>({ resolver: zodResolver(createPatientSchema) });

  const watchedAllergies = useWatch({ control, name: "allergies" });
  const watchedChronicDiseases = useWatch({ control, name: "chronicDiseases" });
  const watchedPhone = useWatch({ control, name: "phone" });
  const rawCnic = useWatch({ control, name: "cnic" });

  // Non-blocking duplicate phone warning
  useEffect(() => {
    if (!watchedPhone || watchedPhone.length < 5) {
      setPhoneWarning({ isDuplicate: false, matches: [] });
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get("/api/patients/check-duplicate-phone", {
          params: { phone: watchedPhone },
        });
        if (res.data?.data) {
          setPhoneWarning(res.data.data);
        }
      } catch {
        // Silently catch duplicate phone check errors
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [watchedPhone]);

  const handleModalClose = () => {
    setCreateOpen(false);
    reset();
    setCreateError("");
    setShowPortalPassword(false);
    setShowCnic(false);
    setShowAddress(false);
    setShowGuardian(false);
    setShowMedical(false);
    setShowInsurance(false);
    setEnablePortal(false);
    setShowNotes(false);
    setPhoneWarning({ isDuplicate: false, matches: [] });
  };

  const createMutation = useMutation({
    mutationFn: (d: CreatePatientInput) => {
      const cleanedData = { ...d };
      if (cleanedData.cnic) {
        cleanedData.cnic = normalizeCNIC(cleanedData.cnic);
      }
      if (!showCnic) delete cleanedData.cnic;
      if (!showAddress) delete cleanedData.address;
      if (!showGuardian) delete cleanedData.emergencyContact;
      if (!showMedical) {
        delete cleanedData.bloodGroup;
        delete cleanedData.allergies;
        delete cleanedData.chronicDiseases;
      }
      if (!showInsurance) delete cleanedData.insuranceDetails;
      if (!enablePortal || !cleanedData.portalPassword?.trim()) delete cleanedData.portalPassword;
      if (!showNotes) delete cleanedData.notes;

      if (cleanedData.allergies?.length === 0) delete cleanedData.allergies;
      if (cleanedData.chronicDiseases?.length === 0) delete cleanedData.chronicDiseases;
      if (cleanedData.emergencyContact && !Object.values(cleanedData.emergencyContact).some(v => v)) delete cleanedData.emergencyContact;
      if (cleanedData.insuranceDetails && !Object.values(cleanedData.insuranceDetails).some(v => v)) delete cleanedData.insuranceDetails;
      if (cleanedData.address && !Object.values(cleanedData.address).some(v => v && v !== "")) delete cleanedData.address;
      if (!cleanedData.bloodGroup) delete cleanedData.bloodGroup;

      return axios.post("/api/patients", cleanedData);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      handleModalClose();
      toast.success("Patient registered successfully!");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to create patient";
      setCreateError(msg);
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/patients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      setDeleteConfirm({ open: false, id: "", label: "" });
      toast.success("Patient record archived!");
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to archive"),
  });

  const onFormSubmit = (d: CreatePatientInput) => {
    if (enablePortal) {
      if (!d.email) {
        setCreateError("Email is required when Patient Portal Access is enabled.");
        toast.error("Email is required for Patient Portal Access.");
        return;
      }
      if (!d.portalPassword || d.portalPassword.length < 8) {
        setCreateError("Portal Password must be at least 8 characters.");
        toast.error("Portal Password must be at least 8 characters.");
        return;
      }
    }
    setCreateError("");
    createMutation.mutate(d);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Patients</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {pagination?.total ?? 0} patient{pagination?.total !== 1 ? "s" : ""}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="w-3.5 h-3.5" /> New Patient
          </Button>
        )}
      </div>

      {/* Search + Filter Toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, CNIC, email, or ID..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-gray-300 
                       bg-white placeholder:text-gray-400 text-gray-700
                       focus:outline-none focus:border-teal-600"
          />
        </div>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer shrink-0",
            filtersOpen || activeFiltersCount > 0
              ? "bg-teal-600 text-white border-teal-600"
              : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {activeFiltersCount > 0 && (
            <span className="bg-white text-teal-600 text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-semibold">
              {activeFiltersCount}
            </span>
          )}
          <ChevronDown className={cn("w-3 h-3 transition-transform", filtersOpen && "rotate-180")} />
        </button>
      </div>

      {/* Active Filter Chips */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {statusFilter && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-700 capitalize">
              {statusFilter}
              <button onClick={() => { setStatusFilter(""); setPage(1); }} className="cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            onClick={() => { setStatusFilter(""); setPage(1); }}
            className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Expanded Filters */}
      {filtersOpen && (
        <div className="bg-gray-50 rounded-lg border border-gray-300 p-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
            <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="deceased">Deceased</option>
            </Select>
          </div>
        </div>
      )}

      {/* Desktop Table */}
      <Card className="hidden md:block overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <Th>Patient ID</Th>
              <Th>Name</Th>
              <Th>CNIC / Phone</Th>
              <Th>Gender / Age</Th>
              <Th>Blood</Th>
              <Th>Status</Th>
              <Th>Registered</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  {[...Array(8)].map((_, j) => (
                    <Td key={j}><div className="h-4 bg-gray-100 rounded" /></Td>
                  ))}
                </tr>
              ))
            ) : patients.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    title="No patients found"
                    description={debouncedSearch ? `No results for "${debouncedSearch}"` : "Add your first patient to get started."}
                    action={canCreate ? (
                      <Button size="sm" onClick={() => setCreateOpen(true)}>
                        <Plus className="w-3.5 h-3.5" /> Add Patient
                      </Button>
                    ) : undefined}
                  />
                </td>
              </tr>
            ) : (
              patients.map((p) => (
                <tr key={p._id}>
                  <Td>
                    <span className="font-medium text-gray-900 font-mono text-xs">{p.patientId}</span>
                  </Td>
                  <Td>
                    <div className="font-medium text-gray-900">{p.fullName || `${p.firstName} ${p.lastName}`}</div>
                    {p.email && <div className="text-[11px] text-gray-400">{p.email}</div>}
                  </Td>
                  <Td className="text-gray-600">
                    <div>{p.phone}</div>
                    {p.cnic && <div className="text-[11px] text-gray-400 font-mono">{formatCNIC(p.cnic)}</div>}
                  </Td>
                  <Td className="capitalize text-gray-600">
                    {p.gender}
                    {p.dateOfBirth && (
                      <span className="text-xs text-gray-400 ml-1">
                        (
                        {(() => {
                          const birth = new Date(p.dateOfBirth);
                          if (isNaN(birth.getTime())) return "";
                          const today = new Date();
                          let age = today.getFullYear() - birth.getFullYear();
                          const m = today.getMonth() - birth.getMonth();
                          if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
                          return `${age}y`;
                        })()}
                        )
                      </span>
                    )}
                  </Td>
                  <Td>
                    {p.bloodGroup ? <Badge variant="outline">{p.bloodGroup}</Badge> : <span className="text-gray-300">—</span>}
                  </Td>
                  <Td><StatusBadge status={p.status} /></Td>
                  <Td className="text-gray-400">{formatDate(p.createdAt)}</Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <Link href={`/patients/${p._id}`}>
                        <Button size="sm">View</Button>
                      </Link>
                      {canDelete && p.status === "active" && (
                        <Button size="sm" variant="danger" onClick={() => setDeleteConfirm({ open: true, id: p._id, label: `${p.patientId} (${p.firstName} ${p.lastName})` })}>
                          <Archive className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-300 flex justify-end">
            <Pagination page={page} totalPages={pagination.totalPages} onPage={setPage} />
          </div>
        )}
      </Card>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-gray-100 border border-gray-300 rounded-lg bg-white">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="p-3 flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 bg-gray-100 rounded w-28" />
                <div className="h-3 bg-gray-100 rounded w-20" />
              </div>
              <div className="h-7 bg-gray-100 rounded w-14" />
            </div>
          ))
        ) : patients.length === 0 ? (
          <EmptyState
            title="No patients found"
            description={debouncedSearch ? `No results for "${debouncedSearch}"` : "Add your first patient."}
            action={canCreate ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="w-3.5 h-3.5" /> Add Patient
              </Button>
            ) : undefined}
          />
        ) : (
          patients.map((p) => (
            <div key={p._id} className="flex items-center justify-between p-3 gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-900">
                    {p.fullName || `${p.firstName} ${p.lastName}`}
                  </span>
                  <StatusBadge status={p.status} />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500 font-mono">{p.patientId}</span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-500">{p.phone}</span>
                </div>
                {p.cnic && <div className="text-[10px] text-gray-400 font-mono mt-0.5">CNIC: {formatCNIC(p.cnic)}</div>}
              </div>
              <div className="flex items-center gap-1">
                <Link href={`/patients/${p._id}`}>
                  <Button size="sm">View</Button>
                </Link>
                {canDelete && p.status === "active" && (
                  <Button size="sm" variant="danger" onClick={() => setDeleteConfirm({ open: true, id: p._id, label: `${p.patientId} (${p.firstName} ${p.lastName})` })}>
                    <Archive className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 flex justify-center">
            <Pagination page={page} totalPages={pagination.totalPages} onPage={setPage} />
          </div>
        )}
      </div>

      {/* Register New Patient Modal */}
      <Modal open={createOpen} onClose={handleModalClose} title="Register New Patient" size="lg">
        {createError && <Alert type="error">{createError}</Alert>}
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4 mt-2">
          {/* Default Required Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="First Name" required error={errors.firstName?.message}>
              <Input {...register("firstName")} error={!!errors.firstName} placeholder="First name" />
            </FormField>
            <FormField label="Last Name" required error={errors.lastName?.message}>
              <Input {...register("lastName")} error={!!errors.lastName} placeholder="Last name" />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Gender" required error={errors.gender?.message}>
              <Select {...register("gender")} error={!!errors.gender}>
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
            </FormField>
            <FormField label="Date of Birth" required error={errors.dateOfBirth?.message}>
              <Input type="date" {...register("dateOfBirth")} error={!!errors.dateOfBirth} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Phone Number" required error={errors.phone?.message}>
              <Input {...register("phone")} error={!!errors.phone} placeholder="+92 300 1234567" />
            </FormField>
          </div>

          {/* Non-blocking phone duplicate warning */}
          {phoneWarning.isDuplicate && phoneWarning.matches.length > 0 && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Notice:</span> Another patient shares this phone number (Shared family number):
                <ul className="mt-1 space-y-0.5 font-medium text-amber-900">
                  {phoneWarning.matches.map((m: any) => (
                    <li key={m._id}>
                      • {m.name} ({m.patientId}) — Status: <span className="capitalize">{m.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Optional Section: CNIC */}
          <OptionalToggleHeader label="Add CNIC" checked={showCnic} onChange={setShowCnic} />
          {showCnic && (
            <div className="pt-2">
              <FormField label="CNIC (Optional 13 Digits)" hint="Format: 34104-2611716-1" error={errors.cnic?.message}>
                <Input
                  value={formatCNIC(rawCnic)}
                  onChange={(e) => {
                    const normalized = normalizeCNIC(e.target.value);
                    setValue("cnic", normalized, { shouldValidate: true });
                  }}
                  placeholder="34104-2611716-1"
                  maxLength={15}
                  inputMode="numeric"
                />
              </FormField>
            </div>
          )}

          {/* Optional Section: Address Information */}
          <OptionalToggleHeader label="Add Address Information" checked={showAddress} onChange={setShowAddress} />
          {showAddress && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <FormField label="Street Address">
                <Input {...register("address.street")} placeholder="Street address" />
              </FormField>
              <FormField label="City">
                <Input {...register("address.city")} placeholder="City" />
              </FormField>
              <FormField label="State / Province">
                <Input {...register("address.state")} placeholder="State/Province" />
              </FormField>
              <FormField label="Country">
                <Input {...register("address.country")} placeholder="Country" />
              </FormField>
            </div>
          )}

          {/* Optional Section: Guardian / Next of Kin */}
          <OptionalToggleHeader label="Add Guardian / Next of Kin" checked={showGuardian} onChange={setShowGuardian} />
          {showGuardian && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <FormField label="Full Name">
                <Input {...register("emergencyContact.name")} placeholder="Guardian full name" />
              </FormField>
              <FormField label="Relationship">
                <Input {...register("emergencyContact.relationship")} placeholder="e.g. Parent, Spouse, Sibling" />
              </FormField>
              <FormField label="Phone Number">
                <Input {...register("emergencyContact.phone")} placeholder="+92 300 0000000" />
              </FormField>
              <FormField label="Email Address" error={errors.emergencyContact?.email?.message}>
                <Input type="email" {...register("emergencyContact.email")} placeholder="guardian@example.com" />
              </FormField>
            </div>
          )}

          {/* Optional Section: Medical Information */}
          <OptionalToggleHeader label="Add Medical Information" checked={showMedical} onChange={setShowMedical} />
          {showMedical && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Blood Group">
                  <Select {...register("bloodGroup")}>
                    <option value="">Unknown</option>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Allergies (comma-separated)">
                  <Input
                    defaultValue={watchedAllergies?.join(", ") || ""}
                    onBlur={(e) => {
                      const val = e.target.value;
                      setValue("allergies", val.split(",").map(s => s.trim()).filter(Boolean));
                    }}
                    placeholder="e.g., Penicillin, Nuts"
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Chronic Diseases (comma-separated)">
                  <Input
                    defaultValue={watchedChronicDiseases?.join(", ") || ""}
                    onBlur={(e) => {
                      const val = e.target.value;
                      setValue("chronicDiseases", val.split(",").map(s => s.trim()).filter(Boolean));
                    }}
                    placeholder="e.g., Diabetes, Hypertension"
                  />
                </FormField>
              </div>
            </div>
          )}

          {/* Optional Section: Insurance Details */}
          <OptionalToggleHeader label="Add Insurance Details" checked={showInsurance} onChange={setShowInsurance} />
          {showInsurance && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <FormField label="Insurance Provider">
                <Input {...register("insuranceDetails.provider")} placeholder="Insurance company" />
              </FormField>
              <FormField label="Policy Number">
                <Input {...register("insuranceDetails.policyNumber")} placeholder="Policy number" />
              </FormField>
              <FormField label="Expiry Date">
                <Input type="date" {...register("insuranceDetails.expiryDate")} />
              </FormField>
              <FormField label="Coverage Details">
                <Input {...register("insuranceDetails.coverageDetails")} placeholder="Coverage details" />
              </FormField>
            </div>
          )}

          {/* Optional Section: Patient Portal Access */}
          <OptionalToggleHeader label="Enable Patient Portal Access" icon={ShieldCheck} checked={enablePortal} onChange={setEnablePortal} hint="Allows patient to log in using Email + Password to view records online" />
          {enablePortal && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 p-3 bg-teal-50/50 rounded-xl border border-teal-100">
              <FormField label="Portal Email Address" required error={errors.email?.message}>
                <Input
                  type="email"
                  {...register("email")}
                  placeholder="patient@example.com"
                  error={!!errors.email}
                />
              </FormField>
              <FormField label="Portal Password" required error={errors.portalPassword?.message}>
                <div className="relative">
                  <Input
                    type={showPortalPassword ? "text" : "password"}
                    {...register("portalPassword")}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    className="pr-10"
                    error={!!errors.portalPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPortalPassword(!showPortalPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPortalPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FormField>
            </div>
          )}

          {/* Optional Section: Notes */}
          <OptionalToggleHeader label="Add Notes" checked={showNotes} onChange={setShowNotes} />
          {showNotes && (
            <div className="pt-2">
              <FormField label="Notes">
                <textarea
                  {...register("notes")}
                  rows={2}
                  placeholder="Any relevant notes..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs resize-none focus:outline-none focus:border-teal-600 text-gray-700 placeholder:text-gray-400"
                />
              </FormField>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-300">
            <Button type="button" variant="secondary" onClick={handleModalClose}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>Register Patient</Button>
          </div>
        </form>
      </Modal>

      {/* Archive Patient Modal */}
      <Modal open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, id: "", label: "" })} title="Archive Patient Record" size="sm">
        <div className="space-y-4 mt-2">
          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <Archive className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-900">Archive this patient?</p>
              <p className="text-xs text-amber-700 mt-0.5">This will archive <strong>{deleteConfirm.label}</strong>. Historical medical records, appointments, and billing invoices remain preserved.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-300">
            <Button variant="secondary" onClick={() => setDeleteConfirm({ open: false, id: "", label: "" })}>Cancel</Button>
            <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteConfirm.id)}>Archive Patient</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}