"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardBody, StatusBadge, Badge, Skeleton, Alert } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { User, Phone } from "lucide-react";

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-xs text-gray-700 text-right">{value || "—"}</span>
    </div>
  );
}

export function PortalProfileClient() {
  const { data, isLoading } = useQuery({
    queryKey: ["portal-me"],
    queryFn: () => axios.get("/api/portal/me").then((r) => r.data),
  });

  const p = data?.data;

  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;
  if (!p) return <Alert type="error">Unable to load profile.</Alert>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">My Profile</h1>
        <p className="text-xs text-gray-500 mt-0.5">Read-only — contact the clinic to update details</p>
      </div>

      <Card>
        <CardBody>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold">
              {p.firstName?.charAt(0)}{p.lastName?.charAt(0)}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{p.firstName} {p.lastName}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500">{p.patientId}</span>
                <StatusBadge status={p.status} />
                {p.portalEnabled && <Badge variant="success">Portal Active</Badge>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-gray-900 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Personal</p>
              <Row label="Gender" value={p.gender} />
              <Row label="Date of Birth" value={p.dateOfBirth ? formatDate(p.dateOfBirth) : undefined} />
              <Row label="Blood Group" value={p.bloodGroup} />
            </div>
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-gray-900 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Contact</p>
              <Row label="Phone" value={p.phone} />
              <Row label="Email" value={p.email} />
              <Row label="City" value={p.address?.city} />
            </div>
          </div>

          {(p.allergies?.length > 0 || p.chronicDiseases?.length > 0) && (
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
              {p.allergies?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Allergies</p>
                  <div className="flex flex-wrap gap-1">{p.allergies.map((a: string) => <Badge key={a} variant="warning">{a}</Badge>)}</div>
                </div>
              )}
              {p.chronicDiseases?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Chronic Conditions</p>
                  <div className="flex flex-wrap gap-1">{p.chronicDiseases.map((c: string) => <Badge key={c} variant="outline">{c}</Badge>)}</div>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
