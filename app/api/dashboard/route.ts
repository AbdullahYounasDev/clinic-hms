import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Patient } from "@/models/clinical.model";
import { Appointment } from "@/models/clinical.model";
import { Doctor } from "@/models/clinical.model";
import { Invoice } from "@/models/operations.model";
import { LabTest } from "@/models/operations.model";
import { AuditLog } from "@/models/user.model";
import { User } from "@/models/user.model";
import { apiSuccess, apiError, startOfDay, endOfDay, startOfMonth, endOfMonth } from "@/lib/utils";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);

  await connectDB();
  const { getClinicTimezone, getClinicDayBounds, getClinicDateString, toClinicDateString } = await import("@/lib/time-utils");
  const tz = await getClinicTimezone();

  const now = new Date();
  const todayStr = getClinicDateString(now, tz);
  const { start: todayStart, end: todayEnd } = getClinicDayBounds(todayStr, tz);

  const [y, m] = todayStr.split("-");
  const monthStart = getClinicDayBounds(`${y}-${m}-01`, tz).start;
  const monthEnd = todayEnd;

  const chartStartDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const chartStartStr = getClinicDateString(chartStartDate, tz);
  const chartStart = getClinicDayBounds(chartStartStr, tz).start;

  const isSuperAdmin = session.user.isSuperAdmin;
  const perms = session.user.permissions || [];

  // Doctor scoping
  let doctorFilter = {};
  if (!isSuperAdmin && perms.includes("appointments:view")) {
    const { Doctor: DoctorModel } = await import("@/models/clinical.model");
    const doctor = await DoctorModel.findOne({ user: session.user.id }).lean();
    if (doctor) doctorFilter = { doctor: doctor._id };
  }

  const [
    totalPatients,
    todayAppointments,
    totalDoctors,
    pendingBills,
    labPending,
    recentActivities,
    appointmentsByStatus,
    monthlyRevenue,
    totalStaff,
    dailyRevenue,
  ] = await Promise.all([
    perms.includes("patients:view") || isSuperAdmin
      ? Patient.countDocuments({ status: "active" })
      : Promise.resolve(null),

    perms.includes("appointments:view") || isSuperAdmin
      ? Appointment.countDocuments({
        ...doctorFilter,
        scheduledDate: { $gte: todayStart, $lte: todayEnd },
        status: { $nin: ["cancelled", "no_show", "archived"] },
      })
      : Promise.resolve(null),

    perms.includes("doctors:view") || isSuperAdmin
      ? Doctor.countDocuments({ isAvailable: true, status: { $ne: "archived" } })
      : Promise.resolve(null),

    perms.includes("billing:view") || isSuperAdmin
      ? Invoice.countDocuments({ status: { $in: ["pending", "partial", "overdue"] } })
      : Promise.resolve(null),

    perms.includes("lab:view") || isSuperAdmin
      ? LabTest.countDocuments({ status: { $in: ["pending", "sample_collected", "processing"] } })
      : Promise.resolve(null),

    perms.includes("audit_logs:view") || isSuperAdmin
      ? AuditLog.find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("user", "firstName lastName")
        .lean()
      : Promise.resolve([]),

    perms.includes("appointments:view") || isSuperAdmin
      ? Appointment.aggregate([
        { $match: { ...doctorFilter, status: { $ne: "archived" } } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ])
      : Promise.resolve([]),

    // Monthly revenue — based on actual payment dates
    perms.includes("billing:view") || isSuperAdmin
      ? Invoice.aggregate([
        { $unwind: "$payments" },
        {
          $match: {
            "payments.paidAt": { $gte: monthStart, $lte: monthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$payments.amount" } } },
      ])
      : Promise.resolve([]),

    perms.includes("staff:view") || isSuperAdmin
      ? User.countDocuments({ status: "active" })
      : Promise.resolve(null),

    // Daily revenue for the chart with clinic timezone
    perms.includes("billing:view") || isSuperAdmin
      ? Invoice.aggregate([
        { $unwind: "$payments" },
        {
          $match: {
            "payments.paidAt": { $gte: chartStart, $lte: todayEnd },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$payments.paidAt", timezone: tz } },
            revenue: { $sum: "$payments.amount" },
          },
        },
      ])
      : Promise.resolve([]),
  ]);

  // Build appointment status map
  const statusMap = (appointmentsByStatus as { _id: string; count: number }[]).reduce(
    (acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    },
    {} as Record<string, number>
  );

  // Build a date -> revenue lookup from the aggregation result
  const revenueByDate = (dailyRevenue as { _id: string; revenue: number }[]).reduce(
    (acc, curr) => {
      acc[curr._id] = curr.revenue;
      return acc;
    },
    {} as Record<string, number>
  );

  // Revenue chart — last 7 days
  const revenueChart = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateKey = toClinicDateString(d, tz);

    revenueChart.push({
      date: dateKey,
      revenue: revenueByDate[dateKey] || 0,
      expenses: 0,
    });
  }

  return apiSuccess({
    totalPatients,
    todayAppointments,
    totalDoctors,
    pendingBills,
    labPending,
    totalStaff,
    monthlyRevenue: (monthlyRevenue as { total?: number }[])[0]?.total || 0,
    appointmentsByStatus: statusMap,
    recentActivities: recentActivities as Record<string, unknown>[],
    revenueChart,
  });
}