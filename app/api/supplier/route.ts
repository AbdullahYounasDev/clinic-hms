// app/api/suppliers/route.ts
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Supplier } from "@/models/operations.model";
import { apiSuccess, apiError, getPaginationParams, buildPagination, getIpFromHeaders, applyIsActiveFilter } from "@/lib/utils";
import { createSupplierSchema } from "@/lib/validations";
import { auditLog, hasPermission } from "@/lib/auth/audit";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "supplier", "view")) return apiError("Forbidden", 403);
    await connectDB();
    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = getPaginationParams(sp);
    const search = sp.get("search") || "";
    const type = sp.get("type") || "";
    const isActive = sp.get("isActive");
    const from = sp.get("from") || "";
    const to = sp.get("to") || "";
    const filter: Record<string, unknown> = {};
    applyIsActiveFilter(filter, isActive);
    if (type) filter.type = type;
    if (search) filter.$or = [{ name: { $regex: search, $options: "i" } }, { contactPerson: { $regex: search, $options: "i" } }];

    if (from || to) {
        const { getClinicDayBounds, getClinicTimezone } = await import("@/lib/time-utils");
        const tz = await getClinicTimezone();
        filter.createdAt = {};
        if (from) {
            const bounds = getClinicDayBounds(from, tz);
            (filter.createdAt as Record<string, unknown>).$gte = bounds.start;
        }
        if (to) {
            const bounds = getClinicDayBounds(to, tz);
            (filter.createdAt as Record<string, unknown>).$lte = bounds.end;
        }
    }

    const [suppliers, total] = await Promise.all([
        Supplier.find(filter).skip(skip).limit(limit).sort({ name: 1 }).lean(),
        Supplier.countDocuments(filter),
    ]);
    return apiSuccess(suppliers, "Suppliers fetched", 200, buildPagination(total, page, limit));
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "supplier", "create")) return apiError("Forbidden", 403);
    const body = await req.json();
    const parsed = createSupplierSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);
    await connectDB();
    const supplier = await Supplier.create(parsed.data);
    await auditLog({
        userId: session.user.id,
        action: "create",
        module: "pharmacy",
        description: `Added supplier: ${supplier.name}`,
        resourceId: supplier._id.toString(),
        ipAddress: getIpFromHeaders(req.headers),
    });
    return apiSuccess(supplier, "Supplier added", 201);
}