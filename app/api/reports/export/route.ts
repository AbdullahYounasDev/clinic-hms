import { auditLog } from "@/lib/auth/audit";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { apiError, hasPermission } from "@/lib/utils";
import { Appointment, Patient } from "@/models/clinical.model";
import { Expense, Invoice } from "@/models/operations.model";
import { NextRequest, NextResponse } from "next/server";

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "reports", "export")) {
    return apiError("Forbidden — export permission required", 403);
  }

  await connectDB();
  const { getClinicTimezone, getClinicDayBounds, getClinicDateString, toClinicDateString } = await import("@/lib/time-utils");
  const tz = await getClinicTimezone();

  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") || "csv"; // csv | json
  const type = sp.get("type") || "revenue";

  const fromStr = sp.get("from");
  const toStr = sp.get("to");

  let from: Date;
  let to: Date;
  let fromDateStr: string;
  let toDateStr: string;

  if (fromStr) {
    fromDateStr = fromStr;
    from = getClinicDayBounds(fromStr, tz).start;
  } else {
    const todayStr = getClinicDateString(new Date(), tz);
    const [y, m] = todayStr.split("-");
    fromDateStr = `${y}-${m}-01`;
    from = getClinicDayBounds(fromDateStr, tz).start;
  }

  if (toStr) {
    toDateStr = toStr;
    to = getClinicDayBounds(toStr, tz).end;
  } else {
    toDateStr = getClinicDateString(new Date(), tz);
    to = getClinicDayBounds(toDateStr, tz).end;
  }

  let data: Record<string, unknown>[] = [];
  let filename = `report-${type}-${fromDateStr}`;

  switch (type) {
    case "revenue": {
      const invoices = await Invoice.find({
        createdAt: { $gte: from, $lte: to },
        status: { $in: ["paid", "partial"] },
      })
        .populate("patient", "firstName lastName patientId")
        .populate("doctor", "firstName lastName")
        .lean();

      data = invoices.map((inv: any) => {
        const patient = inv.patient as any;
        const doctor = inv.doctor as any;
        const patientName = patient
          ? `${patient.firstName || ""} ${patient.lastName || ""}`.trim()
          : (inv.patientName || "");
        const doctorName = doctor
          ? `${doctor.firstName || ""} ${doctor.lastName || ""}`.trim()
          : "";

        return {
          "Invoice #": inv.invoiceNumber || "",
          "Invoice Type": inv.invoiceType || "",
          Patient: patientName,
          "Patient ID": patient?.patientId || "",
          Doctor: doctorName,
          "Subtotal (PKR)": inv.subtotal || 0,
          "Discount (PKR)": inv.discount || 0,
          "Tax (PKR)": inv.taxAmount || 0,
          "Total (PKR)": inv.total || 0,
          "Paid (PKR)": inv.paidAmount || 0,
          "Balance (PKR)": inv.balanceDue || 0,
          Status: inv.status || "",
          Date: toClinicDateString(inv.createdAt as Date, tz),
        };
      });
      filename = `revenue-report-${fromDateStr}-to-${toDateStr}`;
      break;
    }

    case "patients": {
      const patients = await Patient.find({
        status: "active",
        createdAt: { $gte: from, $lte: to },
      }).lean();

      data = patients.map((p: any) => ({
        "Patient ID": p.patientId || "",
        "First Name": p.firstName || "",
        "Last Name": p.lastName || "",
        Gender: p.gender || "",
        Phone: p.phone || "",
        "Blood Group": p.bloodGroup || "",
        Status: p.status || "",
        Registered: toClinicDateString(p.createdAt as Date, tz),
      }));
      filename = `patients-${fromDateStr}-to-${toDateStr}`;
      break;
    }

    case "appointments": {
      const appointments = await Appointment.find({
        scheduledDate: { $gte: from, $lte: to },
        status: { $ne: "archived" },
      })
        .populate("patient", "firstName lastName patientId")
        .populate({ path: "doctor", populate: { path: "user", select: "firstName lastName" } })
        .lean();

      data = appointments.map(a => {
        const patient = a.patient as any;
        const docUser = (a.doctor as any)?.user;
        const patientName = patient
          ? `${patient.firstName || ""} ${patient.lastName || ""}`.trim()
          : "";
        const doctorName = docUser
          ? `${docUser.firstName || ""} ${docUser.lastName || ""}`.trim()
          : "";

        return {
          "Appointment ID": a.appointmentId || "",
          Patient: patientName,
          "Patient ID": patient?.patientId || "",
          Doctor: doctorName,
          Date: toClinicDateString(a.scheduledDate as Date, tz),
          Time: a.scheduledTime || "",
          Type: a.type || "",
          Status: a.status || "",
          "Fee (PKR)": a.consultationFee || 0,
          Payment: a.isPaid ? "Paid" : "Unpaid",
        };
      });
      filename = `appointments-${fromDateStr}-to-${toDateStr}`;
      break;
    }

    case "expenses": {
      const expenses = await Expense.find({
        date: { $gte: from, $lte: to },
        status: "approved",
      })
        .populate("createdBy", "firstName lastName")
        .lean();

      data = expenses.map(e => {
        const creator = e.createdBy as any;
        const creatorName = creator
          ? `${creator.firstName || ""} ${creator.lastName || ""}`.trim()
          : "";

        return {
          Title: e.title || "",
          Category: e.category || "",
          "Amount (PKR)": e.amount || 0,
          Method: e.paymentMethod || "",
          Vendor: e.vendor || "",
          Date: toClinicDateString(e.date as Date, tz),
          "Added By": creatorName,
          Status: e.status || "",
        };
      });
      filename = `expenses-${fromDateStr}-to-${toDateStr}`;
      break;
    }

    default:
      return apiError("Invalid report type", 400);
  }

  await auditLog({
    userId: session.user.id,
    action: "export",
    module: "reports",
    description: `Exported ${type} report (${format.toUpperCase()}) — ${data.length} rows`,
    status: "success",
  });

  if (format === "json") {
    return NextResponse.json(data, {
      headers: { "Content-Disposition": `attachment; filename="${filename}.json"` },
    });
  }

  // CSV export with RFC 4180 escaping
  if (data.length === 0) {
    return new NextResponse("No,Data\n", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  const headers = Object.keys(data[0]);
  const rows = [
    headers.map(escapeCSV).join(","),
    ...data.map(row =>
      headers.map(h => escapeCSV(row[h])).join(",")
    ),
  ].join("\n");

  return new NextResponse(rows, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}
