// components/patients/patient-details/patient-header.tsx
import { Card, CardBody, StatusBadge, Badge, Button } from "@/components/ui";
import { Phone, Mail, MapPin, Edit2, ArrowLeft, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface Patient {
    _id: string; patientId: string; firstName: string; lastName: string;
    gender: string; dateOfBirth: string; phone: string;
    email?: string; bloodGroup?: string; status: string; photo?: string;
    portalEnabled?: boolean;
    address?: { street?: string; city?: string; state?: string; country?: string };
    createdAt: string;
}

export function PatientHeader({
    p,
    onEdit,
    canDelete,
    onDelete,
}: {
    p: Patient;
    onEdit: () => void;
    canDelete?: boolean;
    onDelete?: () => void;
}) {
    const router = useRouter();

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg border border-gray-300 text-gray-400 cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={onEdit}>
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                    </Button>
                    {canDelete && onDelete && p.status === "active" && (
                        <Button variant="danger" size="sm" onClick={onDelete}>
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                        </Button>
                    )}
                </div>
            </div>

            <Card>
                <CardBody>
                    <div className="flex flex-col sm:flex-row items-start gap-4">
                        <div className="w-14 h-14 rounded-lg bg-teal-600 flex items-center justify-center shrink-0 text-lg font-bold text-white">
                            {p.photo ? (
                                <img src={p.photo} alt={p.firstName} className="w-14 h-14 rounded-lg object-cover" />
                            ) : (
                                p.firstName?.charAt(0) || "P"
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-lg font-semibold text-gray-900">{p.firstName} {p.lastName}</h1>
                                <span className="text-xs text-gray-400">{p.patientId}</span>
                                <StatusBadge status={p.status} />
                                {p.portalEnabled && <Badge variant="success">Portal</Badge>}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
                                <span className="capitalize">{p.gender}</span>
                                {p.dateOfBirth && (
                                    <span>
                                        {(() => {
                                            const birth = new Date(p.dateOfBirth);
                                            if (isNaN(birth.getTime())) return "";
                                            const today = new Date();
                                            let age = today.getFullYear() - birth.getFullYear();
                                            const m = today.getMonth() - birth.getMonth();
                                            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
                                            return `${age} years`;
                                        })()}
                                    </span>
                                )}
                                {p.dateOfBirth && <span>DOB: {formatDate(p.dateOfBirth)}</span>}
                                {p.bloodGroup && <Badge variant="danger">{p.bloodGroup}</Badge>}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
                                {p.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</span>}
                                {p.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{p.email}</span>}
                                {p.address?.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[p.address.city, p.address.state, p.address.country].filter(Boolean).join(", ")}</span>}
                            </div>
                        </div>
                        <div className="text-xs text-gray-400 shrink-0">Registered {formatDate(p.createdAt)}</div>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}