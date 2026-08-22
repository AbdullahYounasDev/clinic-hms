// components/audit-logs/audit-logs-client.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Filter, ChevronDown, X, Search, Globe, Shield, Eye, Clock, User as UserIcon, Monitor } from "lucide-react";
import {
  Card, Table, Th, Td, StatusBadge, Button,
  Input, Select, EmptyState, Pagination, Badge, Modal,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { useClinicSettings } from "@/components/providers/clinic-provider";

interface AuditLog {
  _id: string;
  user?: { firstName: string; lastName: string; email: string; employeeId: string; role?: { name: string; slug: string }; isPatient?: boolean };
  action: string; module: string; description: string;
  resourceId?: string; resourceType?: string;
  previousData?: Record<string, unknown>; newData?: Record<string, unknown>;
  ipAddress?: string; userAgent?: string; status: string; createdAt: string;
}

const ACTION_COLORS: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  login: "success", logout: "default", login_failed: "danger",
  create: "info", update: "warning", delete: "danger",
  view: "default", export: "info", approve: "success",
  password_reset: "warning", role_change: "warning",
};

export function AuditLogsClient() {
  const { formatDateTime } = useClinicSettings();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isPortalOnly, setIsPortalOnly] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewLog, setViewLog] = useState<AuditLog | null>(null);

  const activeFiltersCount = [actionFilter, moduleFilter, statusFilter, isPortalOnly, from, to, search].filter(Boolean).length;

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page, search, actionFilter, moduleFilter, statusFilter, isPortalOnly, from, to],
    queryFn: () => axios.get("/api/audit-logs", {
      params: {
        page, limit: 25, search: search || undefined,
        action: actionFilter || undefined, module: moduleFilter || undefined,
        status: statusFilter || undefined, isPortal: isPortalOnly || undefined,
        from: from || undefined, to: to || undefined,
      },
    }).then(r => r.data),
  });

  const logs: AuditLog[] = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Audit Logs</h1>
          <p className="text-xs text-gray-500 mt-0.5">Complete record of system and patient portal actions</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg self-start sm:self-auto">
          <button
            onClick={() => { setIsPortalOnly(false); setPage(1); }}
            className={cn("px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all flex items-center gap-1.5", !isPortalOnly ? "bg-white text-gray-900 shadow-sm font-semibold" : "text-gray-500 hover:text-gray-700")}
          >
            <Shield className="w-3.5 h-3.5 text-teal-600" /> All System Logs
          </button>
          <button
            onClick={() => { setIsPortalOnly(true); setPage(1); }}
            className={cn("px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all flex items-center gap-1.5", isPortalOnly ? "bg-teal-600 text-white shadow-sm font-semibold" : "text-gray-500 hover:text-gray-700")}
          >
            <Globe className={cn("w-3.5 h-3.5", isPortalOnly ? "text-white" : "text-teal-600")} /> Patient Portal Logs
          </button>
        </div>
      </div>

      {/* Search & Date Range + Filter Toggle */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <Input
            placeholder="Search audit descriptions, IP addresses..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="flex-1" />
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="flex-1" />
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer shrink-0",
              filtersOpen || activeFiltersCount > 0 ? "bg-teal-600 text-white border-teal-600" : "bg-white border-gray-300 text-gray-600"
            )}
          >
            <Filter className="w-3.5 h-3.5" /> Filters
            {activeFiltersCount > 0 && <span className="bg-white text-teal-600 text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-semibold">{activeFiltersCount}</span>}
            <ChevronDown className={cn("w-3 h-3", filtersOpen && "rotate-180")} />
          </button>
        </div>
      </div>

      {/* Active Filter Chips */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {search && <Chip label={`Search: "${search}"`} onClear={() => { setSearch(""); setPage(1); }} />}
          {isPortalOnly && <Chip label="Patient Portal Only" onClear={() => { setIsPortalOnly(false); setPage(1); }} />}
          {actionFilter && <Chip label={actionFilter.replace(/_/g, " ")} onClear={() => { setActionFilter(""); setPage(1); }} />}
          {moduleFilter && <Chip label={moduleFilter.replace(/_/g, " ")} onClear={() => { setModuleFilter(""); setPage(1); }} />}
          {statusFilter && <Chip label={statusFilter} onClear={() => { setStatusFilter(""); setPage(1); }} />}
          <button onClick={() => { setSearch(""); setIsPortalOnly(false); setActionFilter(""); setModuleFilter(""); setStatusFilter(""); setFrom(""); setTo(""); setPage(1); }} className="text-xs text-gray-400 cursor-pointer">Clear all</button>
        </div>
      )}

      {/* Expanded Filters */}
      {filtersOpen && (
        <div className="bg-gray-50 rounded-lg border border-gray-300 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1.5">Action</label><Select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}><option value="">All Actions</option>{["login","logout","login_failed","create","update","delete","view","export","approve","password_reset"].map(a => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}</Select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1.5">Module</label><Select value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); setPage(1); }}><option value="">All Modules</option>{["auth","patients","appointments","billing","lab","pharmacy","users","roles","expenses","ai_assistant","settings","inventory","developer_reports","patient_portal","portal_appointments"].map(m => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}</Select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1.5">Result</label><Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}><option value="">All Results</option><option value="success">Success</option><option value="failure">Failure</option></Select></div>
          </div>
        </div>
      )}

      {/* Desktop Table */}
      <Card className="hidden md:block overflow-x-auto">
        <Table>
          <thead>
            <tr><Th>Timestamp</Th><Th>User / Patient</Th><Th>Action</Th><Th>Module</Th><Th>Description</Th><Th>IP</Th><Th>Result</Th><Th className="text-right">Actions</Th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(10)].map((_, i) => <tr key={i}>{[...Array(8)].map((_, j) => <Td key={j}><div className="h-4 bg-gray-100 rounded" /></Td>)}</tr>)
            ) : logs.length === 0 ? (
              <tr><td colSpan={8}><EmptyState title="No audit logs found" description="Try adjusting your filters." /></td></tr>
            ) : (
              logs.map(log => {
                const isPortalLog = log.module.includes("portal") || (log.user as any)?.isPatient;
                const userFullName = log.user ? `${log.user.firstName || ""} ${log.user.lastName || ""}`.trim() : "";
                const userName = userFullName || (isPortalLog ? "Patient Account" : "System Automations");
                const idCode = log.user?.employeeId || (isPortalLog && log.resourceId ? log.resourceId : null);
                const roleName = log.user?.role?.name || (isPortalLog ? "Patient Portal" : null);

                return (
                  <tr key={log._id}>
                    <Td className="text-gray-500 whitespace-nowrap">{formatDateTime(log.createdAt)}</Td>
                    <Td>
                      <div className="space-y-0.5">
                        <div className="font-semibold text-gray-900 flex items-center gap-1.5 flex-wrap">
                          <span>{userName}</span>
                          {roleName && (
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 capitalize",
                              isPortalLog ? "bg-teal-50 border-teal-200 text-teal-700" : "bg-purple-50 border-purple-200 text-purple-700"
                            )}>
                              {roleName}
                            </span>
                          )}
                        </div>
                        {idCode && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400 font-medium">{isPortalLog ? "Patient ID:" : "ID:"}</span>
                            <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-mono border border-gray-200 font-medium">
                              {idCode}
                            </span>
                          </div>
                        )}
                      </div>
                    </Td>
                    <Td><Badge variant={ACTION_COLORS[log.action] || "default"}>{log.action.replace(/_/g, " ")}</Badge></Td>
                    <Td className="text-gray-500 capitalize">{log.module.replace(/_/g, " ")}</Td>
                    <Td className="text-gray-600 max-w-[220px] truncate">{log.description}</Td>
                    <Td className="text-gray-400 font-mono text-[11px]">{log.ipAddress || "—"}</Td>
                    <Td><StatusBadge status={log.status} /></Td>
                    <Td className="text-right">
                      <Button
                        size="sm"
                        onClick={() => setViewLog(log)}
                      >
                        View
                      </Button>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
        {pagination && pagination.totalPages > 1 && <div className="px-4 py-3 border-t border-gray-300 flex justify-end"><Pagination page={page} totalPages={pagination.totalPages} onPage={setPage} /></div>}
      </Card>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-gray-100 border border-gray-300 rounded-lg bg-white">
        {isLoading ? (
          [...Array(5)].map((_, i) => <div key={i} className="p-3 space-y-2"><div className="h-4 bg-gray-100 rounded w-3/4" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>)
        ) : logs.length === 0 ? (
          <EmptyState title="No audit logs found" description="Try adjusting your filters." />
        ) : (
          logs.map(log => {
            const isPortalLog = log.module.includes("portal") || (log.user as any)?.isPatient;
            const userFullName = log.user ? `${log.user.firstName || ""} ${log.user.lastName || ""}`.trim() : "";
            const userName = userFullName || (isPortalLog ? "Patient Account" : "System Automations");
            const idCode = log.user?.employeeId || (isPortalLog && log.resourceId ? log.resourceId : null);
            const roleName = log.user?.role?.name || (isPortalLog ? "Patient Portal" : null);

            return (
              <div key={log._id} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant={ACTION_COLORS[log.action] || "default"}>{log.action.replace(/_/g, " ")}</Badge>
                    <StatusBadge status={log.status} />
                    {roleName && (
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 capitalize",
                        isPortalLog ? "bg-teal-50 border-teal-200 text-teal-700" : "bg-purple-50 border-purple-200 text-purple-700"
                      )}>
                        {roleName}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setViewLog(log)}
                  >
                    View
                  </Button>
                </div>
                <p className="text-xs text-gray-700 font-medium line-clamp-2 leading-relaxed">{log.description}</p>
                <div className="flex items-center justify-between text-xs text-gray-400 pt-1 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 truncate max-w-[65%]">
                    <span className="font-semibold text-gray-800 truncate">{userName}</span>
                    {idCode && <span className="bg-gray-100 text-gray-600 px-1 py-0.2 rounded text-[10px] font-mono border shrink-0">{idCode}</span>}
                  </div>
                  <span className="text-[11px] shrink-0">{formatDateTime(log.createdAt)}</span>
                </div>
              </div>
            );
          })
        )}
        {pagination && pagination.totalPages > 1 && <div className="px-4 py-3 flex justify-center"><Pagination page={page} totalPages={pagination.totalPages} onPage={setPage} /></div>}
      </div>

      {/* Audit Detail Modal */}
      <Modal
        open={!!viewLog}
        onClose={() => setViewLog(null)}
        title="Audit Log Entry Details"
        size="lg"
      >
        {viewLog && (
          <div className="space-y-4 text-xs">
            {/* Header info */}
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={ACTION_COLORS[viewLog.action] || "default"}>{viewLog.action.replace(/_/g, " ")}</Badge>
                <span className="text-gray-500 font-medium capitalize">• {viewLog.module.replace(/_/g, " ")}</span>
              </div>
              <StatusBadge status={viewLog.status} />
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-lg border border-gray-200">
              <div>
                <span className="text-gray-400 font-medium block mb-0.5">Timestamp</span>
                <span className="text-gray-900 font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-600" /> {formatDateTime(viewLog.createdAt)}
                </span>
              </div>
              <div>
                <span className="text-gray-400 font-medium block mb-0.5">User / Patient Details</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <UserIcon className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span className="text-gray-900 font-semibold">
                    {viewLog.user?.firstName || viewLog.user?.lastName
                      ? `${viewLog.user.firstName || ""} ${viewLog.user.lastName || ""}`.trim()
                      : viewLog.module.includes("portal") || (viewLog.user as any)?.isPatient
                      ? "Patient Account"
                      : "System Automations"}
                  </span>
                  {viewLog.user?.role?.name && (
                    <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-[10px] border border-purple-200 font-medium">
                      {viewLog.user.role.name}
                    </span>
                  )}
                  {viewLog.user?.employeeId && (
                    <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-mono border font-medium">
                      {viewLog.user.employeeId}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-gray-400 font-medium block mb-0.5">IP Address</span>
                <span className="text-gray-900 font-mono flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-gray-500" /> {viewLog.ipAddress || "Internal / Local"}
                </span>
              </div>
              <div>
                <span className="text-gray-400 font-medium block mb-0.5">Resource ID / Type</span>
                <span className="text-gray-900 font-mono">
                  {viewLog.resourceId ? `${viewLog.resourceType || 'Resource'}: ${viewLog.resourceId}` : "—"}
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <span className="text-gray-500 font-medium block mb-1">Full Description</span>
              <p className="text-gray-900 font-medium whitespace-pre-wrap leading-relaxed">
                {viewLog.description}
              </p>
            </div>

            {/* Previous Data / New Data JSON Viewers */}
            {(viewLog.previousData || viewLog.newData) && (
              <div className="space-y-2">
                {viewLog.previousData && Object.keys(viewLog.previousData).length > 0 && (
                  <div>
                    <span className="text-gray-500 font-medium block mb-1">Previous State Data</span>
                    <pre className="bg-red-50 text-red-800 p-2.5 rounded-lg border border-red-200 overflow-x-auto text-[11px] font-mono max-h-36">
                      {JSON.stringify(viewLog.previousData, null, 2)}
                    </pre>
                  </div>
                )}
                {viewLog.newData && Object.keys(viewLog.newData).length > 0 && (
                  <div>
                    <span className="text-gray-500 font-medium block mb-1">New State Data</span>
                    <pre className="bg-emerald-50 text-emerald-800 p-2.5 rounded-lg border border-emerald-200 overflow-x-auto text-[11px] font-mono max-h-36">
                      {JSON.stringify(viewLog.newData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* User Agent */}
            {viewLog.userAgent && (
              <div className="pt-2 border-t border-gray-200 text-[10px] text-gray-400 truncate">
                User-Agent: {viewLog.userAgent}
              </div>
            )}

            {/* Footer Close */}
            <div className="flex justify-end pt-2 border-t border-gray-200">
              <Button variant="secondary" size="sm" onClick={() => setViewLog(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-700 capitalize">
      {label}
      <button onClick={onClear} className="cursor-pointer"><X className="w-3 h-3" /></button>
    </span>
  );
}