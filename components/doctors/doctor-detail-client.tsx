"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  ArrowLeft, Mail, Phone, Calendar, Stethoscope, Award, Clock, DollarSign,
  Building, Edit2, User, Trash2, Coffee, AlertTriangle, Plus, CheckCircle, XCircle
} from "lucide-react";
import { Card, CardBody, Badge, Button, Skeleton, Alert, Modal, FormField, Input, Select } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { DoctorLeave, WeeklySchedule, DaySchedule } from "@/types";
import { timeToMinutes, minutesToTime, minutesToDisplayTime } from "@/lib/time-utils";
import { useClinicSettings } from "@/components/providers/clinic-provider";

interface Doctor {
  _id: string;
  doctorId: string;
  user: { _id: string; firstName: string; lastName: string; email: string; phone: string; avatar?: string; status: string };
  specialization: string;
  department?: { _id: string; name: string; code: string };
  qualifications: string[];
  experience: number;
  consultationFee: number;
  appointmentDuration?: number;
  weeklySchedule?: WeeklySchedule;
  leaves?: DoctorLeave[];
  isAvailable: boolean;
  bio?: string;
  languages: string[];
  createdAt: string;
  updatedAt: string;
}

interface EditDoctorInput {
  specialization: string;
  department: string;
  qualifications: string;
  experience: number;
  consultationFee: number;
  appointmentDuration: number;
  bio: string;
  languages: string;
  isAvailable: boolean;
}

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

