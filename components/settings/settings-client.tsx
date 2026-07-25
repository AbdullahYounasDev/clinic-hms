"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import axios from "axios";
import {
  Card, CardBody, Button, FormField, Input, Select, Alert, Badge, Modal,
} from "@/components/ui";
import {
  Plus, Trash2, Upload, Building2, Clock, CalendarOff, Settings
} from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useClinicSettings, WorkingDay, ClosingDay } from "@/components/providers/clinic-provider";

const TABS = [
  { id: "clinic", label: "Clinic Information", icon: Building2 },
  { id: "workingDays", label: "Working Days & Hours", icon: Clock },
  { id: "closingDays", label: "Closing Days / Holidays", icon: CalendarOff },
  { id: "departments", label: "Departments", icon: Settings },
];

const DAYS_OF_WEEK = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
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
  const [deptError, setDeptError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; label: string }>({ open: false, id: "", label: "" });

  // Working Days state
  const [isAddDayOpen, setIsAddDayOpen] = useState(false);
  const [dayError, setDayError] = useState("");
  const [newDay, setNewDay] = useState<WorkingDay>({
    day: "Monday",
    openingTime: "08:00",
    breakStart: "",
    breakEnd: "",
    closingTime: "17:00",
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

  const { register, handleSubmit, reset, watch, setValue } = useForm<{
    clinicName: string;
    clinicTagline: string;
    clinicAddress: string;
    phone: string;
    email: string;
    logo: string;
    logoPublicId: string;
    clinicType: string;
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
      });
    }
  }, [settings, reset]);

  const currentLogo = watch("logo") || "/logo.png";
  const currentLogoPublicId = watch("logoPublicId");

  const saveMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => axios.put("/api/settings", d),
    onSuccess: () => {
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
    { day: "Monday", openingTime: "08:00", breakStart: "13:00", breakEnd: "14:00", closingTime: "17:00", isOpen: true },
    { day: "Tuesday", openingTime: "08:00", breakStart: "13:00", breakEnd: "14:00", closingTime: "17:00", isOpen: true },
    { day: "Wednesday", openingTime: "08:00", breakStart: "13:00", breakEnd: "14:00", closingTime: "17:00", isOpen: true },
    { day: "Thursday", openingTime: "08:00", breakStart: "13:00", breakEnd: "14:00", closingTime: "17:00", isOpen: true },
    { day: "Friday", openingTime: "08:00", breakStart: "13:00", breakEnd: "14:00", closingTime: "17:00", isOpen: true },
  ];

  const handleAddWorkingDay = () => {
    setDayError("");
    const { day, openingTime, breakStart, breakEnd, closingTime } = newDay;

    if (!day || !openingTime || !closingTime) {
      setDayError("Day, Opening Time, and Closing Time are required.");
      return;
    }

    if (closingTime <= openingTime) {
      setDayError("Closing time must be later than opening time.");
      return;
    }

    if ((breakStart && !breakEnd) || (!breakStart && breakEnd)) {
      setDayError("Both Break Start and Break End must be specified if a break is added.");
      return;
    }

    if (breakStart && breakEnd) {
      if (breakStart < openingTime || breakStart >= closingTime) {
        setDayError("Break Start must fall between opening and closing times.");
        return;
      }
      if (breakEnd <= breakStart || breakEnd > closingTime) {
        setDayError("Break End must be after Break Start and before or at Closing Time.");
        return;
      }
    }

    // Check if day already exists
    const filteredDays = workingDays.filter(d => d.day !== day);
    const updatedDays = [...filteredDays, { ...newDay }].sort(
      (a, b) => DAYS_OF_WEEK.indexOf(a.day) - DAYS_OF_WEEK.indexOf(b.day)
    );

    saveMutation.mutate(
      { workingDays: updatedDays },
      {
        onSuccess: () => {
          setIsAddDayOpen(false);
          setNewDay({
            day: "Monday",
            openingTime: "08:00",
            breakStart: "",
            breakEnd: "",
            closingTime: "17:00",
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
                          <td className="px-4 py-3 text-teal-700 font-medium">{d.openingTime}</td>
                          <td className="px-4 py-3 text-gray-600">{d.breakStart || "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{d.breakEnd || "—"}</td>
                          <td className="px-4 py-3 text-teal-700 font-medium">{d.closingTime}</td>
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
                          <span className="text-teal-700 font-medium">{d.openingTime} - {d.closingTime}</span>
                          {d.breakStart && d.breakEnd && (
                            <span className="text-gray-400 text-[11px]">
                              (Break: {d.breakStart}-{d.breakEnd})
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
                  <FormField label="Opening Time" required>
                    <Input
                      type="time"
                      value={newDay.openingTime}
                      onChange={(e) => setNewDay((p) => ({ ...p, openingTime: e.target.value }))}
                    />
                  </FormField>

                  <FormField label="Closing Time" required>
                    <Input
                      type="time"
                      value={newDay.closingTime}
                      onChange={(e) => setNewDay((p) => ({ ...p, closingTime: e.target.value }))}
                    />
                  </FormField>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                  <span className="text-xs font-semibold text-gray-700 block">Break Hours (Optional)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Break Start">
                      <Input
                        type="time"
                        value={newDay.breakStart || ""}
                        onChange={(e) => setNewDay((p) => ({ ...p, breakStart: e.target.value }))}
                      />
                    </FormField>

                    <FormField label="Break End">
                      <Input
                        type="time"
                        value={newDay.breakEnd || ""}
                        onChange={(e) => setNewDay((p) => ({ ...p, breakEnd: e.target.value }))}
                      />
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
                    <div key={d._id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium text-gray-900">{d.name}</span>
                        {d.description && <span className="text-xs text-gray-400 block sm:inline sm:ml-2">— {d.description}</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline">{d.code}</Badge>
                        <Badge variant={d.isActive ? "success" : "default"}>{d.isActive ? "Active" : "Inactive"}</Badge>
                        {canEdit && d.isActive && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setDeleteConfirm({ open: true, id: d._id, label: `${d.name} (${d.code})` })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
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
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1 w-full">
                    <FormField label="Name">
                      <Input value={newDept.name} onChange={(e) => setNewDept((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Cardiology" />
                    </FormField>
                  </div>
                  <div className="w-full sm:w-28">
                    <FormField label="Code">
                      <Input value={newDept.code} onChange={(e) => setNewDept((p) => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="CARD" />
                    </FormField>
                  </div>
                  <div className="flex-1 w-full">
                    <FormField label="Description">
                      <Input value={newDept.description} onChange={(e) => setNewDept((p) => ({ ...p, description: e.target.value }))} placeholder="Optional" />
                    </FormField>
                  </div>
                  <Button onClick={() => addDeptMutation.mutate(newDept)} loading={addDeptMutation.isPending} disabled={!newDept.name || !newDept.code} className="w-full sm:w-auto">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

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