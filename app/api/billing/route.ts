import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Invoice, LabTest } from "@/models/operations.model";
import { apiSuccess, apiError, getPaginationParams, buildPagination, getIpFromHeaders, applyInvoiceStatusFilter } from "@/lib/utils";
import { createInvoiceSchema } from "@/lib/validations";
import { auditLog, hasPermission } from "@/lib/auth/audit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "billing", "view")) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const sp = req.nextUrl.searchParams;
  const { page, limit, skip } = getPaginationParams(sp);
  const status = sp.get("status") || "";
  const patientId = sp.get("patient") || "";

  const filter: Record<string, unknown> = {};
  applyInvoiceStatusFilter(filter, status || null);
  if (patientId) filter.patient = patientId;

  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("patient", "firstName lastName patientId phone")
      .populate("createdBy", "firstName lastName")
      .lean(),
    Invoice.countDocuments(filter),
  ]);

  return apiSuccess(invoices, "Invoices fetched", 200, buildPagination(total, page, limit));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "billing", "create")) {
    return apiError("Forbidden", 403);
  }

  const body = await req.json();
  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);

  await connectDB();

  const { Medicine, LabTest } = await import("@/models/operations.model");
  const { Appointment } = await import("@/models/clinical.model");

  // Clean empty string fields to prevent ObjectId cast errors
  const cleanData = { ...parsed.data };
  if (!cleanData.patient) delete cleanData.patient;
  if (!cleanData.doctor) delete cleanData.doctor;
  if (!cleanData.appointment) delete cleanData.appointment;

  // Calculate totals server-side
  const items = cleanData.items.map((item) => ({
    ...item,
    total: item.quantity * item.unitPrice,
  }));

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  let discountAmount = cleanData.discount || 0;
  if (cleanData.discountType === "percentage") {
    discountAmount = (subtotal * discountAmount) / 100;
  }
  const taxAmount = cleanData.tax || 0;
  const total = Math.max(0, subtotal - discountAmount + taxAmount);
  const paidAmount = cleanData.paidAmount || 0;
  const balanceDue = Math.max(0, total - paidAmount);
  let status = cleanData.status || "pending";
  if (balanceDue === 0 && total > 0) status = "paid";
  else if (paidAmount > 0 && balanceDue > 0) status = "partial";

  // Create invoice
  const invoice = await Invoice.create({
    ...cleanData,
    items,
    subtotal,
    total,
    paidAmount,
    balanceDue,
    status,
    createdBy: session.user.id,
  });

  // Deduct inventory stock for medicine items
  for (const item of items) {
    if (item.medicine && item.category === "medicine") {
      await Medicine.findByIdAndUpdate(item.medicine, {
        $inc: { currentStock: -item.quantity },
      });
    }
  }

  // --- LAB LOGIC: Only mark existing lab orders as paid if explicitly specified ---
  if (status === "paid" || balanceDue <= 0) {
    const existingOrders = items.filter((item) => item.labOrderId).map((item) => item.labOrderId);
    if (existingOrders.length > 0) {
      await LabTest.updateMany(
        { _id: { $in: existingOrders } },
        { isPaid: true, invoiceId: invoice._id }
      );
    }

    // --- APPOINTMENT LOGIC: Sync appointment isPaid status ---
    if (cleanData.appointment) {
      await Appointment.findByIdAndUpdate(cleanData.appointment, { isPaid: true });
    }
  }

  const populated = await Invoice.findById(invoice._id)
    .populate("patient", "firstName lastName patientId")
    .populate("doctor", "firstName lastName")
    .populate("createdBy", "firstName lastName")
    .lean();

  await auditLog({
    userId: session.user.id,
    action: "create",
    module: "billing",
    description: `Created ${invoice.invoiceType} invoice ${invoice.invoiceNumber} for amount ${total}`,
    resourceId: invoice._id.toString(),
    resourceType: "Invoice",
    ipAddress: getIpFromHeaders(req.headers),
  });

  return apiSuccess(populated, "Invoice created successfully", 201);
}