export function DoctorDetailClient({ doctorId }: { doctorId: string }) {
  const { formatTime } = useClinicSettings();
  const { data: session } = useSession();
  const router = useRouter();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Leave Form State
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveNotes, setLeaveNotes] = useState("");
  const [leaveConflictData, setLeaveConflictData] = useState<{ conflictCount: number; appointments: Array<{ id: string; appointmentId: string; date: string; time: string; patientName: string }> } | null>(null);

  // Weekly Schedule State
  const [scheduleState, setScheduleState] = useState<WeeklySchedule>({});

  const isSA = session?.user.isSuperAdmin;
  const perms = session?.user.permissions || [];
  const canUpdate = isSA || perms.includes("doctors:update");
  const canDelete = isSA || perms.includes("doctors:delete");

  const { data, isLoading, error: queryError } = useQuery({
    queryKey: ["doctor", doctorId],
    queryFn: () => axios.get(`/api/doctors/${doctorId}`).then((r) => r.data),
    enabled: !!doctorId,
  });

  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: () => axios.get("/api/settings").then((r) => r.data),
  });

  const clinicSettings = settingsData?.data;
  const clinicWorkingDays: Array<{ day: string; openingTime: string; closingTime: string; breakStart?: string; breakEnd?: string; isOpen?: boolean }> =
    clinicSettings?.workingDays || [];

  const { data: deptData } = useQuery({
    queryKey: ["departments"],
    queryFn: () => axios.get("/api/settings/departments").then((r) => r.data),
    enabled: editOpen,
  });

  const departments = deptData?.data || [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditDoctorInput>({
    defaultValues: {
      specialization: "",
      department: "",
      qualifications: "",
      experience: 0,
      consultationFee: 0,
      appointmentDuration: 30,
      bio: "",
      languages: "",
      isAvailable: true,
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => axios.put(`/api/doctors/${doctorId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor", doctorId] });
      qc.invalidateQueries({ queryKey: ["doctors"] });
      setEditOpen(false);
      setScheduleOpen(false);
      setError("");
      setSuccess("Doctor profile & schedule updated successfully");
      toast.success("Doctor details updated");
      setTimeout(() => setSuccess(""), 3000);
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error || "Failed to update doctor profile";
      setError(msg);
      toast.error(msg);
    },
  });

  const addLeaveMutation = useMutation({
    mutationFn: (leaveData: any) => axios.post(`/api/doctors/${doctorId}/leaves`, leaveData),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["doctor", doctorId] });
      const conflicts = res.data?.data?.conflicts;
      if (conflicts && conflicts.conflictCount > 0) {
        setLeaveConflictData(conflicts);
        toast.warning(`Leave added. Warning: ${conflicts.conflictCount} existing appointment(s) conflict with this leave!`);
      } else {
        setLeaveOpen(false);
        setLeaveDate("");
        setLeaveReason("");
        setLeaveNotes("");
        setLeaveConflictData(null);
        toast.success("Doctor leave added successfully");
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed to add doctor leave"),
  });

  const deleteLeaveMutation = useMutation({
    mutationFn: (leaveId: string) => axios.delete(`/api/doctors/${doctorId}/leaves`, { params: { leaveId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor", doctorId] });
      toast.success("Doctor leave deleted");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed to delete leave"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => axios.delete(`/api/doctors/${doctorId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctors"] });
      toast.success("Doctor deleted!");
      router.push("/doctors");
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error || "Failed to delete doctor";
      setError(msg);
      toast.error(msg);
    },
  });

  // Build doctor schedule state based on clinic working days
  const buildScheduleFromClinicSettings = (docSchedule?: WeeklySchedule): WeeklySchedule => {
    const result: WeeklySchedule = {};

    WEEKDAYS.forEach((day) => {
      const clinicDay = clinicWorkingDays.find((wd) => wd.day.toLowerCase() === day);
      const isClinicOpen = clinicDay ? clinicDay.isOpen !== false : false;

      const clinicOpen24 = clinicDay?.openingTime ? minutesToTime(timeToMinutes(clinicDay.openingTime)) : "09:00";
      const clinicClose24 = clinicDay?.closingTime ? minutesToTime(timeToMinutes(clinicDay.closingTime)) : "17:00";
      const clinicBreakStart24 = clinicDay?.breakStart ? minutesToTime(timeToMinutes(clinicDay.breakStart)) : "";
      const clinicBreakEnd24 = clinicDay?.breakEnd ? minutesToTime(timeToMinutes(clinicDay.breakEnd)) : "";

      const existingDay = docSchedule?.[day];

      if (existingDay) {
        result[day] = {
          isWorking: isClinicOpen ? existingDay.isWorking : false,
          startTime: existingDay.startTime || clinicOpen24,
          endTime: existingDay.endTime || clinicClose24,
          breakStart: existingDay.breakStart ?? clinicBreakStart24,
          breakEnd: existingDay.breakEnd ?? clinicBreakEnd24,
        };
      } else {
        result[day] = {
          isWorking: isClinicOpen,
          startTime: clinicOpen24,
          endTime: clinicClose24,
          breakStart: clinicBreakStart24,
          breakEnd: clinicBreakEnd24,
        };
      }
    });

    return result;
  };

  const openEditModal = () => {
    if (data?.data) {
      const doc = data.data;
      reset({
        specialization: doc.specialization,
        department: doc.department?._id || "",
        qualifications: doc.qualifications?.join(", ") || "",
        experience: doc.experience || 0,
        consultationFee: doc.consultationFee || 0,
        appointmentDuration: doc.appointmentDuration || 30,
        bio: doc.bio || "",
        languages: doc.languages?.join(", ") || "",
        isAvailable: doc.isAvailable,
      });
      setEditOpen(true);
    }
  };

  const openScheduleModal = () => {
    if (data?.data) {
      const doc = data.data;
      setScheduleState(buildScheduleFromClinicSettings(doc.weeklySchedule));
      setScheduleOpen(true);
    }
  };

  const onSubmit = (formData: EditDoctorInput) => {
    updateMutation.mutate({
      ...formData,
      qualifications: formData.qualifications ? formData.qualifications.split(",").map((q) => q.trim()).filter(Boolean) : [],
      languages: formData.languages ? formData.languages.split(",").map((l) => l.trim()).filter(Boolean) : [],
    });
  };

  const onSaveSchedule = () => {
    // Client-side validation against clinic operating hours
    for (const day of WEEKDAYS) {
      const daySched = scheduleState[day];
      if (!daySched || !daySched.isWorking) continue;

      const clinicDay = clinicWorkingDays.find((wd) => wd.day.toLowerCase() === day);
      if (!clinicDay || clinicDay.isOpen === false) {
        toast.error(`Cannot set working hours on ${day.toUpperCase()}: Clinic is closed on this day.`);
        return;
      }

      const docStartMins = timeToMinutes(daySched.startTime || "09:00");
      const docEndMins = timeToMinutes(daySched.endTime || "17:00");
      const clinicOpenMins = timeToMinutes(clinicDay.openingTime);
      const clinicCloseMins = timeToMinutes(clinicDay.closingTime);

      const docStartDisp = minutesToDisplayTime(docStartMins);
      const docEndDisp = minutesToDisplayTime(docEndMins);
      const clinicOpenDisp = minutesToDisplayTime(clinicOpenMins);
      const clinicCloseDisp = minutesToDisplayTime(clinicCloseMins);

      if (docStartMins >= docEndMins) {
        toast.error(`${day.toUpperCase()}: Doctor start time (${docStartDisp}) must be earlier than end time (${docEndDisp}).`);
        return;
      }

      if (docStartMins < clinicOpenMins) {
        toast.error(`${day.toUpperCase()}: Doctor start time (${docStartDisp}) cannot be earlier than clinic opening time (${clinicOpenDisp}).`);
        return;
      }

      if (docEndMins > clinicCloseMins) {
        toast.error(`${day.toUpperCase()}: Doctor end time (${docEndDisp}) cannot be later than clinic closing time (${clinicCloseDisp}).`);
        return;
      }

      if (daySched.breakStart || daySched.breakEnd) {
        if (!daySched.breakStart || !daySched.breakEnd) {
          toast.error(`${day.toUpperCase()}: Both break start and break end times are required.`);
          return;
        }

        const bStart = timeToMinutes(daySched.breakStart);
        const bEnd = timeToMinutes(daySched.breakEnd);
        const bStartDisp = minutesToDisplayTime(bStart);
        const bEndDisp = minutesToDisplayTime(bEnd);

        if (bStart >= bEnd) {
          toast.error(`${day.toUpperCase()}: Break start time (${bStartDisp}) must be earlier than break end time (${bEndDisp}).`);
          return;
        }

        if (bStart < docStartMins || bEnd > docEndMins) {
          toast.error(`${day.toUpperCase()}: Doctor break (${bStartDisp} - ${bEndDisp}) must fall inside working hours (${docStartDisp} - ${docEndDisp}).`);
          return;
        }
      }
    }

    updateMutation.mutate({
      weeklySchedule: scheduleState,
    });
  };

  const onAddLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveDate) {
      toast.error("Please select a date for the leave");
      return;
    }
    addLeaveMutation.mutate({
      date: leaveDate,
      startDate: leaveDate,
      endDate: leaveDate,
      reason: leaveReason,
      notes: leaveNotes,
    });
  };

  if (isLoading)
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );

  if (queryError || !data?.data)
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Link href="/doctors">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" /> Back to Doctors
          </Button>
        </Link>
        <Alert type="error">Doctor not found.</Alert>
      </div>
    );

  const d: Doctor = data.data;
  const currentSchedule: WeeklySchedule = buildScheduleFromClinicSettings(d.weeklySchedule);
  const doctorLeaves: DoctorLeave[] = d.leaves || [];

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <Link href="/doctors">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" /> All Doctors
          </Button>
        </Link>
        <div className="flex gap-2">
          {isSA && (
            <Link href={`/users/${d.user?._id}`}>
              <Button variant="outline" size="sm">
                <User className="w-3.5 h-3.5" /> View User
              </Button>
            </Link>
          )}
          {canUpdate && (
            <>
              <Button variant="outline" size="sm" onClick={openScheduleModal}>
                <Clock className="w-3.5 h-3.5" /> Schedule & Hours
              </Button>
              <Button variant="outline" size="sm" onClick={openEditModal}>
                <Edit2 className="w-3.5 h-3.5" /> Edit Profile
              </Button>
            </>
          )}
          {canDelete && (
            <Button variant="danger" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          )}
        </div>
      </div>

      {success && <Alert type="success">{success}</Alert>}
      {error && <Alert type="error">{error}</Alert>}

      {/* Main Profile Card */}
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-start gap-5">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-2xl font-bold text-blue-600">
              {d.user?.avatar ? <img src={d.user.avatar} className="w-20 h-20 rounded-full object-cover" /> : "Dr"}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-800">
                  Dr. {d.user?.firstName} {d.user?.lastName}
                </h1>
                <Badge variant={d.isAvailable ? "success" : "default"}>
                  {d.isAvailable ? "Available" : "Unavailable"}
                </Badge>
                {d.user?.status !== "active" && <Badge variant="danger">{d.user?.status}</Badge>}
              </div>
              <p className="text-slate-600 font-medium">{d.specialization}</p>
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> {d.user?.email}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> {d.user?.phone}
                </span>
              </div>
            </div>
            <div className="text-xs text-slate-400 shrink-0">ID: {d.doctorId}</div>
          </div>

          <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Award className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Qualifications</p>
                  <p className="text-sm text-slate-700">{d.qualifications?.join(", ") || "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Experience</p>
                  <p className="text-sm text-slate-700">{d.experience} years</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Building className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Department</p>
                  <p className="text-sm text-slate-700">{d.department?.name || "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <DollarSign className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Consultation Fee</p>
                  <p className="text-sm text-slate-700">PKR {d.consultationFee?.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Slot Duration</p>
                  <p className="text-sm text-slate-700 font-semibold text-teal-700">
                    {d.appointmentDuration || 30} minutes
                  </p>
                </div>
              </div>
              {d.languages?.length > 0 && (
                <div className="flex items-start gap-3">
                  <Stethoscope className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-semibold">Languages</p>
                    <div className="flex flex-wrap gap-1">
                      {d.languages.map((lang, i) => (
                        <Badge key={i} variant="outline">
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {d.bio && (
            <div className="border-t pt-4">
              <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Bio</p>
              <p className="text-sm text-slate-700">{d.bio}</p>
            </div>
          )}

          <div className="border-t pt-4 flex justify-between text-xs text-slate-400">
            <span>Created: {formatDate(d.createdAt)}</span>
            <span>Updated: {formatDate(d.updatedAt)}</span>
          </div>
        </CardBody>
      </Card>

      {/* Weekly Working Schedule Card */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              <h2 className="text-sm font-bold text-slate-800">Weekly Working Schedule</h2>
            </div>
            {canUpdate && (
              <Button variant="outline" size="sm" onClick={openScheduleModal}>
                <Edit2 className="w-3.5 h-3.5" /> Configure Schedule
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            {WEEKDAYS.map((day) => {
              const clinicDay = clinicWorkingDays.find((wd) => wd.day.toLowerCase() === day);
              const isClinicOpen = clinicDay ? clinicDay.isOpen !== false : false;
              const sched: DaySchedule | undefined = currentSchedule[day];
              const isWorking = isClinicOpen && (sched?.isWorking ?? false);

              return (
                <div
                  key={day}
                  className={`p-3 rounded-lg border text-xs space-y-1 ${!isClinicOpen
                      ? "bg-red-50/40 border-red-200 opacity-75"
                      : isWorking
                        ? "bg-teal-50/50 border-teal-200"
                        : "bg-gray-50 border-gray-200 opacity-65"
                    }`}
                >
                  <div className="flex items-center justify-between font-semibold capitalize text-slate-800">
                    <span>{day}</span>
                    {!isClinicOpen ? (
                      <span className="inline-flex items-center text-[10px] text-red-800 bg-red-100 px-1.5 py-0.5 rounded font-bold">
                        Clinic Closed
                      </span>
                    ) : isWorking ? (
                      <span className="inline-flex items-center text-[10px] text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded font-semibold">
                        <CheckCircle className="w-3 h-3 mr-0.5" /> Working
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded font-semibold">
                        <XCircle className="w-3 h-3 mr-0.5" /> Off
                      </span>
                    )}
                  </div>

                  {!isClinicOpen ? (
                    <div className="text-red-600 italic text-[11px]">Clinic is closed on this day</div>
                  ) : isWorking ? (
                    <>
                      <div className="text-slate-600 font-medium">
                        Hours: {formatTime(sched?.startTime || "09:00")} – {formatTime(sched?.endTime || "17:00")}
                      </div>
                      {sched?.breakStart && sched?.breakEnd ? (
                        <div className="text-amber-700 flex items-center gap-1 text-[11px]">
                          <Coffee className="w-3 h-3" /> Break: {formatTime(sched.breakStart)} – {formatTime(sched.breakEnd)}
                        </div>
                      ) : (
                        <div className="text-slate-400 text-[11px]">No break scheduled</div>
                      )}
                    </>
                  ) : (
                    <div className="text-gray-400 italic text-[11px]">Day Off</div>
                  )}
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Doctor Leave Management Card */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-800">Doctor Leave & Holidays</h2>
            </div>
            {canUpdate && (
              <Button variant="outline" size="sm" onClick={() => { setLeaveConflictData(null); setLeaveOpen(true); }}>
                <Plus className="w-3.5 h-3.5" /> Add Doctor Leave
              </Button>
            )}
          </div>

          {doctorLeaves.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No upcoming leave scheduled for Dr. {d.user?.lastName}.</p>
          ) : (
            <div className="divide-y divide-gray-100 border rounded-lg bg-white overflow-hidden">
              {doctorLeaves.map((l) => (
                <div key={l._id?.toString()} className="p-3 flex items-center justify-between text-xs gap-3">
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-800 flex items-center gap-2">
                      <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {formatDate(l.startDate)}
                        {formatDate(l.startDate) !== formatDate(l.endDate) && ` – ${formatDate(l.endDate)}`}
                      </span>
                      {l.reason && <span className="text-slate-600 font-normal">Reason: {l.reason}</span>}
                    </div>
                    {l.notes && <p className="text-slate-500 italic">Notes: {l.notes}</p>}
                  </div>
                  {canUpdate && l._id && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => deleteLeaveMutation.mutate(l._id!.toString())}
                      loading={deleteLeaveMutation.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Edit Profile Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Doctor Profile" size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Specialization" required error={errors.specialization?.message}>
              <Input {...register("specialization", { required: "Specialization is required" })} placeholder="e.g. Cardiologist" />
            </FormField>
            <FormField label="Department">
              <Select {...register("department")}>
                <option value="">Select department</option>
                {departments.map((dep: { _id: string; name: string }) => (
                  <option key={dep._id} value={dep._id}>
                    {dep.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Experience (years)">
              <Input type="number" {...register("experience", { valueAsNumber: true })} placeholder="0" />
            </FormField>
            <FormField label="Consultation Fee (PKR)">
              <Input type="number" {...register("consultationFee", { valueAsNumber: true })} placeholder="0" />
            </FormField>
            <FormField label="Default Slot Duration">
              <Select {...register("appointmentDuration", { valueAsNumber: true })}>
                <option value={5}>5 mins</option>
                <option value={10}>10 mins</option>
                <option value={15}>15 mins</option>
                <option value={20}>20 mins</option>
                <option value={30}>30 mins (Default)</option>
                <option value={45}>45 mins</option>
                <option value={60}>60 mins (1 Hour)</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Qualifications" hint="Comma separated e.g. MBBS, FCPS">
            <Input {...register("qualifications")} placeholder="MBBS, FCPS, MD" />
          </FormField>
          <FormField label="Languages" hint="Comma separated e.g. English, Urdu">
            <Input {...register("languages")} placeholder="English, Urdu, Punjabi" />
          </FormField>
          <FormField label="Bio">
            <textarea
              {...register("bio")}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </FormField>
          <FormField label="Availability" error={errors.isAvailable?.message}>
            <Select {...register("isAvailable", { valueAsNumber: false })}>
              <option value="true">Available</option>
              <option value="false">Unavailable</option>
            </Select>
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={updateMutation.isPending}>
              Save Profile Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Configure Weekly Schedule Modal */}
      <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Configure Weekly Working Schedule" size="xl">
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Configure working hours and break times for each weekday. Doctor working hours must fall strictly inside clinic operating hours.
          </p>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {WEEKDAYS.map((day) => {
              const clinicDay = clinicWorkingDays.find((wd) => wd.day.toLowerCase() === day);
              const isClinicOpen = clinicDay ? clinicDay.isOpen !== false : false;
              const daySched = scheduleState[day] || { isWorking: false, startTime: "09:00", endTime: "17:00", breakStart: "", breakEnd: "" };

              if (!isClinicOpen) {
                return (
                  <div key={day} className="p-3 border rounded-lg bg-red-50/40 border-red-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs capitalize text-slate-700 flex items-center gap-2">
                        <input type="checkbox" disabled checked={false} className="w-4 h-4 text-gray-400 rounded cursor-not-allowed" />
                        <span>{day}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-red-100 text-red-800">
                        Clinic Closed
                      </span>
                    </div>
                    <p className="text-[11px] text-red-700 italic">
                      Clinic is closed on {day.toUpperCase()} (configured in Clinic Settings). Doctor hours cannot be added for this day.
                    </p>
                  </div>
                );
              }

              return (
                <div key={day} className="p-3 border rounded-lg bg-gray-50 space-y-2">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-2 font-bold text-xs capitalize text-slate-800">
                      <input
                        type="checkbox"
                        checked={daySched.isWorking}
                        onChange={(e) =>
                          setScheduleState((prev) => ({
                            ...prev,
                            [day]: { ...daySched, isWorking: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 text-teal-600 rounded cursor-pointer"
                      />
                      <span>{day}</span>
                      {clinicDay && (
                        <span className="text-[11px] text-gray-500 font-normal">
                          (Clinic Hours: {minutesToDisplayTime(timeToMinutes(clinicDay.openingTime))} – {minutesToDisplayTime(timeToMinutes(clinicDay.closingTime))})
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${daySched.isWorking ? "bg-teal-100 text-teal-800" : "bg-gray-200 text-gray-600"}`}>
                      {daySched.isWorking ? "Working Day" : "Off"}
                    </span>
                  </div>

                  {daySched.isWorking && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                      <div>
                        <label className="block text-[11px] text-gray-600 mb-1 font-medium">Doctor Start Time</label>
                        <Input
                          type="time"
                          value={daySched.startTime || "09:00"}
                          onChange={(e) =>
                            setScheduleState((prev) => ({
                              ...prev,
                              [day]: { ...daySched, startTime: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-600 mb-1 font-medium">Doctor End Time</label>
                        <Input
                          type="time"
                          value={daySched.endTime || "17:00"}
                          onChange={(e) =>
                            setScheduleState((prev) => ({
                              ...prev,
                              [day]: { ...daySched, endTime: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-amber-800 mb-1 font-medium">Break Start</label>
                        <Input
                          type="time"
                          value={daySched.breakStart || ""}
                          onChange={(e) =>
                            setScheduleState((prev) => ({
                              ...prev,
                              [day]: { ...daySched, breakStart: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-amber-800 mb-1 font-medium">Break End</label>
                        <Input
                          type="time"
                          value={daySched.breakEnd || ""}
                          onChange={(e) =>
                            setScheduleState((prev) => ({
                              ...prev,
                              [day]: { ...daySched, breakEnd: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="secondary" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button loading={updateMutation.isPending} onClick={onSaveSchedule}>
              Save Weekly Schedule
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Doctor Leave Modal */}
      <Modal open={leaveOpen} onClose={() => { setLeaveOpen(false); setLeaveConflictData(null); }} title="Add Doctor Leave" size="md">
        <form onSubmit={onAddLeaveSubmit} className="space-y-4">
          {leaveConflictData && leaveConflictData.conflictCount > 0 && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Scheduling Conflicts Detected ({leaveConflictData.conflictCount})</span>
              </div>
              <p className="text-amber-800">
                The leave has been registered, but the following existing appointment(s) conflict with this leave period. Please contact or reschedule these patients:
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1 divide-y divide-amber-200/60 pt-1">
                {leaveConflictData.appointments.map((appt) => (
                  <div key={appt.id} className="pt-1 flex items-center justify-between text-[11px] text-amber-900">
                    <span>
                      <strong>{appt.appointmentId}</strong> — {appt.patientName}
                    </span>
                    <span>
                      {formatDate(appt.date)} @ {formatTime(appt.time)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <FormField label="Leave Date" required>
            <Input type="date" value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} required />
          </FormField>

          <FormField label="Reason (Optional)">
            <Input value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder="e.g. Medical leave, Conference, Vacation" />
          </FormField>

          <FormField label="Internal Staff Notes (Optional)">
            <textarea
              value={leaveNotes}
              onChange={(e) => setLeaveNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Notes for receptionist and administrative staff..."
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => { setLeaveOpen(false); setLeaveConflictData(null); }}>
              {leaveConflictData ? "Close" : "Cancel"}
            </Button>
            {!leaveConflictData && (
              <Button type="submit" loading={addLeaveMutation.isPending}>
                Save Doctor Leave
              </Button>
            )}
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Delete Doctor" size="sm">
        <div className="space-y-4 mt-2">
          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
            <Trash2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-800">Delete permanently?</p>
              <p className="text-xs text-red-600 mt-0.5">
                This will permanently delete <strong>Dr. {d.user?.firstName} {d.user?.lastName}</strong> ({d.doctorId}).
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              Delete Permanently
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}