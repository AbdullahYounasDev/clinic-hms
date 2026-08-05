// components/patients/patient-details/emergency-contact-card.tsx
import { Card, CardBody } from "@/components/ui";
import { UserCheck } from "lucide-react";

export function EmergencyContactCard({ p }: { p: any }) {
  const ec = p.emergencyContact || {};
  const hasGuardian = ec.name || ec.phone || ec.relationship || ec.email;

  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
            <UserCheck className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-900">Guardian / Next of Kin</h3>
            <p className="text-[10px] text-gray-400">Primary family contact or guardian</p>
          </div>
        </div>
        {hasGuardian ? (
          <div className="space-y-2.5">
            <Row label="Full Name" value={ec.name} />
            <Row label="Relationship" value={ec.relationship} />
            <Row label="Phone Number" value={ec.phone} />
            {ec.email && <Row label="Email Address" value={ec.email} />}
          </div>
        ) : (
          <p className="text-xs text-gray-400 py-2">No guardian or next-of-kin information recorded.</p>
        )}
      </CardBody>
    </Card>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-gray-400 shrink-0">{label}</span>
      <span className="text-xs text-gray-700 text-right truncate font-medium">{value}</span>
    </div>
  );
}