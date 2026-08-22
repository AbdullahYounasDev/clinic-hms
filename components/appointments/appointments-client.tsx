// components/appointments/appointments-client.tsx
"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { Plus, Search, Filter, ChevronDown, X, Trash2, Hash, RefreshCw, UserPlus, Eye, EyeOff, AlertTriangle, ShieldCheck } from "lucide-react";
import {
  Card, Table, Th, Td, StatusBadge, Button,
  Modal, FormField, Input, Select, EmptyState, Pagination, Alert, Badge,
} from "@/components/ui";
import { createAppointmentSchema, CreateAppointmentInput, createPatientSchema, CreatePatientInput } from "@/lib/validations";
import { formatDate, cn } from "@/lib/utils";
import { useClinicSettings } from "@/components/providers/clinic-provider";
import { formatCNIC, normalizeCNIC } from "@/lib/utils/cnic-utils";
import { TIME_SLOTS } from "@/constants/appointments";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";

interface Appointment {
  _id: string;
  appointmentId: string;
  patient: { _id: string; firstName: string; lastName: string; patientId: string };
  doctor: { _id: string; user: { firstName: string; lastName: string }; doctorId: string };
  scheduledDate: string;
  scheduledTime: string;
  type: string;
  status: string;
  chiefComplaint?: string;
  consultationFee: number;
  duration: number;
  queueNumber?: number;
}

