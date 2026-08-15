"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import axios from "axios";
import {
  Card, CardBody, Button, FormField, Input, Select, Alert, Badge, Modal,
} from "@/components/ui";
import {
  Plus, Trash2, Upload, Building2, Clock, CalendarOff, Settings, Edit2
} from "lucide-react";
import { useSession } from "next-auth/react";
import { cn, formatTime12Hour, timeToMinutes } from "@/lib/utils";
import { toast } from "sonner";
import { useClinicSettings, WorkingDay, ClosingDay } from "@/components/providers/clinic-provider";
import { TimezonePicker } from "@/components/settings/timezone-picker";
import { formatClinicDate, formatClinicTime, formatClinicDateTime } from "@/lib/time-utils";

const TABS = [
  { id: "clinic", label: "Clinic Information", icon: Building2 },
  { id: "workingDays", label: "Working Days & Hours", icon: Clock },
  { id: "closingDays", label: "Closing Days / Holidays", icon: CalendarOff },
  { id: "departments", label: "Departments", icon: Settings },
];

const DAYS_OF_WEEK = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
];

const TIME_OPTIONS_12H = [
  "06:00 AM", "06:30 AM", "07:00 AM", "07:30 AM", "08:00 AM", "08:30 AM",
  "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
  "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM",
  "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM", "08:00 PM", "08:30 PM",
  "09:00 PM", "09:30 PM", "10:00 PM", "10:30 PM", "11:00 PM", "11:30 PM",
];

