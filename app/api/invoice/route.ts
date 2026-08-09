// app/api/invoice/route.ts
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Invoice, Medicine } from "@/models/operations.model";
import { Patient } from "@/models/clinical.model";
import { apiSuccess, apiError, getPaginationParams, buildPagination, getIpFromHeaders, applyInvoiceStatusFilter } from "@/lib/utils";
import { createInvoiceSchema } from "@/lib/validations";
import { auditLog, hasPermission } from "@/lib/auth/audit";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "billing", "view")) return apiError("Forbidden", 403);
    await connectDB();
    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = getPaginationParams(sp);
    const search = sp.get("search") || "";
    const invoiceType = sp.get("invoiceType") || "";
    const status = sp.get("status") || "";
    const patientId = sp.get("patient") || "";
    const dateFrom = sp.get("dateFrom") || "";
    const dateTo = sp.get("dateTo") || "";

    const filter: Record<string, unknown> = {};
    if (invoiceType) filter.invoiceType = invoiceType;
    applyInvoiceStatusFilter(filter, status || null);
    if (patientId) filter.patient = patientId;
    if (search) {
        const patientIds = await Patient.find({
            status: "active",
            $or: [
                { firstName: { $regex: search, $options: "i" } },
                { lastName: { $regex: search, $options: "i" } }
            ]
        }).distinct("_id");

        filter.$or = [
            { invoiceNumber: { $regex: search, $options: "i" } },
            { patientName: { $regex: search, $options: "i" } },
            { patient: { $in: patientIds } }
        ];
    }
    if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) (filter.createdAt as Record<string, unknown>).$gte = new Date(dateFrom);
        if (dateTo) (filter.createdAt as Record<string, unknown>).$lte = new Date(dateTo);
    }

    const [invoices, total, summary] = await Promise.all([
        Invoice.find(filter)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 })
            .populate("patient", "firstName lastName patientId")
            .populate("doctor", "firstName lastName")
            .populate("appointment", "appointmentId")
            .populate("createdBy", "firstName lastName")
            .lean(),
        Invoice.countDocuments(filter),
        Invoice.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalPaid: { $sum: "$paidAmount" },
                    totalPending: { $sum: "$balanceDue" },
                },
            },
        ]),
    ]);

    return apiSuccess(
        {
            invoices,
            totalPaid: summary[0]?.totalPaid || 0,
            totalPending: summary[0]?.totalPending || 0,
        },
        "Invoices fetched",
        200,
        buildPagination(total, page, limit)
    );
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "billing", "create")) return apiError("Forbidden", 403);

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

    // Recalculate item totals and subtotal server-side to prevent client tampering
    const items = (cleanData.items || []).map((item) => ({
        ...item,
        total: item.quantity * item.unitPrice,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    let discountAmount = cleanData.discount || 0;
    if (cleanData.discountType === "percentage") {
        discountAmount = (subtotal * discountAmount) / 100;
    }
    const taxAmount = cleanData.taxAmount || cleanData.tax || 0;
    const total = Math.max(0, subtotal - discountAmount + taxAmount);
    const paidAmount = cleanData.paidAmount || 0;
    const balanceDue = Math.max(0, total - paidAmount);
    let status = cleanData.status || "pending";
    if (balanceDue === 0 && total > 0) status = "paid";
    else if (paidAmount > 0 && balanceDue > 0) status = "partial";

    const invoiceData = {
        ...cleanData,
        items,
        subtotal,
        total,
        paidAmount,
        balanceDue,
        status,
        createdBy: session.user.id,
    };

    const invoice = await Invoice.create(invoiceData);

    if (invoiceData.items) {
        for (const item of invoiceData.items) {
            if (item.medicine && item.category === "medicine") {
                await Medicine.findByIdAndUpdate(item.medicine, {
                    $inc: { currentStock: -item.quantity }
                });
            }
        }
    }

    // --- LAB LOGIC: Link invoiceId and update isPaid ONLY for explicit lab orders ---
    const labOrderIds = (invoice.items || []).map((item: any) => item.labOrderId).filter(Boolean);
    if (labOrderIds.length > 0) {
        const updatePayload: Record<string, unknown> = { invoiceId: invoice._id };
        if (invoice.status === "paid" || invoice.balanceDue <= 0) {
            updatePayload.isPaid = true;
        }
        await LabTest.updateMany(
            { _id: { $in: labOrderIds } },
            updatePayload
        );
    }

    // --- APPOINTMENT LOGIC: Sync appointment isPaid status ---
    if ((invoice.status === "paid" || invoice.balanceDue <= 0) && cleanData.appointment) {
        await Appointment.findByIdAndUpdate(cleanData.appointment, { isPaid: true });
    }

    const populatedInvoice = await Invoice.findById(invoice._id)
        .populate("patient", "firstName lastName patientId")
        .populate("doctor", "firstName lastName")
        .populate("createdBy", "firstName lastName")
        .lean();

    await auditLog({
        userId: session.user.id,
        action: "create",
        module: "billing",
        description: `Created invoice: ${invoice.invoiceNumber} (${invoice.invoiceType})`,
        resourceId: invoice._id.toString(),
        resourceType: "Invoice",
        ipAddress: getIpFromHeaders(req.headers),
    });

    return apiSuccess(populatedInvoice, "Invoice created", 201);
}