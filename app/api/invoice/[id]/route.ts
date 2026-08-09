// app/api/invoice/[id]/route.ts
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Invoice, Medicine } from "@/models/operations.model";
import { apiSuccess, apiError, getIpFromHeaders } from "@/lib/utils";
import { updateInvoiceSchema } from "@/lib/validations";
import { auditLog, hasPermission } from "@/lib/auth/audit";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
    const session = await auth();
    if (!session) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "billing", "view")) return apiError("Forbidden", 403);

    await connectDB();
    const { id } = await params;

    const invoice = await Invoice.findById(id)
        .populate("patient", "firstName lastName patientId")
        .populate("doctor", "firstName lastName")
        .populate("appointment", "appointmentId scheduledDate scheduledTime consultationFee")
        .populate("items.medicine", "name genericName unit")
        .populate("createdBy", "firstName lastName")
        .populate("payments.receivedBy", "firstName lastName")
        .lean();

    if (!invoice) return apiError("Invoice not found", 404);
    if (invoice.status === "cancelled" || invoice.status === "refunded") return apiError("Invoice not found", 404);
    return apiSuccess(invoice);
}

export async function PUT(req: NextRequest, { params }: Params) {
    const session = await auth();
    if (!session) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "billing", "update")) return apiError("Forbidden", 403);

    await connectDB();
    const { id } = await params;
    const body = await req.json();

    const parsed = updateInvoiceSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);

    const invoice = await Invoice.findById(id);
    if (!invoice) return apiError("Invoice not found", 404);

    if (["paid", "cancelled", "refunded"].includes(invoice.status)) {
        return apiError(`Cannot edit — invoice is ${invoice.status}`, 409);
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.items !== undefined) update.items = parsed.data.items;
    if (parsed.data.subtotal !== undefined) update.subtotal = parsed.data.subtotal;
    if (parsed.data.discount !== undefined) update.discount = parsed.data.discount;
    if (parsed.data.discountType !== undefined) update.discountType = parsed.data.discountType;
    if (parsed.data.taxRate !== undefined) update.taxRate = parsed.data.taxRate;
    if (parsed.data.taxAmount !== undefined) update.taxAmount = parsed.data.taxAmount;
    if (parsed.data.total !== undefined) update.total = parsed.data.total;
    if (parsed.data.dueDate !== undefined) update.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;

    // Handle payment addition with manual balance/status calculation
    if (parsed.data.payments && parsed.data.payments.length > 0) {
        const newPayments = parsed.data.payments.map(p => ({
            ...p,
            paidAt: new Date(),
        }));
        update.$push = { payments: { $each: newPayments } };

        // Calculate new paid amount
        const additionalPaid = newPayments.reduce((sum, p) => sum + p.amount, 0);
        const newPaidAmount = (invoice.paidAmount || 0) + additionalPaid;
        update.paidAmount = newPaidAmount;

        // Use provided total or existing total
        const currentTotal = parsed.data.total !== undefined ? parsed.data.total : invoice.total;
        const newBalance = currentTotal - newPaidAmount;
        update.balanceDue = newBalance;

        // Auto-update status
        if (newBalance <= 0 && currentTotal > 0) {
            update.status = "paid";
        } else if (newPaidAmount > 0 && newBalance > 0) {
            update.status = "partial";
        }
    }

    // Handle manual status override
    if (parsed.data.status !== undefined && !update.status) {
        update.status = parsed.data.status;
    }

    const updated = await Invoice.findByIdAndUpdate(id, update, { new: true })
        .populate("patient", "firstName lastName patientId")
        .populate("doctor", "firstName lastName")
        .populate("items.medicine", "name genericName unit")
        .populate("createdBy", "firstName lastName")
        .populate("payments.receivedBy", "firstName lastName")
        .lean();

    if (!updated) return apiError("Invoice not found", 404);

    // --- LAB LOGIC: Sync LabTest.isPaid when invoice becomes paid or updated ---
    if (updated) {
        const labOrderIds = (updated.items || []).map((item: any) => item.labOrderId).filter(Boolean);
        const { LabTest } = await import("@/models/operations.model");

        const updatePayload: Record<string, unknown> = { invoiceId: updated._id };
        if (updated.status === "paid" || (updated.balanceDue !== undefined && updated.balanceDue <= 0)) {
            updatePayload.isPaid = true;
        }

        if (labOrderIds.length > 0) {
            await LabTest.updateMany({ _id: { $in: labOrderIds } }, updatePayload);
        }

        // --- APPOINTMENT LOGIC: Sync appointment isPaid status ---
        if ((updated.status === "paid" || updated.balanceDue <= 0) && updated.appointment) {
            const { Appointment } = await import("@/models/clinical.model");
            const apptId = typeof updated.appointment === "object" ? (updated.appointment as any)._id : updated.appointment;
            await Appointment.findByIdAndUpdate(apptId, { isPaid: true });
        }
    }

    const changes: string[] = [];
    if (update.items) changes.push("items updated");
    if (update.total) changes.push(`total: ${update.total}`);
    if (update.status) changes.push(`status: ${update.status}`);
    if (parsed.data.payments) changes.push("payment added");

    await auditLog({
        userId: session.user.id,
        action: "update",
        module: "billing",
        description: `Updated invoice: ${updated.invoiceNumber}${changes.length ? ` (${changes.join(", ")})` : ""}`,
        resourceId: id,
        resourceType: "Invoice",
        ipAddress: getIpFromHeaders(req.headers),
    });

    return apiSuccess(updated, "Invoice updated");
}

export async function DELETE(req: NextRequest, { params }: Params) {
    const session = await auth();
    if (!session) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "billing", "delete")) return apiError("Forbidden", 403);

    await connectDB();
    const { id } = await params;

    const invoice = await Invoice.findById(id);
    if (!invoice) return apiError("Invoice not found", 404);
    if (invoice.status === "paid") return apiError("Cannot delete a paid invoice", 400);
    if (invoice.status === "cancelled" || invoice.status === "refunded") return apiError("Invoice not found", 404);

    // RESTORE STOCK FOR MEDICINE ITEMS BEFORE CANCELLING
    if (invoice.items && invoice.items.length > 0) {
        for (const item of invoice.items) {
            if (item.medicine && item.category === "medicine") {
                await Medicine.findByIdAndUpdate(item.medicine, {
                    $inc: { currentStock: item.quantity }
                });
            }
        }
    }

    const invoiceNumber = invoice.invoiceNumber;
    await Invoice.findByIdAndUpdate(id, { status: "cancelled" });

    await auditLog({
        userId: session.user.id,
        action: "delete",
        module: "billing",
        description: `Cancelled invoice: ${invoiceNumber} (stock restored for medicine items)`,
        resourceId: id,
        resourceType: "Invoice",
        ipAddress: getIpFromHeaders(req.headers),
    });

    return apiSuccess(null, "Invoice deleted successfully with stock restored", 200);
}