export function SettingsClient() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const { refetchSettings } = useClinicSettings();
  const [tab, setTab] = useState("clinic");
  const [saveError, setSaveError] = useState("");

  // Logo uploading states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDeletingLogo, setIsDeletingLogo] = useState(false);

  // Departments state
  const [newDept, setNewDept] = useState({ name: "", code: "", description: "" });
  const [editDept, setEditDept] = useState<{ id: string; name: string; code: string; description: string } | null>(null);
  const [deptError, setDeptError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; label: string }>({ open: false, id: "", label: "" });

  // Working Days state
  const [isAddDayOpen, setIsAddDayOpen] = useState(false);
  const [dayError, setDayError] = useState("");
  const [newDay, setNewDay] = useState<WorkingDay>({
    day: "Monday",
    openingTime: "08:00 AM",
    breakStart: "",
    breakEnd: "",
    closingTime: "05:00 PM",
    isOpen: true,
  });

  // Closing Days state
  const [isAddClosingOpen, setIsAddClosingOpen] = useState(false);
  const [closingError, setClosingError] = useState("");
  const [newClosing, setNewClosing] = useState<ClosingDay>({
    date: "",
    reason: "",
  });

  const isSA = session?.user.isSuperAdmin;
  const perms = session?.user.permissions || [];
  const canEdit = isSA || perms.includes("settings:update");

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => axios.get("/api/settings").then(r => r.data),
  });

  const { data: deptsData } = useQuery({
    queryKey: ["departments"],
    queryFn: () => axios.get("/api/settings/departments").then(r => r.data),
  });

  const settings = settingsData?.data;
  const departments: { _id: string; name: string; code: string; description?: string; isActive: boolean }[] = deptsData?.data || [];

  const { register, handleSubmit, reset, control, setValue, watch } = useForm<{
    clinicName: string;
    clinicTagline: string;
    clinicAddress: string;
    phone: string;
    email: string;
    logo: string;
    logoPublicId: string;
    clinicType: string;
    timezone: string;
    dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY/MM/DD";
    timeFormat: "12-hour" | "24-hour";
  }>();

  useEffect(() => {
    if (settings) {
      reset({
        clinicName: settings.clinicName || "ClinicHMS",
        clinicTagline: settings.clinicTagline || "Hospital Management System",
        clinicAddress: settings.clinicAddress || "123 Healthcare Avenue, Medical District",
        phone: settings.phone || "+92 300 1234567",
        email: settings.email || "info@clinichms.com",
        logo: settings.logo || "/logo.png",
        logoPublicId: settings.logoPublicId || "",
        clinicType: settings.clinicType || "clinic",
        timezone: settings.timezone || "Asia/Karachi",
        dateFormat: settings.dateFormat || "DD/MM/YYYY",
        timeFormat: settings.timeFormat || "12-hour",
      });
    }
  }, [settings, reset]);

  const currentLogo = useWatch({ control, name: "logo" }) || "/logo.png";
  const currentLogoPublicId = useWatch({ control, name: "logoPublicId" });

  const saveMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => axios.put("/api/settings", d),
    onSuccess: (_, variables) => {
      if (typeof window !== "undefined") {
        (window as any).__CLINIC_SETTINGS__ = {
          ...((window as any).__CLINIC_SETTINGS__ || {}),
          ...variables,
        };
        try {
          localStorage.setItem("clinic_hms_settings", JSON.stringify((window as any).__CLINIC_SETTINGS__));
        } catch {}
      }
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["public-settings"] });
      refetchSettings();
      setSaveError("");
      toast.success("Settings saved!");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Save failed";
      setSaveError(msg);
      toast.error(msg);
    },
  });

  // Department mutations
  const addDeptMutation = useMutation({
    mutationFn: (d: typeof newDept) => axios.post("/api/settings/departments", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setNewDept({ name: "", code: "", description: "" });
      setDeptError("");
      toast.success("Department added!");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed";
      setDeptError(msg);
      toast.error(msg);
    },
  });

  const updateDeptMutation = useMutation({
    mutationFn: (d: { id: string; name: string; code: string; description?: string }) =>
      axios.put(`/api/settings/departments/${d.id}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setEditDept(null);
      toast.success("Department updated!");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to update department";
      toast.error(msg);
    },
  });

  const deleteDeptMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/settings/departments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setDeleteConfirm({ open: false, id: "", label: "" });
      toast.success("Department deleted!");
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to delete"),
  });

  // Upload logo to Cloudinary
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setIsUploadingLogo(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post("/api/settings/upload-logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const newLogoUrl = res.data?.data?.logo;
      const newLogoPublicId = res.data?.data?.logoPublicId;

      setValue("logo", newLogoUrl);
      setValue("logoPublicId", newLogoPublicId);
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["public-settings"] });
      refetchSettings();
      toast.success("Clinic logo updated!");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Logo upload failed";
      toast.error(msg);
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Remove custom logo from Cloudinary & reset to /logo.png
  const handleLogoDelete = async () => {
    setIsDeletingLogo(true);
    try {
      const res = await axios.delete("/api/settings/upload-logo");
      setValue("logo", "/logo.png");
      setValue("logoPublicId", "");
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["public-settings"] });
      refetchSettings();
      toast.success(res.data?.message || "Custom logo removed. Default logo restored.");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to remove logo";
      toast.error(msg);
    } finally {
      setIsDeletingLogo(false);
    }
  };

  // Working Days logic & validation
  const workingDays: WorkingDay[] = settings?.workingDays || [
    { day: "Monday", openingTime: "08:00 AM", breakStart: "01:00 PM", breakEnd: "02:00 PM", closingTime: "05:00 PM", isOpen: true },
    { day: "Tuesday", openingTime: "08:00 AM", breakStart: "01:00 PM", breakEnd: "02:00 PM", closingTime: "05:00 PM", isOpen: true },
    { day: "Wednesday", openingTime: "08:00 AM", breakStart: "01:00 PM", breakEnd: "02:00 PM", closingTime: "05:00 PM", isOpen: true },
    { day: "Thursday", openingTime: "08:00 AM", breakStart: "01:00 PM", breakEnd: "02:00 PM", closingTime: "05:00 PM", isOpen: true },
    { day: "Friday", openingTime: "08:00 AM", breakStart: "01:00 PM", breakEnd: "02:00 PM", closingTime: "05:00 PM", isOpen: true },
  ];

  const handleAddWorkingDay = () => {
    setDayError("");
    const { day, openingTime, breakStart, breakEnd, closingTime } = newDay;

    if (!day || !openingTime || !closingTime) {
      setDayError("Day, Opening Time, and Closing Time are required.");
      return;
    }

    const openMin = timeToMinutes(openingTime);
    const closeMin = timeToMinutes(closingTime);

    if (openMin === -1 || closeMin === -1) {
      setDayError("Please select valid opening and closing times.");
      return;
    }

    if (closeMin <= openMin) {
      setDayError("Closing time must be later than opening time.");
      return;
    }

    if ((breakStart && !breakEnd) || (!breakStart && breakEnd)) {
      setDayError("Both Break Start and Break End must be specified if a break is added.");
      return;
    }

    if (breakStart && breakEnd) {
      const breakStartMin = timeToMinutes(breakStart);
      const breakEndMin = timeToMinutes(breakEnd);

      if (breakStartMin === -1 || breakEndMin === -1) {
        setDayError("Please select valid break times.");
        return;
      }

      if (breakStartMin < openMin || breakStartMin >= closeMin) {
        setDayError("Break Start must fall between opening and closing times.");
        return;
      }
      if (breakEndMin <= breakStartMin || breakEndMin > closeMin) {
        setDayError("Break End must be after Break Start and before or at Closing Time.");
        return;
      }
    }

    const dayToSave: WorkingDay = {
      ...newDay,
      openingTime: formatTime12Hour(openingTime),
      closingTime: formatTime12Hour(closingTime),
      breakStart: breakStart ? formatTime12Hour(breakStart) : "",
      breakEnd: breakEnd ? formatTime12Hour(breakEnd) : "",
    };

    // Check if day already exists
    const filteredDays = workingDays.filter(d => d.day !== day);
    const updatedDays = [...filteredDays, dayToSave].sort(
      (a, b) => DAYS_OF_WEEK.indexOf(a.day) - DAYS_OF_WEEK.indexOf(b.day)
    );

    saveMutation.mutate(
      { workingDays: updatedDays },
      {
        onSuccess: () => {
          setIsAddDayOpen(false);
          setNewDay({
            day: "Monday",
            openingTime: "08:00 AM",
            breakStart: "",
            breakEnd: "",
            closingTime: "05:00 PM",
            isOpen: true,
          });
        },
      }
    );
  };

  const handleRemoveWorkingDay = (dayName: string) => {
    const updatedDays = workingDays.filter(d => d.day !== dayName);
    saveMutation.mutate({ workingDays: updatedDays });
  };

  // Closing Days / Holidays logic
  const closingDays: ClosingDay[] = settings?.closingDays || [];

  const handleAddClosingDay = () => {
    setClosingError("");
    if (!newClosing.date || !newClosing.reason.trim()) {
      setClosingError("Date and Reason are required.");
      return;
    }

    const updatedClosing = [...closingDays, { date: newClosing.date, reason: newClosing.reason.trim() }].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    saveMutation.mutate(
      { closingDays: updatedClosing },
      {
        onSuccess: () => {
          setIsAddClosingOpen(false);
          setNewClosing({ date: "", reason: "" });
        },
      }
    );
  };

  const handleRemoveClosingDay = (index: number) => {
    const updatedClosing = closingDays.filter((_, i) => i !== index);
    saveMutation.mutate({ closingDays: updatedClosing });
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto px-1 sm:px-0">
      {/* Page Header */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
        <p className="text-xs text-gray-500 mt-0.5">Manage clinic details, working hours, closing holidays, and departments</p>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-2 sm:flex sm:flex-row gap-1 border-b border-gray-200 pb-0">
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center justify-center sm:justify-start gap-2 px-3 py-2 text-xs font-medium border-b-2 cursor-pointer transition-colors whitespace-nowrap text-center sm:text-left",
                isActive
                  ? "border-teal-600 text-teal-700 font-semibold bg-teal-50/60 rounded-t-md"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <Icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-teal-600" : "text-gray-400")} />
              <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: CLINIC INFORMATION */}
      {tab === "clinic" && (
        <Card>
          <CardBody className="p-4 sm:p-5 space-y-5">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100">
              <div>
                <h3 className="text-xs font-semibold text-gray-900">Clinic Details</h3>
                <p className="text-xs text-gray-500 mt-0.5">Primary clinic details displayed across application</p>
              </div>
              <Badge variant={currentLogoPublicId ? "success" : "default"}>
                {currentLogoPublicId ? "Active" : "Default"}
              </Badge>
            </div>

            {isLoading ? (
              <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
            ) : (
              <form onSubmit={handleSubmit(d => saveMutation.mutate(d as Record<string, unknown>))} className="space-y-4">
                {saveError && <Alert type="error">{saveError}</Alert>}

                {/* Logo Section */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/80 flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-lg border border-gray-200 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentLogo}
                      alt="Clinic Logo"
                      className="w-full h-full object-contain p-1"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/logo.png";
                      }}
                    />
                  </div>

                  <div className="space-y-1 text-center sm:text-left flex-1 w-full">
                    <span className="text-xs font-semibold text-gray-900 block">Clinic Logo</span>
                    <p className="text-xs text-gray-500">
                      Upload custom logo. Format: PNG, JPG, WEBP (Max 5MB).
                    </p>

                    {canEdit && (
                      <div className="flex flex-wrap gap-2 pt-2 justify-center sm:justify-start">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleLogoUpload}
                          accept="image/*"
                          className="hidden"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => fileInputRef.current?.click()}
                          loading={isUploadingLogo}
                        >
                          <Upload className="w-3.5 h-3.5 mr-1" />
                          {currentLogoPublicId ? "Change Logo" : "Upload Logo"}
                        </Button>

                        {currentLogoPublicId && (
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={handleLogoDelete}
                            loading={isDeletingLogo}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Remove Custom Logo
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Form inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Clinic Name" required>
                    <Input {...register("clinicName", { required: true })} disabled={!canEdit} placeholder="e.g. ClinicHMS" />
                  </FormField>

                  <FormField label="Clinic Tagline">
                    <Input {...register("clinicTagline")} disabled={!canEdit} placeholder="e.g. Hospital Management System" />
                  </FormField>
                </div>

                <FormField label="Clinic Address">
                  <Input {...register("clinicAddress")} disabled={!canEdit} placeholder="e.g. 123 Healthcare Avenue, Medical District" />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Clinic Phone Number" required>
                    <Input {...register("phone", { required: true })} disabled={!canEdit} placeholder="+92 300 1234567" />
                  </FormField>

                  <FormField label="Clinic Email Address" required>
                    <Input type="email" {...register("email", { required: true })} disabled={!canEdit} placeholder="info@clinichms.com" />
                  </FormField>
                </div>

                <div className="pt-4 border-t border-gray-200 space-y-4">
                  <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-teal-600" /> Regional & Date/Time Preferences
                  </h3>

                  <FormField label="Clinic Timezone" hint="Authoritative timezone used for business calendar, queue boundaries, and reports">
                    <TimezonePicker
                      value={watch("timezone")}
                      onChange={(val) => setValue("timezone", val, { shouldDirty: true, shouldValidate: true })}
                      disabled={!canEdit}
                    />
                  </FormField>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Date Format" hint="Default display format for all dates across staff and patient portals">
                      <Select {...register("dateFormat")} disabled={!canEdit}>
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="YYYY/MM/DD">YYYY/MM/DD</option>
                      </Select>
                    </FormField>

                    <FormField label="Time Format" hint="Default display format for operating hours, timestamps, and slots">
                      <Select {...register("timeFormat")} disabled={!canEdit}>
                        <option value="12-hour">12-hour</option>
                        <option value="24-hour">24-hour</option>
                      </Select>
                    </FormField>
                  </div>

                  {/* Live Regional Formatting Preview Card */}
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 space-y-1.5 text-xs">
                    <span className="font-semibold text-teal-800 block">Live Format Preview</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-teal-900">
                      <div>
                        <span className="text-teal-600 block text-[11px]">Date</span>
                        <span className="font-mono font-medium">
                          {formatClinicDate(new Date(), watch("dateFormat") || "DD/MM/YYYY", watch("timezone"))}
                        </span>
                      </div>
                      <div>
                        <span className="text-teal-600 block text-[11px]">Time</span>
                        <span className="font-mono font-medium">
                          {formatClinicTime(new Date(), watch("timeFormat") || "12-hour", watch("timezone"))}
                        </span>
                      </div>
                      <div>
                        <span className="text-teal-600 block text-[11px]">Date & Time</span>
                        <span className="font-mono font-medium">
                          {formatClinicDateTime(new Date(), watch("dateFormat") || "DD/MM/YYYY", watch("timeFormat") || "12-hour", watch("timezone"))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {canEdit && (
                  <div className="flex justify-end pt-3 border-t border-gray-200">
                    <Button type="submit" loading={saveMutation.isPending} className="w-full sm:w-auto">
                      Save Settings
                    </Button>
                  </div>
                )}
              </form>
            )}
          </CardBody>
        </Card>
      )}

      {/* TAB 2: WORKING DAYS & WORKING HOURS */}
      {tab === "workingDays" && (
        <Card>
          <CardBody className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-gray-100">
              <div>
                <h3 className="text-xs font-semibold text-gray-900">Weekly Schedule ({workingDays.length})</h3>
                <p className="text-xs text-gray-500 mt-0.5">Operational opening hours and break times</p>
              </div>

              {canEdit && (
                <Button size="sm" onClick={() => setIsAddDayOpen(true)} className="w-full sm:w-auto">
                  <Plus className="w-3.5 h-3.5" /> Add Working Day
                </Button>
              )}
            </div>

            {workingDays.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-xs font-medium text-gray-600">No Working Days Defined</p>
                <p className="text-xs text-gray-400 mt-0.5">Click &quot;Add Working Day&quot; to set weekly opening hours.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-gray-200">
                    <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Day</th>
                        <th className="px-4 py-2.5 font-semibold">Opening Time</th>
                        <th className="px-4 py-2.5 font-semibold">Break Start</th>
                        <th className="px-4 py-2.5 font-semibold">Break End</th>
                        <th className="px-4 py-2.5 font-semibold">Closing Time</th>
                        {canEdit && <th className="px-4 py-2.5 font-semibold text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {workingDays.map((d) => (
                        <tr key={d.day} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-4 py-3 font-semibold text-gray-900">{d.day}</td>
                          <td className="px-4 py-3 text-teal-700 font-medium">{formatClinicTime(d.openingTime, watch("timeFormat") || "12-hour", watch("timezone"))}</td>
                          <td className="px-4 py-3 text-gray-600">{d.breakStart ? formatClinicTime(d.breakStart, watch("timeFormat") || "12-hour", watch("timezone")) : "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{d.breakEnd ? formatClinicTime(d.breakEnd, watch("timeFormat") || "12-hour", watch("timezone")) : "—"}</td>
                          <td className="px-4 py-3 text-teal-700 font-medium">{formatClinicTime(d.closingTime, watch("timeFormat") || "12-hour", watch("timezone"))}</td>
                          {canEdit && (
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleRemoveWorkingDay(d.day)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="sm:hidden space-y-3">
                  {workingDays.map((d) => (
                    <div key={d.day} className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-gray-900">{d.day}</div>
                        <div className="text-xs text-gray-600 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-teal-700 font-medium">{formatClinicTime(d.openingTime, watch("timeFormat") || "12-hour", watch("timezone"))} - {formatClinicTime(d.closingTime, watch("timeFormat") || "12-hour", watch("timezone"))}</span>
                          {d.breakStart && d.breakEnd && (
                            <span className="text-gray-400 text-[11px]">
                              (Break: {formatClinicTime(d.breakStart, watch("timeFormat") || "12-hour", watch("timezone"))} - {formatClinicTime(d.breakEnd, watch("timeFormat") || "12-hour", watch("timezone"))})
                            </span>
                          )}
                        </div>
                      </div>

                      {canEdit && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleRemoveWorkingDay(d.day)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Add Working Day Modal */}
            <Modal open={isAddDayOpen} onClose={() => setIsAddDayOpen(false)} title="Add Working Day" size="md">
              <div className="space-y-4 mt-2">
                {dayError && <Alert type="error">{dayError}</Alert>}

                <FormField label="Day of Week" required>
                  <Select
                    value={newDay.day}
                    onChange={(e) => setNewDay((p) => ({ ...p, day: e.target.value }))}
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Opening Time (12-Hour)" required>
                    <Select
                      value={formatTime12Hour(newDay.openingTime)}
                      onChange={(e) => setNewDay((p) => ({ ...p, openingTime: e.target.value }))}
                    >
                      {TIME_OPTIONS_12H.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField label="Closing Time (12-Hour)" required>
                    <Select
                      value={formatTime12Hour(newDay.closingTime)}
                      onChange={(e) => setNewDay((p) => ({ ...p, closingTime: e.target.value }))}
                    >
                      {TIME_OPTIONS_12H.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                  <span className="text-xs font-semibold text-gray-700 block">Break Hours (Optional - 12-Hour)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Break Start">
                      <Select
                        value={newDay.breakStart ? formatTime12Hour(newDay.breakStart) : ""}
                        onChange={(e) => setNewDay((p) => ({ ...p, breakStart: e.target.value }))}
                      >
                        <option value="">No Break Start</option>
                        {TIME_OPTIONS_12H.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </FormField>

                    <FormField label="Break End">
                      <Select
                        value={newDay.breakEnd ? formatTime12Hour(newDay.breakEnd) : ""}
                        onChange={(e) => setNewDay((p) => ({ ...p, breakEnd: e.target.value }))}
                      >
                        <option value="">No Break End</option>
                        {TIME_OPTIONS_12H.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                  <Button variant="secondary" onClick={() => setIsAddDayOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddWorkingDay} loading={saveMutation.isPending}>
                    Save Schedule
                  </Button>
                </div>
              </div>
            </Modal>
          </CardBody>
        </Card>
      )}

      {/* TAB 3: CLOSING DAYS / HOLIDAYS */}
      {tab === "closingDays" && (
        <Card>
          <CardBody className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-gray-100">
              <div>
                <h3 className="text-xs font-semibold text-gray-900">Closing Days & Holidays ({closingDays.length})</h3>
                <p className="text-xs text-gray-500 mt-0.5">Clinic holiday dates when clinic is closed</p>
              </div>

              {canEdit && (
                <Button size="sm" onClick={() => setIsAddClosingOpen(true)} className="w-full sm:w-auto">
                  <Plus className="w-3.5 h-3.5" /> Add Closing Day
                </Button>
              )}
            </div>

            {closingDays.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-xs font-medium text-gray-600">No Closing Days Registered</p>
                <p className="text-xs text-gray-400 mt-0.5">Add holidays like Independence Day or Eid.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-gray-200">
                    <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Date</th>
                        <th className="px-4 py-2.5 font-semibold">Reason</th>
                        {canEdit && <th className="px-4 py-2.5 font-semibold text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {closingDays.map((c, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-4 py-3 font-semibold text-teal-800">{c.date}</td>
                          <td className="px-4 py-3 text-gray-800 font-medium">{c.reason}</td>
                          {canEdit && (
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleRemoveClosingDay(idx)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="sm:hidden space-y-3">
                  {closingDays.map((c, idx) => (
                    <div key={idx} className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 flex items-center justify-between gap-3">
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs font-semibold text-teal-800">{c.date}</div>
                        <div className="text-xs text-gray-800 font-medium truncate">{c.reason}</div>
                      </div>

                      {canEdit && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleRemoveClosingDay(idx)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Add Closing Day Modal */}
            <Modal open={isAddClosingOpen} onClose={() => setIsAddClosingOpen(false)} title="Add Closing Day / Holiday" size="sm">
              <div className="space-y-4 mt-2">
                {closingError && <Alert type="error">{closingError}</Alert>}

                <FormField label="Date" required>
                  <Input
                    type="date"
                    value={newClosing.date}
                    onChange={(e) => setNewClosing((p) => ({ ...p, date: e.target.value }))}
                  />
                </FormField>

                <FormField label="Reason / Holiday" required>
                  <Input
                    placeholder="e.g. Independence Day"
                    value={newClosing.reason}
                    onChange={(e) => setNewClosing((p) => ({ ...p, reason: e.target.value }))}
                  />
                </FormField>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                  <Button variant="secondary" onClick={() => setIsAddClosingOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddClosingDay} loading={saveMutation.isPending}>
                    Add Holiday
                  </Button>
                </div>
              </div>
            </Modal>
          </CardBody>
        </Card>
      )}

      {/* TAB 4: DEPARTMENTS */}
      {tab === "departments" && (
        <div className="space-y-4">
          <Card>
            <CardBody className="p-4 sm:p-5 space-y-3">
              <h3 className="text-xs font-semibold text-gray-900">Departments ({departments.length})</h3>
              {departments.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">No departments defined.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {departments.map((d) => (
                    <div key={d._id} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 sm:py-2.5 gap-2">
                      <div className="min-w-0 flex-1 space-y-1 sm:space-y-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold sm:font-medium text-gray-900">{d.name}</span>
                          <Badge variant="outline">{d.code}</Badge>
                          <Badge variant={d.isActive ? "success" : "default"}>{d.isActive ? "Active" : "Inactive"}</Badge>
                        </div>
                        {d.description && <p className="text-xs text-gray-500 sm:text-gray-400 sm:mt-0.5">{d.description}</p>}
                      </div>
                      {canEdit && d.isActive && (
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditDept({ id: d._id, name: d.name, code: d.code, description: d.description || "" })}
                          >
                            <Edit2 className="w-3.5 h-3.5 text-gray-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setDeleteConfirm({ open: true, id: d._id, label: `${d.name} (${d.code})` })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {canEdit && (
            <Card>
              <CardBody className="p-4 sm:p-5 space-y-3">
                <h3 className="text-xs font-semibold text-gray-900">Add Department</h3>
                {deptError && <Alert type="error">{deptError}</Alert>}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-4">
                    <FormField label="Name">
                      <Input value={newDept.name} onChange={(e) => setNewDept((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Cardiology" />
                    </FormField>
                  </div>
                  <div className="sm:col-span-2">
                    <FormField label="Code">
                      <Input value={newDept.code} onChange={(e) => setNewDept((p) => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="CARD" />
                    </FormField>
                  </div>
                  <div className="sm:col-span-4">
                    <FormField label="Description">
                      <Input value={newDept.description} onChange={(e) => setNewDept((p) => ({ ...p, description: e.target.value }))} placeholder="Optional" />
                    </FormField>
                  </div>
                  <div className="sm:col-span-2">
                    <Button onClick={() => addDeptMutation.mutate(newDept)} loading={addDeptMutation.isPending} disabled={!newDept.name || !newDept.code} className="w-full">
                      <Plus className="w-3.5 h-3.5" /> Add
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* Edit Department Modal */}
      <Modal open={!!editDept} onClose={() => setEditDept(null)} title="Edit Department" size="md">
        {editDept && (
          <div className="space-y-4 text-xs mt-2">
            <FormField label="Department Name">
              <Input
                value={editDept.name}
                onChange={(e) => setEditDept((prev) => prev ? { ...prev, name: e.target.value } : null)}
                placeholder="Department Name"
              />
            </FormField>
            <FormField label="Department Code">
              <Input
                value={editDept.code}
                onChange={(e) => setEditDept((prev) => prev ? { ...prev, code: e.target.value.toUpperCase() } : null)}
                placeholder="CODE"
              />
            </FormField>
            <FormField label="Description">
              <Input
                value={editDept.description}
                onChange={(e) => setEditDept((prev) => prev ? { ...prev, description: e.target.value } : null)}
                placeholder="Description (Optional)"
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <Button variant="secondary" onClick={() => setEditDept(null)}>Cancel</Button>
              <Button
                disabled={!editDept.name || !editDept.code}
                loading={updateDeptMutation.isPending}
                onClick={() => updateDeptMutation.mutate(editDept)}
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Department Modal */}
      <Modal open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, id: "", label: "" })} title="Delete Department" size="sm">
        <div className="space-y-4 mt-2">
          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
            <Trash2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-800">Delete permanently?</p>
              <p className="text-xs text-red-600 mt-0.5">This will permanently delete <strong>{deleteConfirm.label}</strong>.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setDeleteConfirm({ open: false, id: "", label: "" })}>Cancel</Button>
            <Button variant="danger" loading={deleteDeptMutation.isPending} onClick={() => deleteDeptMutation.mutate(deleteConfirm.id)}>Delete Permanently</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}