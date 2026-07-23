"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, Table, Th, Td, StatusBadge, EmptyState, Pagination, Badge } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { useState } from "react";
import { PatientQueueBanner, PatientQueueBannerData } from "./patient-queue-banner";

export function PortalAppointmentsClient() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["portal-appointments", page],
    queryFn: () => axios.get("/api/portal/appointments", { params: { page, limit: 15 } }).then((r) => r.data),
  });

  const {
    data: queueData,
    isFetching: queueFetching,
    refetch: refetchQueue,
  } = useQuery<{ success: boolean; data: PatientQueueBannerData }>({
    queryKey: ["portal-queue-status"],
    queryFn: () => axios.get("/api/portal/queue-status").then((r) => r.data),
    refetchInterval: 20_000,
  });

  const appointments = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Appointments</h1>
        <p className="text-xs text-gray-500 mt-0.5">Your scheduled and past visits</p>
      </div>

      <PatientQueueBanner
        data={queueData?.data}
        onReload={() => refetchQueue()}
        isReloading={queueFetching}
      />

      {/* Desktop Table */}
      <Card className="hidden md:block overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <Th>ID</Th>
              <Th>Doctor</Th>
              <Th>Date</Th>
              <Th>Time</Th>
              <Th>Queue</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(6)].map((_, j) => <Td key={j}><div className="h-4 bg-gray-100 rounded" /></Td>)}</tr>
              ))
            ) : appointments.length === 0 ? (
              <tr><td colSpan={6}><EmptyState title="No appointments" description="You have no appointments on record." /></td></tr>
            ) : (
              appointments.map((a: any) => (
                <tr key={a._id}>
                  <Td className="font-medium text-gray-900">{a.appointmentId}</Td>
                  <Td>Dr. {a.doctor?.user?.firstName} {a.doctor?.user?.lastName}</Td>
                  <Td className="text-gray-500">{formatDate(a.scheduledDate)}</Td>
                  <Td className="text-gray-500">{a.scheduledTime}</Td>
                  <Td>
                    {a.queueNumber != null ? (
                      <Badge variant={a.queueNumber === 0 ? "warning" : "info"}>
                        #{a.queueNumber === 0 ? "P" : a.queueNumber}
                      </Badge>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </Td>
                  <Td><StatusBadge status={a.status} /></Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-300 flex justify-end">
            <Pagination page={page} totalPages={pagination.totalPages} onPage={setPage} />
          </div>
        )}
      </Card>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-gray-100 border border-gray-300 rounded-lg bg-white">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-gray-100 rounded w-24" />
                <div className="h-6 bg-gray-100 rounded w-16" />
              </div>
              <div className="h-3 bg-gray-100 rounded w-32" />
              <div className="flex items-center gap-2">
                <div className="h-3 bg-gray-100 rounded w-20" />
                <div className="h-3 bg-gray-100 rounded w-16" />
              </div>
            </div>
          ))
        ) : appointments.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No appointments" description="You have no appointments on record." />
          </div>
        ) : (
          appointments.map((a: any) => (
            <div key={a._id} className="flex items-start justify-between p-3 gap-2">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-gray-900">
                    {a.appointmentId}
                  </span>
                  <StatusBadge status={a.status} />
                </div>
                <p className="text-xs text-gray-700 font-medium">
                  Dr. {a.doctor?.user?.firstName} {a.doctor?.user?.lastName}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                  <span>{formatDate(a.scheduledDate)}</span>
                  <span className="text-gray-300">•</span>
                  <span>{a.scheduledTime}</span>
                  {a.queueNumber != null && (
                    <>
                      <span className="text-gray-300">•</span>
                      <Badge variant={a.queueNumber === 0 ? "warning" : "info"} className="text-[10px]">
                        #{a.queueNumber === 0 ? "P" : a.queueNumber}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 flex justify-center border-t border-gray-100">
            <Pagination page={page} totalPages={pagination.totalPages} onPage={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
