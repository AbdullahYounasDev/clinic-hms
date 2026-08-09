// components/appointments/appointment-detail-client.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    ArrowLeft, Calendar, FileText, Edit2, Clock, Printer, Download, Trash2, Hash, RefreshCw,
} from "lucide-react";
import {
    Card, CardBody, StatusBadge, Badge, Button,
    Skeleton, Alert, Modal, FormField, Input, Select,
} from "@/components/ui";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import { updateAppointmentSchema, UpdateAppointmentInput } from "@/lib/validations";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { generateAppointmentPrintHtml, AppointmentPdfTemplate } from "../printTemplates/appointment-templates";
import { pdf } from "@react-pdf/renderer";
import { useClinicSettings } from "@/components/providers/clinic-provider";
import { toClinicDateString } from "@/lib/time-utils";

interface Appointment {
    _id: string;
    appointmentId: string;
    patient: { _id: string; firstName: string; lastName: string; patientId: string; phone: string };
    doctor: { _id: string; user: { firstName: string; lastName: string }; doctorId: string };
    department?: { _id: string; name: string; code: string };
    type: string;
    status: string;
    scheduledDate: string;
    scheduledTime: string;
    duration: number;
    chiefComplaint?: string;
    notes?: string;
    cancellationReason?: string;
    consultationFee: number;
    isPaid: boolean;
    checkedInAt?: string;
    completedAt?: string;
    createdAt: string;
    queueNumber?: number;
}