interface DoctorQueueSummary {
  doctorId: string;
  doctorName: string;
  specialization: string;
  nowServing: number;
  totalTokens: number;
  waiting: number;
  completed: number;
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

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function AppointmentsClient() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("in_queue");
  const [dateFilter, setDateFilter] = useState(getTodayString);
  const [doctorFilter, setDoctorFilter] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [activeCreateTab, setActiveCreateTab] = useState<"appointment" | "patient">("appointment");
  const [createError, setCreateError] = useState("");
  const [patientFormError, setPatientFormError] = useState("");

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; label: string }>({ open: false, id: "", label: "" });

  // Optional Section Toggles for Create Patient Tab
  const [showCnic, setShowCnic] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [showGuardian, setShowGuardian] = useState(false);
  const [showMedical, setShowMedical] = useState(false);
  const [showInsurance, setShowInsurance] = useState(false);
  const [enablePortal, setEnablePortal] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showPortalPassword, setShowPortalPassword] = useState(false);

  const { formatTime } = useClinicSettings();
  const perms = session?.user.permissions || [];
  const isSA = session?.user.isSuperAdmin;
  const isDoctorUser = !isSA && (session?.user?.roleSlug === "doctor" || session?.user?.role?.toLowerCase()?.includes("doctor"));
  const canCreate = isSA || perms.includes("appointments:create");
  const canDelete = isSA || perms.includes("appointments:delete");

  const activeFiltersCount = [statusFilter, dateFilter, !isDoctorUser ? doctorFilter : ""].filter(Boolean).length;

  // Search Debouncing (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["appointments", page, debouncedSearch, statusFilter, dateFilter, doctorFilter],
    queryFn: () => {
      const params: any = { page, limit: 25 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (dateFilter) params.date = dateFilter;
      if (doctorFilter) params.doctor = doctorFilter;
      return axios.get("/api/appointments", { params }).then((r) => r.data);
    },
  });

  const {
    data: patientsData,
    isFetching: isFetchingPatients,
    refetch: refetchPatients,
  } = useQuery({
    queryKey: ["patients-select"],
    queryFn: () => axios.get("/api/publicPatients", { params: { limit: 200 } }).then((r) => r.data),
  });

  const { data: doctorsData } = useQuery({
    queryKey: ["doctors-select"],
    queryFn: () => axios.get("/api/doctors", { params: { limit: 100 } }).then((r) => r.data),
  });

  const appointments: Appointment[] = data?.data || [];
  const pagination = data?.pagination;
  const patients = patientsData?.data || [];
  const doctors = doctorsData?.data || [];

  // Queue status — polls every 15s, only when viewing today's appointments
  const todayStr = getTodayString();
  const isViewingToday = !dateFilter || dateFilter === todayStr;
  const {
    data: queueData,
    isFetching: queueFetching,
    refetch: refetchQueue,
  } = useQuery<{ success: boolean; data: DoctorQueueSummary[] }>({
    queryKey: ["queue-status-appointments"],
    queryFn: () => axios.get("/api/appointments/queue-status").then((r) => r.data),
    refetchInterval: 15_000,
    enabled: isViewingToday,
  });
  const queueSummaries = queueData?.data || [];

  // Appointment Form
  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<CreateAppointmentInput>({
    resolver: zodResolver(createAppointmentSchema) as any,
    defaultValues: {
      patient: "", doctor: "", type: "opd", scheduledDate: dateFilter || todayStr,
      scheduledTime: "", duration: 30, consultationFee: 0, chiefComplaint: "", notes: "",
    },
  });

  // Patient Registration Form (inside Tab 2)
  const {
    register: registerPatient,
    handleSubmit: handleSubmitPatient,
    reset: resetPatientForm,
    setValue: setPatientValue,
    control: patientControl,
    formState: { errors: patientErrors },
  } = useForm<CreatePatientInput>({ resolver: zodResolver(createPatientSchema) });

  const watchedDoctor = useWatch({ control, name: "doctor" });
  const watchedDate = useWatch({ control, name: "scheduledDate" });
  const watchedType = useWatch({ control, name: "type" });
  const watchedScheduledTime = useWatch({ control, name: "scheduledTime" });
  const watchedDuration = useWatch({ control, name: "duration" });

  const rawCnic = useWatch({ control: patientControl, name: "cnic" });
  const watchedAllergies = useWatch({ control: patientControl, name: "allergies" });
  const watchedChronicDiseases = useWatch({ control: patientControl, name: "chronicDiseases" });

  const formSelectedDoctorObj = doctors.find((d: any) => String(d._id) === String(watchedDoctor));
  const doctorDefaultDuration = formSelectedDoctorObj?.appointmentDuration || 30;
  const canOverrideDuration = isSA || perms.includes("appointments:create") || perms.includes("appointments:override_duration");

  const isCustomDuration = watchedDoctor && watchedDuration !== doctorDefaultDuration;

  const { data: slotsData, isFetching: slotsFetching } = useQuery({
    queryKey: ["available-slots", watchedDoctor, watchedDate, watchedDuration],
    queryFn: () =>
      axios
        .get("/api/appointments/available-slots", {
          params: { doctor: watchedDoctor, date: watchedDate, duration: watchedDuration || 30 },
        })
        .then((r) => r.data),
    enabled: createOpen && activeCreateTab === "appointment" && !!watchedDoctor && !!watchedDate,
  });

  const { data: nextQueueData, isFetching: nextQueueFetching } = useQuery({
    queryKey: ["queue-next", watchedDoctor, watchedDate],
    queryFn: () =>
      axios
        .get("/api/appointments/queue-next", { params: { doctor: watchedDoctor, date: watchedDate } })
        .then((r) => r.data),
    enabled: createOpen && activeCreateTab === "appointment" && !!watchedDoctor && !!watchedDate,
  });

  const previewQueue =
    watchedType === "emergency"
      ? "P (Priority)"
      : nextQueueData?.data?.nextNumber != null
        ? String(nextQueueData.data.nextNumber)
        : "";

  const createMutation = useMutation({
    mutationFn: (d: CreateAppointmentInput) => axios.post("/api/appointments", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["available-slots"] });
      qc.invalidateQueries({ queryKey: ["queue-status-appointments"] });
      qc.invalidateQueries({ queryKey: ["queue-status"] });
      qc.invalidateQueries({ queryKey: ["queue-next"] });
      setCreateOpen(false);
      reset();
      setCreateError("");
      toast.success("Appointment booked successfully!");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to create appointment";
      setCreateError(msg);
      toast.error(msg);
    },
  });

  const createPatientMutation = useMutation({
    mutationFn: (d: CreatePatientInput) => {
      const cleanedData = { ...d };
      if (cleanedData.cnic) cleanedData.cnic = normalizeCNIC(cleanedData.cnic);
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
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["patients-select"] });
      qc.invalidateQueries({ queryKey: ["patients"] });
      const newPatient = res.data?.data;
      if (newPatient?._id) {
        setValue("patient", newPatient._id);
      }
      resetPatientFormState();
      setActiveCreateTab("appointment");
      toast.success("Patient created successfully and selected for appointment!");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to create patient";
      setPatientFormError(msg);
      toast.error(msg);
    },
  });

  const resetPatientFormState = () => {
    resetPatientForm();
    setPatientFormError("");
    setShowPortalPassword(false);
    setShowCnic(false);
    setShowAddress(false);
    setShowGuardian(false);
    setShowMedical(false);
    setShowInsurance(false);
    setEnablePortal(false);
    setShowNotes(false);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/appointments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["available-slots"] });
      qc.invalidateQueries({ queryKey: ["queue-status-appointments"] });
      qc.invalidateQueries({ queryKey: ["queue-status"] });
      setDeleteConfirm({ open: false, id: "", label: "" });
      toast.success("Appointment deleted!");
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to delete"),
  });

  const onPatientFormSubmit = (d: CreatePatientInput) => {
    if (enablePortal) {
      if (!d.email) {
        setPatientFormError("Email is required when Patient Portal Access is enabled.");
        toast.error("Email is required for Patient Portal Access.");
        return;
      }
      if (!d.portalPassword || d.portalPassword.length < 8) {
        setPatientFormError("Portal Password must be at least 8 characters.");
        toast.error("Portal Password must be at least 8 characters.");
        return;
      }
    }
    setPatientFormError("");
    createPatientMutation.mutate(d);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Appointments</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {pagination?.total ?? 0} appointment{pagination?.total !== 1 ? "s" : ""}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => { setActiveCreateTab("appointment"); setCreateOpen(true); }} size="sm">
            <Plus className="w-3.5 h-3.5" /> Book Appointment
          </Button>
        )}
      </div>

      {/* Live Queue Overview Bar (Today view) */}
      {isViewingToday && queueSummaries.length > 0 && (
        <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
              <span className="text-xs font-bold text-teal-900 uppercase tracking-wider">Live OPD Queue Summary</span>
              <span className="text-[10px] text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full font-medium">Today</span>
            </div>
            <button
              onClick={() => refetchQueue()}
              disabled={queueFetching}
              className="inline-flex items-center gap-1 text-xs text-teal-700 hover:text-teal-900 cursor-pointer font-medium"
            >
              <RefreshCw className={cn("w-3 h-3", queueFetching && "animate-spin")} />
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {queueSummaries.map((qs) => (
              <div key={qs.doctorId} className="bg-white rounded-lg p-2.5 border border-teal-100 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-900">{qs.doctorName}</p>
                  <p className="text-[11px] text-gray-500">{qs.specialization}</p>
                  <div className="flex items-center gap-2 mt-1 text-[11px]">
                    <span className="text-amber-700 font-medium">{qs.waiting} waiting</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-emerald-700 font-medium">{qs.completed} done</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Serving</span>
                  <span className="text-base font-bold text-teal-700 font-mono">
                    {qs.nowServing > 0 ? `#${qs.nowServing}` : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search + Filter Toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search patient, doctor, or APT-XXXXXX..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-gray-300 bg-white placeholder:text-gray-400 text-gray-700 focus:outline-none focus:border-teal-600"
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
              Status: {statusFilter.replace("_", " ")}
              <button onClick={() => { setStatusFilter(""); setPage(1); }} className="cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {dateFilter && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-700">
              Date: {formatDate(dateFilter)}
              <button onClick={() => { setDateFilter(""); setPage(1); }} className="cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {doctorFilter && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-700">
              Doctor: Dr. {doctors.find((d: any) => d._id === doctorFilter)?.user?.lastName || doctorFilter}
              <button onClick={() => { setDoctorFilter(""); setPage(1); }} className="cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            onClick={() => {
              setStatusFilter("");
              setDateFilter("");
              setDoctorFilter("");
              setPage(1);
            }}
            className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Expanded Filters */}
      {filtersOpen && (
        <div className="bg-gray-50 rounded-lg border border-gray-300 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
            <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              <option value="in_queue">In Queue (Scheduled/Checked In/In Consultation)</option>
              <option value="scheduled">Scheduled</option>
              <option value="checked_in">Checked In</option>
              <option value="in_consultation">In Consultation</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Date</label>
            <Input type="date" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }} />
          </div>
          {!isDoctorUser && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Doctor</label>
              <Select value={doctorFilter} onChange={(e) => { setDoctorFilter(e.target.value); setPage(1); }}>
                <option value="">All Doctors</option>
                {doctors.map((d: any) => (
                  <option key={d._id} value={d._id}>Dr. {d.user?.firstName} {d.user?.lastName}</option>
                ))}
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Desktop Table */}
      <Card className="hidden md:block overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <Th>ID</Th>
              <Th>Patient</Th>
              <Th>Doctor</Th>
              <Th>Date & Time</Th>
              <Th>Type</Th>
              <Th>Queue Token</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i}>
                  {[...Array(8)].map((_, j) => (
                    <Td key={j}><div className="h-4 bg-gray-100 rounded" /></Td>
                  ))}
                </tr>
              ))
            ) : appointments.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    title="No appointments found"
                    description={debouncedSearch ? `No results for "${debouncedSearch}"` : "Book an appointment to get started."}
                    action={canCreate ? (
                      <Button size="sm" onClick={() => { setActiveCreateTab("appointment"); setCreateOpen(true); }}>
                        <Plus className="w-3.5 h-3.5" /> Book Appointment
                      </Button>
                    ) : undefined}
                  />
                </td>
              </tr>
            ) : (
              appointments.map((a) => (
                <tr key={a._id}>
                  <Td><span className="font-medium text-gray-900 font-mono text-xs">{a.appointmentId}</span></Td>
                  <Td>
                    <Link href={`/patients/${a.patient?._id}`} className="font-medium text-gray-900 hover:text-teal-600">
                      {a.patient?.firstName} {a.patient?.lastName}
                    </Link>
                    <div className="text-[11px] text-gray-400 font-mono">{a.patient?.patientId}</div>
                  </Td>
                  <Td>
                    <div className="font-medium text-gray-900">Dr. {a.doctor?.user?.firstName} {a.doctor?.user?.lastName}</div>
                  </Td>
                  <Td className="text-gray-600">
                    <div>{formatDate(a.scheduledDate)}</div>
                    <div className="text-[11px] text-gray-400">{formatTime(a.scheduledTime)} ({a.duration} min)</div>
                  </Td>
                  <Td><Badge variant="outline" className="capitalize">{a.type?.replace(/_/g, " ")}</Badge></Td>
                  <Td>
                    {a.queueNumber != null ? (
                      <Badge variant={a.queueNumber === 0 ? "warning" : "info"}>
                        #{a.queueNumber === 0 ? "P" : a.queueNumber}
                      </Badge>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </Td>
                  <Td><StatusBadge status={a.status} /></Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <Link href={`/appointments/${a._id}`}>
                        <Button size="sm">View</Button>
                      </Link>
                      {canDelete && (
                        <Button size="sm" variant="danger" onClick={() => setDeleteConfirm({ open: true, id: a._id, label: a.appointmentId })}>
                          <Trash2 className="w-3.5 h-3.5" />
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
            <div key={i} className="p-3 space-y-2">
              <div className="h-4 bg-gray-100 rounded w-28" />
              <div className="h-3 bg-gray-100 rounded w-20" />
            </div>
          ))
        ) : appointments.length === 0 ? (
          <EmptyState
            title="No appointments found"
            description={debouncedSearch ? `No results for "${debouncedSearch}"` : "Book an appointment to get started."}
            action={canCreate ? (
              <Button size="sm" onClick={() => { setActiveCreateTab("appointment"); setCreateOpen(true); }}>
                <Plus className="w-3.5 h-3.5" /> Book Appointment
              </Button>
            ) : undefined}
          />
        ) : (
          appointments.map((a) => (
            <div key={a._id} className="flex items-center justify-between p-3 gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-900">
                    {a.patient?.firstName} {a.patient?.lastName}
                  </span>
                  <StatusBadge status={a.status} />
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Dr. {a.doctor?.user?.firstName} {a.doctor?.user?.lastName}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {formatDate(a.scheduledDate)} • {formatTime(a.scheduledTime)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link href={`/appointments/${a._id}`}>
                  <Button size="sm">View</Button>
                </Link>
                {canDelete && (
                  <Button size="sm" variant="danger" onClick={() => setDeleteConfirm({ open: true, id: a._id, label: a.appointmentId })}>
                    <Trash2 className="w-3.5 h-3.5" />
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

      {/* Create Modal with Exactly Two Tabs: [Create Appointment] & [Create Patient] */}
      <Modal open={createOpen} onClose={() => { setCreateOpen(false); reset(); setCreateError(""); resetPatientFormState(); }} title="Book Appointment" size="lg">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-4 select-none">
          <button
            type="button"
            onClick={() => setActiveCreateTab("appointment")}
            className={cn(
              "flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors cursor-pointer",
              activeCreateTab === "appointment"
                ? "border-teal-600 text-teal-700 bg-teal-50/50"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            1. Create Appointment
          </button>
          <button
            type="button"
            onClick={() => setActiveCreateTab("patient")}
            className={cn(
              "flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5",
              activeCreateTab === "patient"
                ? "border-teal-600 text-teal-700 bg-teal-50/50"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <UserPlus className="w-3.5 h-3.5 text-teal-600" />
            2. Create New Patient
          </button>
        </div>

        {/* Tab 1: Create Appointment */}
        {activeCreateTab === "appointment" && (
          <>
            {createError && <Alert type="error">{createError}</Alert>}
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d as any))} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Patient" required error={errors.patient?.message}>
                  <div className="flex items-center gap-1.5">
                    <Select {...register("patient")} disabled={isFetchingPatients} error={!!errors.patient} className="flex-1">
                      <option value="">{isFetchingPatients ? "Loading patients..." : "Select patient"}</option>
                      {patients.map((p: { _id: string; firstName: string; lastName: string; patientId: string; phone?: string }) => (
                        <option key={p._id} value={p._id}>
                          {p.firstName} {p.lastName} ({p.patientId}) {p.phone ? `— ${p.phone}` : ""}
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => refetchPatients()}
                      loading={isFetchingPatients}
                      title="Refresh Patient List"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", isFetchingPatients && "animate-spin")} />
                    </Button>
                  </div>
                </FormField>

                <FormField label="Doctor" required error={errors.doctor?.message}>
                  <Select
                    {...register("doctor", {
                      onChange: (e) => {
                        const doctorId = e.target.value;
                        const doctor = doctors.find((d: any) => d._id === doctorId);
                        if (doctor?.consultationFee) setValue("consultationFee", doctor.consultationFee);
                        if (doctor?.appointmentDuration) setValue("duration", doctor.appointmentDuration);
                        setValue("scheduledTime", "");
                      },
                    })}
                    error={!!errors.doctor}
                  >
                    <option value="">Select doctor</option>
                    {doctors.map((d: any) => (
                      <option key={d._id} value={d._id}>Dr. {d.user?.firstName} {d.user?.lastName} ({d.doctorId})</option>
                    ))}
                  </Select>
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <FormField label="Date" required error={errors.scheduledDate?.message}>
                  <Input
                    type="date"
                    {...register("scheduledDate", {
                      onChange: () => setValue("scheduledTime", ""),
                    })}
                    error={!!errors.scheduledDate}
                  />
                </FormField>
                <FormField
                  label={
                    <span className="flex items-center gap-1.5">
                      <span>Est. Duration</span>
                      {isCustomDuration && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.5 rounded border border-amber-200">
                          Custom Override
                        </span>
                      )}
                    </span>
                  }
                >
                  <Select
                    {...register("duration", {
                      valueAsNumber: true,
                      onChange: () => setValue("scheduledTime", ""),
                    })}
                    disabled={!canOverrideDuration}
                  >
                    <option value={5}>5 mins</option>
                    <option value={10}>10 mins</option>
                    <option value={15}>15 mins</option>
                    <option value={20}>20 mins</option>
                    <option value={30}>30 mins</option>
                    <option value={45}>45 mins</option>
                    <option value={60}>60 mins (1 Hour)</option>
                    <option value={120}>120 mins (2 Hours)</option>
                  </Select>
                </FormField>
                <FormField label="Type">
                  <Select {...register("type")}>
                    <option value="opd">OPD</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="emergency">Emergency</option>
                    <option value="teleconsultation">Teleconsultation</option>
                  </Select>
                </FormField>
                <FormField label="Queue No.">
                  <Input
                    value={watchedDoctor && watchedDate ? (nextQueueFetching && watchedType !== "emergency" ? "…" : previewQueue) : ""}
                    placeholder={!watchedDoctor || !watchedDate ? "Select doctor & date" : ""}
                    disabled
                  />
                </FormField>
              </div>

              {/* Dynamic Available Time Slot Selector */}
              <div className="space-y-2 pt-2 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-800">
                    Select Time Slot <span className="text-red-500">*</span>
                  </label>
                  {slotsData?.data?.appointmentDuration && (
                    <span className="text-[11px] text-gray-500 font-medium">
                      Slot Duration: {slotsData.data.appointmentDuration} mins
                    </span>
                  )}
                </div>

                {!watchedDoctor || !watchedDate ? (
                  <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center text-xs text-gray-500">
                    Please select a doctor and date to calculate available appointment slots.
                  </div>
                ) : slotsFetching ? (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                    Calculating available slots...
                  </div>
                ) : slotsData?.data?.isHoliday ? (
                  <Alert type="warning">
                    Clinic is closed on this date: <strong>{slotsData.data.holidayReason || "Clinic Holiday"}</strong>
                  </Alert>
                ) : slotsData?.data?.isOnLeave ? (
                  <Alert type="warning">
                    Doctor is on leave on this date: <strong>{slotsData.data.leaveReason || "On Leave"}</strong>
                  </Alert>
                ) : slotsData?.data?.isWorkingDay === false ? (
                  <Alert type="warning">
                    Doctor is not scheduled to work on this day.
                  </Alert>
                ) : slotsData?.data?.slots?.length === 0 ? (
                  <Alert type="warning">
                    No time slots available for the selected day.
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1 border rounded-lg bg-gray-50/50">
                      {slotsData?.data?.slots?.map((s: { time: string; displayTime: string; available: boolean; reasonText?: string }) => {
                        const isSelected = watchedScheduledTime === s.time;
                        return (
                          <button
                            key={s.time}
                            type="button"
                            disabled={!s.available}
                            onClick={() => {
                              setValue("scheduledTime", s.time, { shouldValidate: true });
                              setCreateError("");
                            }}
                            className={cn(
                              "flex flex-col items-center justify-center py-2 px-1.5 rounded-md text-xs font-medium transition-all border cursor-pointer",
                              isSelected
                                ? "bg-teal-600 text-white border-teal-600 shadow-sm ring-2 ring-teal-600/30"
                                : s.available
                                  ? "bg-white border-teal-200 text-teal-900 hover:bg-teal-50 hover:border-teal-400"
                                  : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60"
                            )}
                            title={!s.available ? s.reasonText || "Unavailable" : `Book for ${s.displayTime}`}
                          >
                            <span>{s.displayTime}</span>
                            {!s.available && (
                              <span className="text-[9px] font-normal leading-tight text-gray-500 mt-0.5">
                                {s.reasonText}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {errors.scheduledTime && (
                      <p className="text-xs text-red-500 font-medium">{errors.scheduledTime.message}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Consultation Fee (PKR)">
                  <Input type="number" {...register("consultationFee", { valueAsNumber: true })} placeholder="0" disabled />
                </FormField>
                <FormField label="Chief Complaint">
                  <Input {...register("chiefComplaint")} placeholder="Reason for visit..." />
                </FormField>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-300">
                <Button type="button" variant="secondary" onClick={() => { setCreateOpen(false); reset(); resetPatientFormState(); }}>
                  Cancel
                </Button>
                <Button type="submit" loading={createMutation.isPending}>Book Appointment</Button>
              </div>
            </form>
          </>
        )}

        {/* Tab 2: Create Patient */}
        {activeCreateTab === "patient" && (
          <>
            {patientFormError && <Alert type="error">{patientFormError}</Alert>}
            <form onSubmit={handleSubmitPatient(onPatientFormSubmit)} className="space-y-4">
              {/* Default Required Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="First Name" required error={patientErrors.firstName?.message}>
                  <Input {...registerPatient("firstName")} error={!!patientErrors.firstName} placeholder="First name" />
                </FormField>
                <FormField label="Last Name" required error={patientErrors.lastName?.message}>
                  <Input {...registerPatient("lastName")} error={!!patientErrors.lastName} placeholder="Last name" />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Gender" required error={patientErrors.gender?.message}>
                  <Select {...registerPatient("gender")} error={!!patientErrors.gender}>
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </Select>
                </FormField>
                <FormField label="Date of Birth" required error={patientErrors.dateOfBirth?.message}>
                  <Input type="date" {...registerPatient("dateOfBirth")} error={!!patientErrors.dateOfBirth} />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Phone Number" error={patientErrors.phone?.message}>
                  <Input {...registerPatient("phone")} error={!!patientErrors.phone} placeholder="+92 300 1234567" />
                </FormField>
              </div>

              {/* Optional Section: CNIC */}
              <OptionalToggleHeader label="Add CNIC" checked={showCnic} onChange={setShowCnic} />
              {showCnic && (
                <div className="pt-2">
                  <FormField label="CNIC (Optional 13 Digits)" hint="Format: 34104-2611716-1" error={patientErrors.cnic?.message}>
                    <Input
                      value={formatCNIC(rawCnic)}
                      onChange={(e) => {
                        const normalized = normalizeCNIC(e.target.value);
                        setPatientValue("cnic", normalized, { shouldValidate: true });
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
                    <Input {...registerPatient("address.street")} placeholder="Street address" />
                  </FormField>
                  <FormField label="City">
                    <Input {...registerPatient("address.city")} placeholder="City" />
                  </FormField>
                  <FormField label="State / Province">
                    <Input {...registerPatient("address.state")} placeholder="State/Province" />
                  </FormField>
                  <FormField label="Country">
                    <Input {...registerPatient("address.country")} placeholder="Country" />
                  </FormField>
                </div>
              )}

              {/* Optional Section: Guardian / Next of Kin */}
              <OptionalToggleHeader label="Add Guardian / Next of Kin" checked={showGuardian} onChange={setShowGuardian} hint="Primary family or legal guardian contact" />
              {showGuardian && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <FormField label="Full Name">
                    <Input {...registerPatient("emergencyContact.name")} placeholder="Guardian full name" />
                  </FormField>
                  <FormField label="Relationship">
                    <Input {...registerPatient("emergencyContact.relationship")} placeholder="e.g. Parent, Spouse, Sibling" />
                  </FormField>
                  <FormField label="Phone Number">
                    <Input {...registerPatient("emergencyContact.phone")} placeholder="+92 300 0000000" />
                  </FormField>
                  <FormField label="Email Address" error={patientErrors.emergencyContact?.email?.message}>
                    <Input type="email" {...registerPatient("emergencyContact.email")} placeholder="guardian@example.com" />
                  </FormField>
                </div>
              )}

              {/* Optional Section: Medical Information */}
              <OptionalToggleHeader label="Add Medical Information" checked={showMedical} onChange={setShowMedical} />
              {showMedical && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Blood Group">
                      <Select {...registerPatient("bloodGroup")}>
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
                          setPatientValue("allergies", val.split(",").map(s => s.trim()).filter(Boolean));
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
                          setPatientValue("chronicDiseases", val.split(",").map(s => s.trim()).filter(Boolean));
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
                    <Input {...registerPatient("insuranceDetails.provider")} placeholder="Insurance company" />
                  </FormField>
                  <FormField label="Policy Number">
                    <Input {...registerPatient("insuranceDetails.policyNumber")} placeholder="Policy number" />
                  </FormField>
                  <FormField label="Expiry Date">
                    <Input type="date" {...registerPatient("insuranceDetails.expiryDate")} />
                  </FormField>
                  <FormField label="Coverage Details">
                    <Input {...registerPatient("insuranceDetails.coverageDetails")} placeholder="Coverage details" />
                  </FormField>
                </div>
              )}

              {/* Optional Section: Patient Portal Access */}
              <OptionalToggleHeader label="Enable Patient Portal Access" icon={ShieldCheck} checked={enablePortal} onChange={setEnablePortal} hint="Allows patient to log in using Email + Password to view records online" />
              {enablePortal && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 p-3 bg-teal-50/50 rounded-xl border border-teal-100">
                  <FormField label="Portal Email Address" required error={patientErrors.email?.message}>
                    <Input
                      type="email"
                      {...registerPatient("email")}
                      placeholder="patient@example.com"
                      error={!!patientErrors.email}
                    />
                  </FormField>
                  <FormField label="Portal Password" required error={patientErrors.portalPassword?.message}>
                    <div className="relative">
                      <Input
                        type={showPortalPassword ? "text" : "password"}
                        {...registerPatient("portalPassword")}
                        placeholder="Min. 8 characters"
                        autoComplete="new-password"
                        className="pr-10"
                        error={!!patientErrors.portalPassword}
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
                      {...registerPatient("notes")}
                      rows={2}
                      placeholder="Any relevant notes..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs resize-none focus:outline-none focus:border-teal-600 text-gray-700 placeholder:text-gray-400"
                    />
                  </FormField>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-300">
                <Button type="button" variant="secondary" onClick={() => setActiveCreateTab("appointment")}>
                  Back to Appointment
                </Button>
                <Button type="submit" loading={createPatientMutation.isPending}>Save & Select Patient</Button>
              </div>
            </form>
          </>
        )}
      </Modal>

      <Modal open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, id: "", label: "" })} title="Delete Appointment" size="sm">
        <div className="space-y-4 mt-2">
          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
            <Trash2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-800">Delete permanently?</p>
              <p className="text-xs text-red-600 mt-0.5">This will permanently delete <strong>{deleteConfirm.label}</strong>.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-300">
            <Button variant="secondary" onClick={() => setDeleteConfirm({ open: false, id: "", label: "" })}>Cancel</Button>
            <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteConfirm.id)}>Delete Permanently</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}