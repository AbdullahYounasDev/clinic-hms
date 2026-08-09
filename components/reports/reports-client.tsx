// components/reports/reports-client.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area, Legend,
} from "recharts";
import {
  Card, CardBody, StatCard, Button, Input, Skeleton, Alert, Badge
} from "@/components/ui";
import { cn, formatCurrency, formatDate, formatTime12Hour } from "@/lib/utils";
import { toClinicDateString } from "@/lib/time-utils";
import { useClinicSettings } from "@/components/providers/clinic-provider";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  DollarSign, TrendingDown, Wallet, TrendingUp,
  Receipt, PieChart as PieChartIcon, BarChart3, Download, Loader2,
  Users, Calendar, CreditCard, UserCheck, Activity, Tag, FileText, CheckCircle2, XCircle, Clock
} from "lucide-react";

const COLORS = ["#0d9488", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6", "#6366f1"];

type ReportType = "revenue" | "patients" | "appointments" | "expenses";

interface TopCategory {
  _id: string;
  total: number;
  count: number;
}

interface SummaryData {
  period: { from: string; to: string; label: string };
  summary: {
    revenue: number;
    revenueChange: number;
    expenses: number;
    expensesChange: number;
    profit: number;
    profitChange: number;
    margin: number;
    invoiceCount: number;
    averageTicket: number;
    expenseCount: number;
  };
  paymentMethods: { method: string; total: number; count: number; percentage: number }[];
  topCategories: TopCategory[];
  recentTransactions: any[];
}

export function ReportsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const isSA = session?.user.isSuperAdmin;
  const perms = session?.user.permissions || [];
  const canExport = isSA || perms.includes("reports:export");

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const initialFrom = searchParams.get("from") || toClinicDateString(firstOfMonth);
  const initialTo = searchParams.get("to") || toClinicDateString(today);
  const initialTab = (searchParams.get("type") as ReportType) || "revenue";

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [activeTab, setActiveTab] = useState<ReportType>(initialTab);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const urlFrom = searchParams.get("from");
    const urlTo = searchParams.get("to");
    const urlType = searchParams.get("type") as ReportType;
    if (urlFrom && urlFrom !== from) setFrom(urlFrom);
    if (urlTo && urlTo !== to) setTo(urlTo);
    if (urlType && ["revenue", "patients", "appointments", "expenses"].includes(urlType) && urlType !== activeTab) {
      setActiveTab(urlType);
    }
  }, [searchParams]);

  // Sync state to URL search parameters cleanly
  const updateUrl = useCallback((newFrom: string, newTo: string, newTab: ReportType) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", newFrom);
    params.set("to", newTo);
    params.set("type", newTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleTabChange = (tab: ReportType) => {
    setActiveTab(tab);
    updateUrl(from, to, tab);
  };

  const handleFromChange = (val: string) => {
    setFrom(val);
    updateUrl(val, to, activeTab);
  };

  const handleToChange = (val: string) => {
    setTo(val);
    updateUrl(from, val, activeTab);
  };

  // Queries for different report modes
  const { data: summaryData, isLoading: summaryLoading, isError: summaryError } = useQuery({
    queryKey: ["report-summary", from, to],
    queryFn: () => axios.get("/api/reports", { params: { type: "summary", from, to } }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
    enabled: activeTab === "revenue",
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ["report-revenue", from, to],
    queryFn: () => axios.get("/api/reports", { params: { type: "revenue", from, to, period: "daily" } }).then(r => r.data),
    enabled: activeTab === "revenue",
  });

  const { data: cashFlowData, isLoading: cashFlowLoading } = useQuery({
    queryKey: ["report-cashflow", from, to],
    queryFn: () => axios.get("/api/reports", { params: { type: "cash-flow", from, to, period: "daily" } }).then(r => r.data),
    enabled: activeTab === "revenue",
  });

  const { data: topCategoriesData } = useQuery<{ data: TopCategory[] }>({
    queryKey: ["report-top-categories", from, to],
    queryFn: () => axios.get("/api/reports", { params: { type: "revenue-by-category", from, to } }).then(r => r.data),
    enabled: activeTab === "revenue",
  });

  // Patients Report Query
  const { data: patientsReportData, isLoading: patientsLoading } = useQuery({
    queryKey: ["report-patients", from, to],
    queryFn: () => axios.get("/api/reports", { params: { type: "patients-report", from, to } }).then(r => r.data),
    enabled: activeTab === "patients",
  });

  // Appointments Report Query
  const { data: appointmentsReportData, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["report-appointments", from, to],
    queryFn: () => axios.get("/api/reports", { params: { type: "appointments-report", from, to } }).then(r => r.data),
    enabled: activeTab === "appointments",
  });

  // Expenses Report Query
  const { data: expensesReportData, isLoading: expensesLoading } = useQuery({
    queryKey: ["report-expenses", from, to],
    queryFn: () => axios.get("/api/reports", { params: { type: "expenses-report", from, to } }).then(r => r.data),
    enabled: activeTab === "expenses",
  });

  const summary: SummaryData = summaryData?.data;
  const revenueChart = revenueData?.data || [];
  const cashFlow = cashFlowData?.data || [];
  const topCategories: TopCategory[] = topCategoriesData?.data || [];

  const patientsData = patientsReportData?.data;
  const appointmentsData = appointmentsReportData?.data;
  const expensesData = expensesReportData?.data;

  const handleExport = async () => {
    if (!canExport) {
      toast.error("Forbidden — export permission required");
      return;
    }
    try {
      setExporting(true);
      const res = await axios.get("/api/reports/export", {
        params: { type: activeTab, format: "csv", from, to },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv;charset=utf-8;" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${activeTab}-report-${from}-to-${to}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${activeTab.toUpperCase()} report downloaded successfully!`);
    } catch {
      toast.error("Failed to export report");
    } finally {
      setExporting(false);
    }
  };

  const quickRanges = [
    { label: "Today", days: 0 },
    { label: "This Week", days: 7 },
    { label: "This Month", days: 30 },
    { label: "3 Months", days: 90 },
    { label: "This Year", days: 365 },
  ];

  const setQuickRange = (days: number) => {
    const t = new Date();
    let newFrom: string;
    const newTo = toClinicDateString(t);

    if (days === 0) {
      newFrom = newTo;
    } else {
      const d = new Date(t);
      d.setDate(d.getDate() - days);
      newFrom = toClinicDateString(d);
    }
    setFrom(newFrom);
    setTo(newTo);
    updateUrl(newFrom, newTo, activeTab);
  };

  if (summaryError) {
    return (
      <div className="p-4">
        <Alert type="error">Failed to load report data. Please try again.</Alert>
      </div>
    );
  }

  const tabs: { id: ReportType; label: string; icon: any; description: string }[] = [
    { id: "revenue", label: "Financial Overview", icon: DollarSign, description: "Revenue, expenses & cash flow" },
    { id: "patients", label: "Patients Register", icon: Users, description: "Patient registrations & demographics" },
    { id: "appointments", label: "Appointments", icon: Calendar, description: "Appointments status & breakdown" },
    { id: "expenses", label: "Expenses Register", icon: Receipt, description: "Expenditure breakdown & categories" },
  ];

  const currentTab = tabs.find(t => t.id === activeTab) || tabs[0];
  const CurrentIcon = currentTab.icon;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CurrentIcon className="w-5 h-5 text-teal-600" />
            {currentTab.label}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">{currentTab.description}</p>
        </div>
        {canExport && (
          <Button variant="primary" size="sm" onClick={handleExport} disabled={exporting} className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm">
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export {activeTab.toUpperCase()} CSV
          </Button>
        )}
      </div>

      {/* Mode Switcher Tabs */}
      <div className="bg-gray-100/80 p-1 rounded-xl flex flex-wrap sm:flex-nowrap gap-1 border border-gray-200/60 shadow-inner">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${isActive
                  ? "bg-white text-teal-800 shadow-sm border border-gray-200 font-semibold"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
                }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-teal-600" : "text-gray-400"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Date Range Filters */}
      <Card>
        <CardBody>
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-700">Date Range:</span>
              <Input
                type="date"
                value={from}
                onChange={e => handleFromChange(e.target.value)}
                className="w-36 text-xs"
              />
              <span className="text-xs text-gray-400">to</span>
              <Input
                type="date"
                value={to}
                onChange={e => handleToChange(e.target.value)}
                className="w-36 text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {quickRanges.map(range => (
                <button
                  key={range.label}
                  onClick={() => setQuickRange(range.days)}
                  className="px-3 py-1 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* TAB 1: FINANCIAL OVERVIEW */}
      {activeTab === "revenue" && (
        <>
          {summaryLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
            </div>
          ) : summary?.summary ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard title="Revenue" value={formatCurrency(summary.summary.revenue)} icon={DollarSign} loading={false} />
              <StatCard title="Expenses" value={formatCurrency(summary.summary.expenses)} icon={TrendingDown} loading={false} />
              <StatCard title="Net Profit" value={formatCurrency(summary.summary.profit)} icon={Wallet} loading={false} />
              <StatCard title="Profit Margin" value={`${summary.summary.margin.toFixed(1)}%`} icon={TrendingUp} loading={false} />
            </div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardBody>
                <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-teal-600" />
                  Revenue Trend
                </h3>
                {revenueLoading ? (
                  <Skeleton className="h-52 w-full" />
                ) : revenueChart.length === 0 ? (
                  <div className="h-52 flex items-center justify-center text-xs text-gray-400">
                    No revenue data for this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={revenueChart}>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="_id" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(v: any) => formatCurrency(Number(v || 0))}
                        contentStyle={{ borderRadius: 8, border: "1px solid #d1d5db", fontSize: 11 }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#0d9488" fill="url(#revenueGradient)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-teal-600" />
                  Cash Flow
                </h3>
                {cashFlowLoading ? (
                  <Skeleton className="h-52 w-full" />
                ) : cashFlow.length === 0 ? (
                  <div className="h-52 flex items-center justify-center text-xs text-gray-400">
                    No cash flow data for this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={cashFlow}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(v: any, name: any) => [formatCurrency(Number(v || 0)), name === "profit" ? "Profit" : String(name || "").charAt(0).toUpperCase() + String(name || "").slice(1)]}
                        contentStyle={{ borderRadius: 8, border: "1px solid #d1d5db", fontSize: 11 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="revenue" fill="#0d9488" radius={[4, 4, 0, 0]} name="Revenue" />
                      <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expenses" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {summary?.paymentMethods && summary.paymentMethods.length > 0 && (
              <Card>
                <CardBody>
                  <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-teal-600" />
                    Payment Methods
                  </h3>
                  <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="w-full md:w-1/2 max-w-[220px] mx-auto">
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={summary.paymentMethods}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            dataKey="total"
                            nameKey="method"
                            label={({ percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {summary.paymentMethods.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v: any) => formatCurrency(Number(v || 0))}
                            contentStyle={{ borderRadius: 8, fontSize: 11 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {summary.paymentMethods.map((item, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-xs text-gray-500 capitalize">{item.method.replace(/_/g, " ")}</span>
                          <span className="text-xs font-medium text-gray-700">{formatCurrency(item.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}

            {topCategories.length > 0 && (
              <Card>
                <CardBody>
                  <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-teal-600" />
                    Top Revenue Sources
                  </h3>
                  <div className="space-y-2">
                    {topCategories.map((cat: TopCategory, i: number) => {
                      const total = topCategories.reduce((sum: number, c: TopCategory) => sum + c.total, 0);
                      const percentage = total > 0 ? (cat.total / total) * 100 : 0;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs text-gray-600 capitalize">{cat._id?.replace(/_/g, " ") || "Other"}</span>
                            <span className="text-xs font-medium text-gray-700">{formatCurrency(cat.total)}</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${percentage}%`, backgroundColor: COLORS[i % COLORS.length] }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        </>
      )}

      {/* TAB 2: PATIENTS REGISTER */}
      {activeTab === "patients" && (
        <>
          {patientsLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard title="Total Registered" value={String(patientsData?.totalCount || 0)} icon={Users} loading={false} />
              <StatCard
                title="Male Patients"
                value={String(patientsData?.genderCounts?.find((g: any) => g._id === "male")?.count || 0)}
                icon={UserCheck}
                loading={false}
              />
              <StatCard
                title="Female Patients"
                value={String(patientsData?.genderCounts?.find((g: any) => g._id === "female")?.count || 0)}
                icon={UserCheck}
                loading={false}
              />
              <StatCard title="Active Status" value={`${patientsData?.recentPatients?.length || 0} Listed`} icon={Activity} loading={false} />
            </div>
          )}

          <Card>
            <CardBody>
              <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600" />
                Registered Patients List ({from} to {to})
              </h3>
              {patientsLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : !patientsData?.recentPatients || patientsData.recentPatients.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">No patients registered during this period</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/50 text-gray-500 font-medium">
                        <th className="py-2.5 px-3">Patient ID</th>
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Gender</th>
                        <th className="py-2.5 px-3">Phone</th>
                        <th className="py-2.5 px-3">Blood Group</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Registered Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {patientsData.recentPatients.map((p: any) => (
                        <tr key={p._id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-medium text-teal-700">{p.patientId || "—"}</td>
                          <td className="py-2.5 px-3 font-medium text-gray-900">{p.firstName} {p.lastName}</td>
                          <td className="py-2.5 px-3 capitalize">{p.gender || "—"}</td>
                          <td className="py-2.5 px-3 font-mono">{p.phone || "—"}</td>
                          <td className="py-2.5 px-3"><Badge variant="outline">{p.bloodGroup || "N/A"}</Badge></td>
                          <td className="py-2.5 px-3"><Badge variant="success">{p.status}</Badge></td>
                          <td className="py-2.5 px-3 text-gray-500">{formatDate(p.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {/* TAB 3: APPOINTMENTS */}
      {activeTab === "appointments" && (
        <>
          {appointmentsLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard title="Total Appointments" value={String(appointmentsData?.totalCount || 0)} icon={Calendar} loading={false} />
              <StatCard
                title="Completed"
                value={String(appointmentsData?.statusCounts?.find((s: any) => s._id === "completed")?.count || 0)}
                icon={CheckCircle2}
                loading={false}
              />
              <StatCard
                title="Scheduled / Pending"
                value={String(appointmentsData?.statusCounts?.find((s: any) => s._id === "scheduled")?.count || 0)}
                icon={Clock}
                loading={false}
              />
              <StatCard
                title="Cancelled"
                value={String(appointmentsData?.statusCounts?.find((s: any) => s._id === "cancelled")?.count || 0)}
                icon={XCircle}
                loading={false}
              />
            </div>
          )}

          <Card>
            <CardBody>
              <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-600" />
                Appointments List ({from} to {to})
              </h3>
              {appointmentsLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : !appointmentsData?.recentAppointments || appointmentsData.recentAppointments.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">No appointments found for this period</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/50 text-gray-500 font-medium">
                        <th className="py-2.5 px-3">Date & Time</th>
                        <th className="py-2.5 px-3">Patient</th>
                        <th className="py-2.5 px-3">Doctor</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Fee</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {appointmentsData.recentAppointments.map((a: any) => {
                        const pat = a.patient;
                        const doc = a.doctor?.user;
                        return (
                          <tr key={a._id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-2.5 px-3 text-gray-900 font-medium">
                              {formatDate(a.scheduledDate)} {a.scheduledTime ? formatTime12Hour(a.scheduledTime) : ""}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-gray-900">
                              {pat ? `${pat.firstName || ""} ${pat.lastName || ""}` : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-gray-700">
                              {doc ? `Dr. ${doc.firstName || ""} ${doc.lastName || ""}` : "—"}
                            </td>
                            <td className="py-2.5 px-3 capitalize">{a.type || "consultation"}</td>
                            <td className="py-2.5 px-3">
                              <Badge variant={a.status === "completed" ? "success" : a.status === "cancelled" ? "danger" : "warning"}>
                                {a.status}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-medium">{formatCurrency(a.consultationFee || 0)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {/* TAB 4: EXPENSES REGISTER */}
      {activeTab === "expenses" && (
        <>
          {expensesLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard title="Total Expenses" value={formatCurrency(expensesData?.totalAmount || 0)} icon={Receipt} loading={false} />
              <StatCard title="Total Entries" value={String(expensesData?.count || 0)} icon={Tag} loading={false} />
              <StatCard title="Average Ticket" value={formatCurrency(expensesData?.avgAmount || 0)} icon={CreditCard} loading={false} />
              <StatCard
                title="Top Category"
                value={expensesData?.categoryStats?.[0]?._id?.replace(/_/g, " ") || "N/A"}
                icon={TrendingDown}
                loading={false}
              />
            </div>
          )}

          <Card>
            <CardBody>
              <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-teal-600" />
                Expenses Register ({from} to {to})
              </h3>
              {expensesLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : !expensesData?.recentExpenses || expensesData.recentExpenses.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">No expenses recorded for this period</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/50 text-gray-500 font-medium">
                        <th className="py-2.5 px-3">Title</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Payment Method</th>
                        <th className="py-2.5 px-3">Vendor</th>
                        <th className="py-2.5 px-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {expensesData.recentExpenses.map((e: any) => (
                        <tr key={e._id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-gray-900">{e.title}</td>
                          <td className="py-2.5 px-3 capitalize"><Badge variant="outline">{e.category?.replace(/_/g, " ")}</Badge></td>
                          <td className="py-2.5 px-3 font-mono font-medium text-red-600">{formatCurrency(e.amount || 0)}</td>
                          <td className="py-2.5 px-3 capitalize">{e.paymentMethod?.replace(/_/g, " ") || "—"}</td>
                          <td className="py-2.5 px-3">{e.vendor || "—"}</td>
                          <td className="py-2.5 px-3 text-gray-500">{formatDate(e.date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}