"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Eye } from "lucide-react";
import { Card, Table, Th, Td, StatusBadge, EmptyState, Pagination } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useState } from "react";

export function PortalLabClient() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["portal-lab", page],
    queryFn: () => axios.get("/api/portal/lab", { params: { page, limit: 15 } }).then((r) => r.data),
  });

  const tests = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Lab Tests</h1>
        <p className="text-xs text-gray-500 mt-0.5">Your ordered tests and results status</p>
      </div>

      {/* Desktop Table */}
      <Card className="hidden md:block overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <Th>Lab ID</Th>
              <Th>Tests</Th>
              <Th>Date</Th>
              <Th>Cost</Th>
              <Th>Status</Th>
              <Th className="text-right">Action</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(6)].map((_, j) => <Td key={j}><div className="h-4 bg-gray-100 rounded" /></Td>)}</tr>
              ))
            ) : tests.length === 0 ? (
              <tr><td colSpan={6}><EmptyState title="No lab tests" description="No lab orders found." /></td></tr>
            ) : (
              tests.map((t: any) => (
                <tr key={t._id}>
                  <Td className="font-medium text-gray-900">{t.labTestId}</Td>
                  <Td className="text-gray-600">{t.tests?.length || 0} test(s)</Td>
                  <Td className="text-gray-500">{formatDate(t.createdAt)}</Td>
                  <Td>{formatCurrency(t.totalCost || 0)}</Td>
                  <Td><StatusBadge status={t.status} /></Td>
                  <Td className="text-right">
                    <Link
                      href={`/portal/lab/${t._id}`}
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
                <div className="h-3 bg-gray-100 rounded w-16" />
                <div className="h-3 bg-gray-100 rounded w-20" />
              </div>
              <div className="flex items-center justify-between">
                <div className="h-3 bg-gray-100 rounded w-16" />
                <div className="h-6 bg-gray-100 rounded w-20" />
              </div>
            </div>
          ))
        ) : tests.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No lab tests" description="No lab orders found." />
          </div>
        ) : (
          tests.map((t: any) => (
            <div key={t._id} className="flex items-start justify-between p-3 gap-2">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-gray-900">
                    {t.labTestId}
                  </span>
                  <StatusBadge status={t.status} />
                </div>
                <p className="text-xs text-gray-600">
                  {t.tests?.length || 0} test{t.tests?.length !== 1 ? "s" : ""}
                </p>
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <span className="text-gray-500">{formatDate(t.createdAt)}</span>
                  <span className="text-gray-300">|</span>
                  <span className="font-semibold text-gray-700">{formatCurrency(t.totalCost || 0)}</span>
                </div>
              </div>
              <div className="shrink-0">
                <Link
                  href={`/portal/lab/${t._id}`}
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