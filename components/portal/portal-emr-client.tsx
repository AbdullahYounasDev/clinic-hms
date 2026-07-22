"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, Table, Th, Td, Badge, EmptyState, Pagination } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { useState } from "react";

export function PortalEmrClient() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["portal-emr", page],
    queryFn: () => axios.get("/api/portal/emr", { params: { page, limit: 15 } }).then((r) => r.data),
  });

  const records = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Medical Records</h1>
        <p className="text-xs text-gray-500 mt-0.5">Your visit history and diagnoses</p>
      </div>

      {/* Desktop Table */}
      <Card className="hidden md:block overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <Th>Visit Date</Th>
              <Th>Doctor</Th>
              <Th>Chief Complaint</Th>
              <Th>Diagnosis</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(4)].map((_, j) => <Td key={j}><div className="h-4 bg-gray-100 rounded" /></Td>)}</tr>
              ))
            ) : records.length === 0 ? (
              <tr><td colSpan={4}><EmptyState title="No records" description="No medical records found." /></td></tr>
            ) : (
              records.map((r: any) => (
                <tr key={r._id}>
                  <Td className="text-gray-500">{formatDate(r.visitDate)}</Td>
                  <Td>Dr. {r.doctor?.user?.firstName} {r.doctor?.user?.lastName}</Td>
                  <Td className="max-w-[200px] truncate text-gray-600">{r.chiefComplaint}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {r.diagnosis?.slice(0, 2).map((d: any, i: number) => (
                        <Badge key={i} variant="outline">{d.description}</Badge>
                      ))}
                    </div>
                  </Td>
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
                <div className="h-4 bg-gray-100 rounded w-32" />
              </div>
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="flex items-center gap-2">
                <div className="h-5 bg-gray-100 rounded w-16" />
                <div className="h-5 bg-gray-100 rounded w-20" />
              </div>
            </div>
          ))
        ) : records.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No records" description="No medical records found." />
          </div>
        ) : (
          records.map((r: any) => (
            <div key={r._id} className="p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900">
                    Dr. {r.doctor?.user?.firstName} {r.doctor?.user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(r.visitDate)}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  Visit
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-600">
                  <span className="text-gray-500">Complaint: </span>
                  {r.chiefComplaint}
                </p>
              </div>
              {r.diagnosis && r.diagnosis.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {r.diagnosis.map((d: any, i: number) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {d.description}
                    </Badge>
                  ))}
                </div>
              )}
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