export function AppointmentDetailClient({ appointmentId }: { appointmentId: string }) {
    const { data: session } = useSession();
    const router = useRouter();
    const qc = useQueryClient();
    const clinicSettings = useClinicSettings();
    const [editOpen, setEditOpen] = useState(false);
    const [error, setError] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("");
    const [cancelReason, setCancelReason] = useState("");
    const [showCancelReason, setShowCancelReason] = useState(false);
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const perms = session?.user.permissions || [];
    const isSA = session?.user.isSuperAdmin;
    const canUpdate = isSA || perms.includes("appointments:update");
    const canDelete = isSA || perms.includes("appointments:delete");

    const { data, isLoading, error: queryError } = useQuery({
        queryKey: ["appointment", appointmentId],
        queryFn: () => axios.get(`/api/appointments/${appointmentId}`).then(r => r.data),
    });

    const a: Appointment | undefined = data?.data;

    const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<UpdateAppointmentInput>({
        resolver: zodResolver(updateAppointmentSchema),
    });

    const watchedScheduledTime = useWatch({ control, name: "scheduledTime" });
    const watchedScheduledDate = useWatch({ control, name: "scheduledDate" });
    const watchedDuration = useWatch({ control, name: "duration" });

    const doctorId = a?.doctor?._id;

    // Fetch dynamic available slots for scheduling system logic
    const { data: slotsData, isFetching: slotsFetching } = useQuery({
        queryKey: ["available-slots", doctorId, watchedScheduledDate, watchedDuration, appointmentId],
        queryFn: () =>
            axios
                .get("/api/appointments/available-slots", {
                    params: {
                        doctor: doctorId,
                        date: watchedScheduledDate,
                        duration: watchedDuration || 30,
                        excludeAppointmentId: appointmentId,
                    },
                })
                .then((r) => r.data),
        enabled: editOpen && !!doctorId && !!watchedScheduledDate,
    });

    const updateMutation = useMutation({
        mutationFn: (data: UpdateAppointmentInput) => {
            const updateData: any = { ...data };
            if (data.status !== "cancelled") updateData.cancellationReason = "";
            return axios.put(`/api/appointments/${appointmentId}`, updateData);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["appointment", appointmentId] });
            qc.invalidateQueries({ queryKey: ["appointments"] });
            qc.invalidateQueries({ queryKey: ["queue-status"] });
            qc.invalidateQueries({ queryKey: ["queue-status-appointments"] });
            qc.invalidateQueries({ queryKey: ["portal-queue-status"] });
            setEditOpen(false);
            setCancelReason("");
            setShowCancelReason(false);
            setError("");
            toast.success("Appointment updated successfully!");
        },
        onError: (e: any) => {
            const msg = e?.response?.data?.error || "Failed to update appointment";
            setError(msg);
            toast.error(msg);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => axios.delete(`/api/appointments/${appointmentId}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["appointments"] });
            qc.invalidateQueries({ queryKey: ["queue-status"] });
            qc.invalidateQueries({ queryKey: ["queue-status-appointments"] });
            toast.success("Appointment deleted!");
            router.push("/appointments");
        },
        onError: (e: any) => {
            const msg = e?.response?.data?.error || "Failed to delete";
            setError(msg);
            toast.error(msg);
        },
    });

    const openEditModal = () => {
        if (data?.data) {
            const appt = data.data;
            reset({
                scheduledDate: toClinicDateString(appt.scheduledDate),
                scheduledTime: appt.scheduledTime,
                duration: appt.duration,
                type: appt.type,
                status: appt.status,
                chiefComplaint: appt.chiefComplaint || "",
                notes: appt.notes || "",
                consultationFee: appt.consultationFee,
            });
            setSelectedStatus(appt.status);
            setShowCancelReason(appt.status === "cancelled");
            if (appt.status === "cancelled") setCancelReason(appt?.cancellationReason || "");
            setError("");
            setEditOpen(true);
        }
    };

    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = e.target.value as UpdateAppointmentInput["status"];
        setValue("status", newStatus);
        setSelectedStatus(newStatus || "");
        setShowCancelReason(newStatus === "cancelled");
        if (newStatus !== "cancelled") setCancelReason("");
    };

    const onSubmit = (formData: UpdateAppointmentInput) => {
        if (formData.status === "cancelled" && !cancelReason) {
            setError("Cancellation reason is required");
            return;
        }
        updateMutation.mutate({ ...formData, cancellationReason: cancelReason });
    };

    const handlePrint = () => {
        if (!data?.data) return;
        const printWindow = window.open("", "_blank");
        if (!printWindow) { toast.error("Please allow pop-ups to print."); return; }
        printWindow.document.write(generateAppointmentPrintHtml(data.data, clinicSettings.logoUrl, clinicSettings));
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
    };

    const handleDownloadPdf = async () => {
        if (!data?.data) return;
        setIsPdfLoading(true);
        try {
            const blob = await pdf(<AppointmentPdfTemplate appointment={data.data} logoUrl={clinicSettings.logoUrl} clinicDetails={clinicSettings} />).toBlob();
            const url = URL.createObjectURL(blob);
            const apptLink = document.createElement("a");
            apptLink.href = url;
            apptLink.download = `${data.data.appointmentId}.pdf`;
            document.body.appendChild(apptLink);
            apptLink.click();
            document.body.removeChild(apptLink);
            URL.revokeObjectURL(url);
            toast.success("PDF downloaded!");
        } catch {
            toast.error("Failed to generate PDF");
        } finally {
            setIsPdfLoading(false);
        }
    };

    if (isLoading) return (
        <div className="space-y-4">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
        </div>
    );

    if (queryError || !data?.data) return (
        <div className="space-y-4">
            <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <Alert type="error">Appointment not found.</Alert>
        </div>
    );

    const apptRecord: Appointment = data.data;

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <button onClick={() => router.back()} className="p-2 rounded-lg border border-gray-300 text-gray-400 cursor-pointer shrink-0 mt-0.5">
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-lg font-semibold text-gray-900">{apptRecord.appointmentId}</h1>
                            <StatusBadge status={apptRecord.status} />
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{formatDate(apptRecord.scheduledDate)} • {apptRecord.scheduledTime} ({apptRecord.duration} min)</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {canUpdate && (
                        <Button size="sm" onClick={() => router.push(`/opd?appointmentId=${apptRecord._id}&patientId=${apptRecord.patient?._id}`)}>
                            <FileText className="w-3.5 h-3.5" /> Create EMR
                        </Button>
                    )}
                    <Button variant="secondary" size="sm" onClick={handlePrint}>
                        <Printer className="w-3.5 h-3.5" /> Print
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleDownloadPdf} loading={isPdfLoading}>
                        <Download className="w-3.5 h-3.5" /> PDF
                    </Button>
                    <Button variant="secondary" size="sm" onClick={openEditModal}>
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                    </Button>
                    {canDelete && (
                        <Button variant="danger" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                    <CardBody>
                        <div className="flex items-center gap-2 mb-4"><div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center"><Calendar className="w-4 h-4 text-teal-600" /></div><h3 className="text-xs font-semibold text-gray-900">Patient & Doctor</h3></div>
                        <div className="space-y-2.5">
                            <Row label="Patient"><Link href={`/patients/${apptRecord.patient?._id}`} className="text-teal-600 font-medium">{apptRecord.patient?.firstName} {apptRecord.patient?.lastName}</Link></Row>
                            <Row label="Patient ID" value={apptRecord.patient?.patientId} />
                            <Row label="Phone" value={apptRecord.patient?.phone} />
                            <Row label="Doctor" value={`Dr. ${apptRecord.doctor?.user?.firstName} ${apptRecord.doctor?.user?.lastName}`} />
                            {apptRecord.department && <Row label="Department" value={apptRecord.department.name} />}
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardBody>
                        <div className="flex items-center gap-2 mb-4"><div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center"><Clock className="w-4 h-4 text-teal-600" /></div><h3 className="text-xs font-semibold text-gray-900">Schedule & Queue</h3></div>
                        <div className="space-y-2.5">
                            <Row label="Date" value={formatDate(apptRecord.scheduledDate)} />
                            <Row label="Time" value={clinicSettings.formatTime(apptRecord.scheduledTime)} />
                            <Row label="Duration" value={`${apptRecord.duration} mins`} />
                            <Row label="Type"><Badge variant="outline" className="capitalize">{apptRecord.type?.replace(/_/g, " ")}</Badge></Row>
                            <Row label="Queue Number">
                                {apptRecord.queueNumber != null ? (
                                    <Badge variant={apptRecord.queueNumber === 0 ? "warning" : "info"}>
                                        #{apptRecord.queueNumber === 0 ? "P" : apptRecord.queueNumber}
                                    </Badge>
                                ) : <span className="text-gray-300">—</span>}
                            </Row>
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardBody>
                        <div className="flex items-center gap-2 mb-4"><div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center"><FileText className="w-4 h-4 text-teal-600" /></div><h3 className="text-xs font-semibold text-gray-900">Clinical Overview</h3></div>
                        <div className="space-y-2.5">
                            <Row label="Chief Complaint" value={apptRecord.chiefComplaint || "Not specified"} />
                            <Row label="Consultation Fee" value={formatCurrency(apptRecord.consultationFee)} />
                        </div>
                    </CardBody>
                </Card>

                {apptRecord.notes && (
                    <Card>
                        <CardBody>
                            <div className="flex items-center gap-2 mb-4"><div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"><FileText className="w-4 h-4 text-gray-400" /></div><h3 className="text-xs font-semibold text-gray-900">Notes</h3></div>
                            <p className="text-xs text-gray-600">{apptRecord.notes}</p>
                        </CardBody>
                    </Card>
                )}

                {apptRecord.cancellationReason && (
                    <Card className="sm:col-span-2 border-red-200 bg-red-50">
                        <CardBody>
                            <div className="flex items-center gap-2 mb-4"><div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center"><FileText className="w-4 h-4 text-red-500" /></div><h3 className="text-xs font-semibold text-red-700">Cancellation Reason</h3></div>
                            <p className="text-xs text-red-600">{apptRecord.cancellationReason}</p>
                        </CardBody>
                    </Card>
                )}

                <Card className="sm:col-span-2">
                    <CardBody>
                        <div className="flex items-center gap-2 mb-4"><div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"><Clock className="w-4 h-4 text-gray-400" /></div><h3 className="text-xs font-semibold text-gray-900">Record Information</h3></div>
                        <div className="flex gap-6 sm:gap-10">
                            <div><p className="text-xs text-gray-400">Created</p><p className="text-xs text-gray-700 mt-0.5">{formatDate(apptRecord.createdAt)}</p></div>
                            {apptRecord.checkedInAt && <div><p className="text-xs text-gray-400">Checked In</p><p className="text-xs text-gray-700 mt-0.5">{formatDate(apptRecord.checkedInAt)}</p></div>}
                            {apptRecord.completedAt && <div><p className="text-xs text-gray-400">Completed</p><p className="text-xs text-gray-700 mt-0.5">{formatDate(apptRecord.completedAt)}</p></div>}
                        </div>
                    </CardBody>
                </Card>
            </div>

            {/* Edit Appointment Modal with Scheduling System Integration */}
            <Modal open={editOpen} onClose={() => { setEditOpen(false); setError(""); }} title="Edit Appointment" size="lg">
                {error && <Alert type="error">{error}</Alert>}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <FormField label="Date" required error={errors.scheduledDate?.message}>
                            <Input
                                type="date"
                                {...register("scheduledDate")}
                                error={!!errors.scheduledDate}
                            />
                        </FormField>
                        <FormField label="Duration (mins)">
                            <Select {...register("duration", { valueAsNumber: true })}>
                                {[5, 10, 15, 20, 25, 30, 45, 60, 120].map(d => (
                                    <option key={d} value={d}>{d} min</option>
                                ))}
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
                    </div>

                    {/* Scheduling System Time Slot Selector */}
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

                        {!watchedScheduledDate ? (
                            <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center text-xs text-gray-500">
                                Select an appointment date to calculate available slots.
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
                                No time slots available for the selected date.
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
                                                    setError("");
                                                }}
                                                className={cn(
                                                    "flex flex-col items-center justify-center py-2 px-1.5 rounded-md text-xs font-medium transition-all border cursor-pointer",
                                                    isSelected
                                                        ? "bg-teal-600 text-white border-teal-600 shadow-sm ring-2 ring-teal-600/30"
                                                        : s.available
                                                            ? "bg-white border-teal-200 text-teal-900 hover:bg-teal-50 hover:border-teal-400"
                                                            : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60"
                                                )}
                                                title={!s.available ? s.reasonText || "Unavailable" : `Select ${s.displayTime}`}
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

                    <FormField label="Status">
                        <Select value={selectedStatus} onChange={handleStatusChange}>
                            <option value="scheduled">Scheduled</option>
                            <option value="checked_in">Checked In</option>
                            <option value="in_consultation">In Consultation</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="no_show">No Show</option>
                        </Select>
                    </FormField>
                    {showCancelReason && (
                        <FormField label="Cancellation Reason" required>
                            <textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs resize-none focus:outline-none focus:border-teal-600 text-gray-700 placeholder:text-gray-400"
                                placeholder="Reason for cancellation..."
                            />
                        </FormField>
                    )}
                    <FormField label="Chief Complaint"><Input {...register("chiefComplaint")} /></FormField>
                    <FormField label="Notes"><textarea {...register("notes")} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs resize-none focus:outline-none focus:border-teal-600 text-gray-700 placeholder:text-gray-400" /></FormField>
                    <FormField label="Consultation Fee"><Input type="number" {...register("consultationFee", { valueAsNumber: true })} /></FormField>
                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-300">
                        <Button type="button" variant="secondary" onClick={() => { setEditOpen(false); setError(""); }}>Cancel</Button>
                        <Button type="submit" loading={updateMutation.isPending}>Save Changes</Button>
                    </div>
                </form>
            </Modal>

            <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Delete Appointment" size="sm">
                <div className="space-y-4 mt-2">
                    <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                        <Trash2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-semibold text-red-800">Delete permanently?</p>
                            <p className="text-xs text-red-600 mt-0.5">This will permanently delete <strong>{apptRecord.appointmentId}</strong>.</p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-300">
                        <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
                        <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>Delete Permanently</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

function Row({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
    return <div className="flex items-center justify-between gap-3"><span className="text-xs text-gray-400 shrink-0">{label}</span>{children ? <span className="text-xs text-right">{children}</span> : <span className="text-xs text-gray-700 text-right truncate">{value}</span>}</div>;
}