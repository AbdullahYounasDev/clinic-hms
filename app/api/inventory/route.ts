import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { InventoryItem } from "@/models/operations.model";
import { apiSuccess, apiError, getPaginationParams, buildPagination, getIpFromHeaders, applyIsActiveFilter } from "@/lib/utils";
import { auditLog, hasPermission } from "@/lib/auth/audit";
import { z } from "zod";

const createInventorySchema = z.object({
  name: z.string().min(1),
  category: z.enum(["equipment", "supply", "consumable"]),
  sku: z.string().optional().transform(val => val === "" ? undefined : val),
  currentQuantity: z.number().min(0),
  minQuantity: z.number().min(0),
  unit: z.string().min(1),
  unitCost: z.number().min(0),
  location: z.string().optional(),
  supplier: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "inventory", "view")) return apiError("Forbidden", 403);
  await connectDB();
  const sp = req.nextUrl.searchParams;
  const { page, limit, skip } = getPaginationParams(sp);
  const category = sp.get("category") || "";
  const lowStock = sp.get("lowStock") === "true";
  const search = sp.get("search") || "";
  const isActive = sp.get("isActive");
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  const filter: Record<string, unknown> = {};
  applyIsActiveFilter(filter, isActive);
  if (category) filter.category = category;
  if (lowStock) filter.$expr = { $lte: ["$currentQuantity", "$minQuantity"] };
  if (search) filter.name = { $regex: search, $options: "i" };

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

  const [items, total] = await Promise.all([
    InventoryItem.find(filter).skip(skip).limit(limit).sort({ name: 1 }).populate("supplier", "name").lean(),
    InventoryItem.countDocuments(filter),
  ]);
  return apiSuccess(items, "Inventory fetched", 200, buildPagination(total, page, limit));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "inventory", "create")) return apiError("Forbidden", 403);
  const body = await req.json();

  // Remove empty sku to avoid duplicate key error
  if (body.sku === "" || body.sku === null) {
    delete body.sku;
  }
  const parsed = createInventorySchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);
  await connectDB();

  const cleanData = { ...parsed.data };
  if (cleanData.supplier === "" || cleanData.supplier === null) delete cleanData.supplier;

  const item = await InventoryItem.create(cleanData);
  await auditLog({ userId: session.user.id, action: "create", module: "inventory", description: `Added inventory: ${item.name}`, resourceId: item._id.toString(), ipAddress: getIpFromHeaders(req.headers) });
  return apiSuccess(item, "Inventory item added", 201);
}