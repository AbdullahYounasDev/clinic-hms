// app/api/reports/route.ts
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Invoice, Expense } from "@/models/operations.model";
import { Patient, Appointment } from "@/models/clinical.model";
import { apiSuccess, apiError } from "@/lib/utils";
import { hasPermission } from "@/lib/auth/audit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "reports", "view")) return apiError("Forbidden", 403);

  await connectDB();
  const { getClinicTimezone, getClinicDayBounds, getClinicDateString } = await import("@/lib/time-utils");
  const tz = await getClinicTimezone();

  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") || "summary";
  const period = sp.get("period") || "monthly";

  const fromStr = sp.get("from");
  const toStr = sp.get("to");

  let from: Date;
  let to: Date;

  if (fromStr) {
    from = getClinicDayBounds(fromStr, tz).start;
  } else {
    const todayStr = getClinicDateString(new Date(), tz);
    const [y, m] = todayStr.split("-");
    from = getClinicDayBounds(`${y}-${m}-01`, tz).start;
  }

  if (toStr) {
    to = getClinicDayBounds(toStr, tz).end;
  } else {
    const todayStr = getClinicDateString(new Date(), tz);
    to = getClinicDayBounds(todayStr, tz).end;
  }

  // Helper to format display label
  const formatDisplayLabel = (d: Date) => {
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  };

  // ============================================================
  // 1. REVENUE OVER TIME (Daily/Monthly)
  // ============================================================
  if (type === "revenue") {
    const format = period === "daily" ? "%Y-%m-%d" : period === "monthly" ? "%Y-%m" : period === "yearly" ? "%Y" : "%Y-%m-%d";

    const data = await Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $in: ["paid", "partial"] },
          paidAmount: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format, date: "$createdAt", timezone: tz } },
          revenue: { $sum: "$paidAmount" },
          count: { $sum: 1 },
          avgTicket: { $avg: "$paidAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return apiSuccess(data);
  }

  // ============================================================
  // 2. REVENUE BY CATEGORY
  // ============================================================
  if (type === "revenue-by-category") {
    const data = await Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $in: ["paid", "partial"] },
        },
      },
      {
        $group: {
          _id: "$invoiceType",
          total: { $sum: "$paidAmount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    return apiSuccess(data);
  }

  // ============================================================
  // 3. EXPENSES OVER TIME
  // ============================================================
  if (type === "expenses") {
    const format = period === "daily" ? "%Y-%m-%d" : period === "monthly" ? "%Y-%m" : period === "yearly" ? "%Y" : "%Y-%m-%d";

    const data = await Expense.aggregate([
      {
        $match: {
          date: { $gte: from, $lte: to },
          status: "approved",
        },
      },
      {
        $group: {
          _id: { $dateToString: { format, date: "$date", timezone: tz } },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return apiSuccess(data);
  }

  // ============================================================
  // 4. EXPENSES BY CATEGORY
  // ============================================================
  if (type === "expenses-by-category") {
    const data = await Expense.aggregate([
      {
        $match: {
          date: { $gte: from, $lte: to },
          status: "approved",
        },
      },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    return apiSuccess(data);
  }

  // ============================================================
  // 5. DAILY CASH FLOW
  // ============================================================
  if (type === "cash-flow") {
    const format = period === "daily" ? "%Y-%m-%d" : period === "monthly" ? "%Y-%m" : "%Y-%m-%d";

    const [revenueData, expenseData] = await Promise.all([
      Invoice.aggregate([
        {
          $match: {
            createdAt: { $gte: from, $lte: to },
            status: { $in: ["paid", "partial"] },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format, date: "$createdAt", timezone: tz } },
            revenue: { $sum: "$paidAmount" },
          },
        },
      ]),
      Expense.aggregate([
        {
          $match: {
            date: { $gte: from, $lte: to },
            status: "approved",
          },
        },
        {
          $group: {
            _id: { $dateToString: { format, date: "$date", timezone: tz } },
            expenses: { $sum: "$amount" },
          },
        },
      ]),
    ]);

    const revenueMap = new Map(revenueData.map(r => [r._id, r.revenue]));
    const expenseMap = new Map(expenseData.map(e => [e._id, e.expenses]));

    const allDates = new Set([...revenueMap.keys(), ...expenseMap.keys()]);
    const result = Array.from(allDates)
      .sort()
      .map(date => ({
        date,
        revenue: revenueMap.get(date) || 0,
        expenses: expenseMap.get(date) || 0,
        profit: (revenueMap.get(date) || 0) - (expenseMap.get(date) || 0),
      }));

    return apiSuccess(result);
  }

  // ============================================================
  // 6. SUMMARY REPORT
  // ============================================================
  if (type === "summary") {
    const periodDiff = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - periodDiff);
    const prevTo = new Date(to.getTime() - periodDiff);

    const [currentRevenue, currentExpenses, currentInvoices, currentPayments] = await Promise.all([
      Invoice.aggregate([
        {
          $match: {
            createdAt: { $gte: from, $lte: to },
            status: { $in: ["paid", "partial"] },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$paidAmount" },
            count: { $sum: 1 },
            avg: { $avg: "$paidAmount" },
          },
        },
      ]),
      Expense.aggregate([
        {
          $match: {
            date: { $gte: from, $lte: to },
            status: "approved",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Invoice.aggregate([
        {
          $match: {
            createdAt: { $gte: from, $lte: to },
            status: { $in: ["paid", "partial"] },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
          },
        },
      ]),
      Invoice.aggregate([
        {
          $match: {
            createdAt: { $gte: from, $lte: to },
            status: { $in: ["paid", "partial"] },
          },
        },
        {
          $unwind: "$payments",
        },
        {
          $match: {
            "payments.paidAt": { $gte: from, $lte: to },
          },
        },
        {
          $group: {
            _id: "$payments.method",
            total: { $sum: "$payments.amount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const [prevRevenue, prevExpenses] = await Promise.all([
      Invoice.aggregate([
        {
          $match: {
            createdAt: { $gte: prevFrom, $lte: prevTo },
            status: { $in: ["paid", "partial"] },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$paidAmount" },
          },
        },
      ]),
      Expense.aggregate([
        {
          $match: {
            date: { $gte: prevFrom, $lte: prevTo },
            status: "approved",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]),
    ]);

    const revenue = currentRevenue[0]?.total || 0;
    const prevRevenueTotal = prevRevenue[0]?.total || 0;
    const revenueChange = prevRevenueTotal > 0 ? ((revenue - prevRevenueTotal) / prevRevenueTotal) * 100 : 0;

    const expenses = currentExpenses[0]?.total || 0;
    const prevExpensesTotal = prevExpenses[0]?.total || 0;
    const expensesChange = prevExpensesTotal > 0 ? ((expenses - prevExpensesTotal) / prevExpensesTotal) * 100 : 0;

    const profit = revenue - expenses;
    const prevProfit = prevRevenueTotal - prevExpensesTotal;
    const profitChange = prevProfit !== 0 ? ((profit - prevProfit) / Math.abs(prevProfit)) * 100 : 0;

    const paymentMethods = currentPayments.map(p => ({
      method: p._id,
      total: p.total,
      count: p.count,
      percentage: revenue > 0 ? (p.total / revenue) * 100 : 0,
    }));

    const revenueByCategory = await Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $in: ["paid", "partial"] },
        },
      },
      {
        $group: {
          _id: "$invoiceType",
          total: { $sum: "$paidAmount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 5 },
    ]);

    const recentTransactions = await Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $in: ["paid", "partial"] },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "patients",
          localField: "patient",
          foreignField: "_id",
          as: "patient",
        },
      },
      {
        $project: {
          invoiceNumber: 1,
          paidAmount: 1,
          createdAt: 1,
          status: 1,
          patientName: 1,
          "patient.firstName": 1,
          "patient.lastName": 1,
        },
      },
    ]);

    return apiSuccess({
      period: {
        from,
        to,
        label: `${formatDisplayLabel(from)} - ${formatDisplayLabel(to)}`,
      },
      summary: {
        revenue,
        revenueChange,
        expenses,
        expensesChange,
        profit,
        profitChange,
        margin: revenue > 0 ? (profit / revenue) * 100 : 0,
        invoiceCount: currentInvoices[0]?.count || 0,
        averageTicket: currentRevenue[0]?.avg || 0,
        expenseCount: currentExpenses[0]?.count || 0,
      },
      paymentMethods,
      topCategories: revenueByCategory,
      recentTransactions,
    });
  }

  // ============================================================
  // 7. TOP PERFORMING
  // ============================================================
  if (type === "top") {
    const category = sp.get("category") || "patients";

    if (category === "doctors") {
      const data = await Invoice.aggregate([
        {
          $match: {
            createdAt: { $gte: from, $lte: to },
            status: { $in: ["paid", "partial"] },
            doctor: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: "$doctor",
            revenue: { $sum: "$paidAmount" },
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "doctor",
          },
        },
        { $unwind: "$doctor" },
        {
          $project: {
            name: { $concat: ["$doctor.firstName", " ", "$doctor.lastName"] },
            revenue: 1,
            count: 1,
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]);

      return apiSuccess(data);
    }

    if (category === "services") {
      const data = await Invoice.aggregate([
        {
          $match: {
            createdAt: { $gte: from, $lte: to },
            status: { $in: ["paid", "partial"] },
          },
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.category",
            revenue: { $sum: "$items.total" },
            count: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]);

      return apiSuccess(data);
    }

    const data = await Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $in: ["paid", "partial"] },
          patient: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$patient",
          revenue: { $sum: "$paidAmount" },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "patients",
          localField: "_id",
          foreignField: "_id",
          as: "patient",
        },
      },
      { $unwind: "$patient" },
      {
        $project: {
          name: { $concat: ["$patient.firstName", " ", "$patient.lastName"] },
          patientId: "$patient.patientId",
          revenue: 1,
          count: 1,
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]);

    return apiSuccess(data);
  }

  // ============================================================
  // 8. INVOICE STATUS BREAKDOWN
  // ============================================================
  if (type === "invoice-status") {
    const data = await Invoice.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$total" },
        },
      },
    ]);

    return apiSuccess(data);
  }

  // ============================================================
  // 9. PATIENTS REPORT SUMMARY
  // ============================================================
  if (type === "patients-report") {
    const format = period === "daily" ? "%Y-%m-%d" : "%Y-%m-%d";
    const [totalCount, genderCounts, trend, recentPatients] = await Promise.all([
      Patient.countDocuments({ createdAt: { $gte: from, $lte: to } }),
      Patient.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: "$gender", count: { $sum: 1 } } },
      ]),
      Patient.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: { $dateToString: { format, date: "$createdAt", timezone: tz } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Patient.find({ createdAt: { $gte: from, $lte: to } })
        .sort({ createdAt: -1 })
        .limit(20)
        .select("patientId firstName lastName gender phone bloodGroup status createdAt")
        .lean(),
    ]);

    return apiSuccess({
      totalCount,
      genderCounts,
      trend,
      recentPatients,
    });
  }

  // ============================================================
  // 10. APPOINTMENTS REPORT SUMMARY
  // ============================================================
  if (type === "appointments-report") {
    const [totalCount, statusCounts, typeCounts, recentAppointments] = await Promise.all([
      Appointment.countDocuments({ scheduledDate: { $gte: from, $lte: to }, status: { $ne: "archived" } }),
      Appointment.aggregate([
        { $match: { scheduledDate: { $gte: from, $lte: to }, status: { $ne: "archived" } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Appointment.aggregate([
        { $match: { scheduledDate: { $gte: from, $lte: to }, status: { $ne: "archived" } } },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      Appointment.find({ scheduledDate: { $gte: from, $lte: to }, status: { $ne: "archived" } })
        .sort({ scheduledDate: -1 })
        .limit(20)
        .populate("patient", "firstName lastName patientId")
        .populate({ path: "doctor", populate: { path: "user", select: "firstName lastName" } })
        .lean(),
    ]);

    return apiSuccess({
      totalCount,
      statusCounts,
      typeCounts,
      recentAppointments,
    });
  }

  // ============================================================
  // 11. EXPENSES REPORT SUMMARY
  // ============================================================
  if (type === "expenses-report") {
    const [totalStats, categoryStats, recentExpenses] = await Promise.all([
      Expense.aggregate([
        { $match: { date: { $gte: from, $lte: to }, status: "approved" } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 }, avgAmount: { $avg: "$amount" } } },
      ]),
      Expense.aggregate([
        { $match: { date: { $gte: from, $lte: to }, status: "approved" } },
        { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      Expense.find({ date: { $gte: from, $lte: to }, status: "approved" })
        .sort({ date: -1 })
        .limit(20)
        .populate("createdBy", "firstName lastName")
        .lean(),
    ]);

    return apiSuccess({
      totalAmount: totalStats[0]?.totalAmount || 0,
      count: totalStats[0]?.count || 0,
      avgAmount: totalStats[0]?.avgAmount || 0,
      categoryStats,
      recentExpenses,
    });
  }

  return apiError("Invalid report type", 400);
}