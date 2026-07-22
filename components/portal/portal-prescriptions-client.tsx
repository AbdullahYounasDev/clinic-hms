"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Eye } from "lucide-react";
import { Card, Table, Th, Td, StatusBadge, EmptyState, Pagination } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { useState } from "react";

export function PortalPrescriptionsClient() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["portal-prescriptions", page],
    queryFn: () => axios.get("/api/portal/prescriptions", { params: { page, limit: 15 } }).then((r) => r.data),
  });

  const prescriptions = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Prescriptions</h1>
        <p className="text-xs text-gray-500 mt-0.5">Medicines prescribed during your visits</p>
      </div>

      {/* Desktop Table */}
      <Card className="hidden md:block overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Doctor</Th>
              <Th>Medicines</Th>
              <Th>Status</Th>
              <Th className="text-right">Action</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(5)].map((_, j) => <Td key={j}><div className="h-4 bg-gray-100 rounded" /></Td>)}</tr>
              ))
            ) : prescriptions.length === 0 ? (
              <tr><td colSpan={5}><EmptyState title="No prescriptions" description="No prescriptions found." /></td></tr>
            ) : (
              prescriptions.map((rx: any) => (
                <tr key={rx._id}>
                  <Td className="text-gray-500">{formatDate(rx.createdAt)}</Td>
                  <Td>Dr. {rx.doctor?.user?.firstName} {rx.doctor?.user?.lastName}</Td>
                  <Td className="text-gray-600">{rx.medicines?.length || 0} item(s)</Td>
                  <Td><StatusBadge status={rx.status} /></Td>
                  <Td className="text-right">
                    <Link
                      href={`/portal/prescriptions/${rx._id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </Link>
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
                <div className="h-6 bg-gray-100 rounded w-16" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 bg-gray-100 rounded w-32" />
                <div className="h-3 bg-gray-100 rounded w-16" />
              </div>
              <div className="flex items-center justify-between">
                <div className="h-3 bg-gray-100 rounded w-20" />
                <div className="h-6 bg-gray-100 rounded w-20" />
              </div>
            </div>
          ))
        ) : prescriptions.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No prescriptions" description="No prescriptions found." />
          </div>
        ) : (
          prescriptions.map((rx: any) => (
            <div key={rx._id} className="flex items-start justify-between p-3 gap-2">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-gray-900">
                    Dr. {rx.doctor?.user?.firstName} {rx.doctor?.user?.lastName}
                  </span>
                  <StatusBadge status={rx.status} />
                </div>
                <p className="text-xs text-gray-500">
                  {formatDate(rx.createdAt)}
                </p>
                <p className="text-xs text-gray-600">
                  {rx.medicines?.length || 0} medicine{rx.medicines?.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="shrink-0">
                <Link
                  href={`/portal/prescriptions/${rx._id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> View
                </Link>
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