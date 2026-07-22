"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Trash2 } from "lucide-react";
import { Card, Table, Th, Td, StatusBadge, Badge, Button, EmptyState, Modal } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

export function PrescriptionsTab({ patientId }: { patientId: string }) {
    const router = useRouter();
    const qc = useQueryClient();
    const { data: session } = useSession();
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; label: string }>({ open: false, id: "", label: "" });

    const isSA = session?.user?.isSuperAdmin;
    const perms = session?.user?.permissions || [];
    const canDelete = isSA || perms.includes("prescriptions:delete");

    const { data } = useQuery({
        queryKey: ["patient-prescriptions", patientId],
        queryFn: () => axios.get("/api/prescriptions", { params: { patient: patientId, limit: 50 } }).then(r => r.data),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => axios.delete(`/api/prescriptions/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["patient-prescriptions", patientId] });
            setDeleteConfirm({ open: false, id: "", label: "" });
            toast.success("Prescription deleted!");
        },
        onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to delete"),
    });

    const prescriptions = data?.data || [];

    return (
        <>
            {/* Desktop Table */}
            <Card className="hidden md:block overflow-x-auto">
                <Table>
                    <thead>
                        <tr>
                            <Th>Rx ID</Th>
                            <Th>Doctor</Th>
                            <Th>Medicines</Th>
                            <Th>Type</Th>
                            <Th>Status</Th>
                            <Th>Date</Th>
                            <Th>Actions</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {prescriptions.length === 0 ? (
                            <tr>
                                <td colSpan={7}>
                                    <EmptyState
                                        title="No prescriptions found"
                                        description="No prescriptions have been recorded for this patient."
                                    />
                                </td>
                            </tr>
                        ) : (
                            prescriptions.map((rx: any) => (
                                <tr key={rx._id}>
                                    <Td>
                                        <span className="font-medium text-gray-900">{rx.prescriptionId}</span>
                                    </Td>
                                    <Td className="text-gray-600">
                                        Dr. {rx.doctor?.user?.firstName} {rx.doctor?.user?.lastName}
                                    </Td>
                                    <Td>
                                        <div className="max-w-[250px]">
                                            {rx.medicines?.length > 0 ? (
                                                <div className="space-y-0.5">
                                                    {rx.medicines.slice(0, 2).map((m: any, i: number) => (
                                                        <div key={i} className="text-xs text-gray-600">
                                                            {m.medicineName} — {m.dosage}, {m.frequency}
                                                        </div>
                                                    ))}
                                                    {rx.medicines.length > 2 && (
                                                        <span className="text-xs text-gray-400">
                                                            +{rx.medicines.length - 2} more
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-300">—</span>
                                            )}
                                        </div>
                                    </Td>
                                    <Td>
                                        <Badge variant="outline" className="capitalize">{rx.type}</Badge>
                                    </Td>
                                    <Td><StatusBadge status={rx.status} /></Td>
                                    <Td className="text-gray-400">{formatDate(rx.createdAt)}</Td>
                                    <Td>
                                        <div className="flex items-center gap-1">
                                            {rx.emr && (
                                                <Button size="sm" onClick={() => router.push(`/opd/${rx.emr}`)}>
                                                    View
                                                </Button>
                                            )}
                                            {canDelete && (
                                                <Button size="sm" variant="danger" onClick={() => setDeleteConfirm({ open: true, id: rx._id, label: rx.prescriptionId })}>
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
            </Card>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-100 border border-gray-300 rounded-lg bg-white">
                {prescriptions.length === 0 ? (
                    <EmptyState
                        title="No prescriptions found"
                        description="No prescriptions have been recorded for this patient."
                    />
                ) : (
                    prescriptions.map((rx: any) => (
                        <div key={rx._id} className="flex items-center justify-between p-3 gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-900">{rx.prescriptionId}</span>
                                    <StatusBadge status={rx.status} />
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <Badge variant="outline" className="capitalize">{rx.type}</Badge>
                                    <span className="text-xs text-gray-500">
                                        Dr. {rx.doctor?.user?.firstName} {rx.doctor?.user?.lastName}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">
                                    {rx.medicines?.length || 0} medicine{(rx.medicines?.length || 0) !== 1 ? "s" : ""}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {rx.emr && (
                                    <Button size="sm" onClick={() => router.push(`/opd/${rx.emr}`)}>
                                        View
                                    </Button>
                                )}
                                {canDelete && (
                                    <Button size="sm" variant="danger" onClick={() => setDeleteConfirm({ open: true, id: rx._id, label: rx.prescriptionId })}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <Modal open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, id: "", label: "" })} title="Delete Prescription" size="sm">
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
        </>
    );
}
