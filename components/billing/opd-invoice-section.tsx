// components/billing/opd-invoice-section.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardBody, FormField, Select, Badge } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { UseFormSetValue } from "react-hook-form";
import { useClinicSettings } from "@/components/providers/clinic-provider";

interface LineItem {
    description: string;
    category: string;
    quantity: number;
    unitPrice: number;
    total: number;
    medicine?: string;
}

interface Props {
    selectedDoctor: string;
    setSelectedDoctor: (v: string) => void;
    selectedPatient: string;
    setSelectedPatient: (v: string) => void;
    watchedItems: LineItem[];
    setValue: UseFormSetValue<any>;
}

export function OpdInvoiceSection({ selectedDoctor, setSelectedDoctor, selectedPatient, setSelectedPatient, watchedItems, setValue }: Props) {
    const { formatTime } = useClinicSettings();

    const { data: patientsData } = useQuery({
        queryKey: ["patients-select"],
        queryFn: () => axios.get("/api/publicPatients", { params: { limit: 200 } }).then(r => r.data),
    });

    const { data: doctorsData } = useQuery({
        queryKey: ["doctors-select"],
        queryFn: () => axios.get("/api/doctors", { params: { limit: 100 } }).then(r => r.data),
    });

    const { data: appointmentsData } = useQuery({
        queryKey: ["appointments-doctor-patient", selectedDoctor, selectedPatient],
        queryFn: () => axios.get("/api/appointments", {
            params: { doctor: selectedDoctor, patient: selectedPatient, status: "scheduled,checked_in,in_consultation,completed", limit: 50 }
        }).then(r => r.data),
        enabled: !!selectedDoctor && !!selectedPatient,
    });

    const patients = patientsData?.data || [];
    const doctors = doctorsData?.data || [];
    const appointments = appointmentsData?.data || [];

    const addAppointmentItem = (apt: any) => {
        const docName = apt.doctor?.user ? `Dr. ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}` : "Doctor";
        const newItem: LineItem = {
            description: `Consultation Fee — ${docName} (${formatDate(apt.scheduledDate)} at ${formatTime(apt.scheduledTime)})`,
            category: "consultation",
            quantity: 1,
            unitPrice: apt.consultationFee || 0,
            total: apt.consultationFee || 0,
        };
        setValue("items", [...watchedItems, newItem], { shouldDirty: true, shouldValidate: true });
    };

    return (
        <Card>
            <CardBody>
                <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-gray-900 border-b border-gray-200 pb-2">OPD / Consultation Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Select Patient">
                            <Select value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)}>
                                <option value="">-- Choose Patient --</option>
                                {patients.map((p: any) => (
                                    <option key={p._id} value={p._id}>
                                        {p.firstName} {p.lastName} ({p.patientId})
                                    </option>
                                ))}
                            </Select>
                        </FormField>

                        <FormField label="Select Doctor">
                            <Select value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)}>
                                <option value="">-- Choose Doctor --</option>
                                {doctors.map((d: any) => (
                                    <option key={d._id} value={d._id}>
                                        {d.user ? `Dr. ${d.user.firstName} ${d.user.lastName}` : d._id} ({d.specialization})
                                    </option>
                                ))}
                            </Select>
                        </FormField>
                    </div>

                    {selectedDoctor && selectedPatient && (
                        <div>
                            <p className="text-xs font-medium text-gray-600 mb-2">Appointments</p>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {appointments.map((apt: any) => (
                                    <div
                                        key={apt._id}
                                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer"
                                        onClick={() => addAppointmentItem(apt)}
                                    >
                                        <div>
                                            <p className="text-xs font-medium text-gray-900">
                                                {formatDate(apt.scheduledDate)} at {formatTime(apt.scheduledTime)}
                                            </p>
                                            <p className="text-xs text-gray-400">{apt.appointmentId}</p>
                                        </div>
                                        <Badge variant="outline">{formatCurrency(apt.consultationFee)}</Badge>
                                    </div>
                                ))}
                                {appointments.length === 0 && (
                                    <p className="text-xs text-gray-400 text-center py-4">No appointments found</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </CardBody>
        </Card>
    );
}