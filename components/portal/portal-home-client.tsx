"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { Card, CardBody, Skeleton, Alert } from "@/components/ui";
import { Calendar, Clipboard, Receipt, FlaskConical, Pill } from "lucide-react";
import { formatDate } from "@/lib/utils";

export function PortalHomeClient() {
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["portal-me"],
    queryFn: () => axios.get("/api/portal/me").then((r) => r.data),
  });

  const { data: appts } = useQuery({
    queryKey: ["portal-appointments-preview"],
    queryFn: () => axios.get("/api/portal/appointments", { params: { limit: 3 } }).then((r) => r.data),
  });

  const patient = profile?.data;
  const upcoming = appts?.data || [];

  if (profileLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      </div>
    );
  }

  const navItems = [
    { title: "Appointments", href: "/portal/appointments", icon: Calendar },
    { title: "Medical Records", href: "/portal/emr", icon: Clipboard },
    { title: "Prescriptions", href: "/portal/prescriptions", icon: Pill },
    { title: "Lab Tests", href: "/portal/lab", icon: FlaskConical },
    { title: "Billing", href: "/portal/billing", icon: Receipt },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">
          Welcome, {patient?.firstName}
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {patient?.patientId} · View your health records and appointments
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {navItems.map((item) => (
          <Link key={item.title} href={item.href}>
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 hover:border-teal-300 transition-colors cursor-pointer">
              <item.icon className="w-4 h-4 text-teal-600 shrink-0" />
              <span className="text-xs font-medium text-gray-700">{item.title}</span>
            </div>
          </Link>
        ))}
      </div>

      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-900">Recent Appointments</h2>
            <Link 
              href="/portal/appointments" 
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 cursor-pointer transition-colors"
            >
              View all
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">No appointments yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {upcoming.map((a: any) => (
                <div key={a._id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900">
                      Dr. {a.doctor?.user?.firstName} {a.doctor?.user?.lastName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(a.scheduledDate)} · {a.scheduledTime}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {a.queueNumber != null && (
                      <p className="text-xs font-semibold text-teal-700">Queue #{a.queueNumber}</p>
                    )}
                    <p className="text-[10px] text-gray-400 capitalize">{a.status?.replace(/_/g, " ")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Alert type="info">
        Your portal is read-only. Contact the clinic to update personal details. You can change your password anytime.
      </Alert>
    </div>
  );
}