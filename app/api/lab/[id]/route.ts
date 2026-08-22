// app/api/lab/[id]/route.ts
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { LabCatalog, LabTest } from "@/models/operations.model";
import { apiSuccess, apiError, getIpFromHeaders, isInactiveRecord } from "@/lib/utils";
import { auditLog, hasPermission } from "@/lib/auth/audit";
import { NotificationService } from "@/services/notification.service";
import { updateLabTestResultsSchema } from "@/lib/validations";

interface Params { params: Promise<{ id: string }> }

interface CatalogParamDef {
  name: string;
  unit?: string;
  referenceRange?: string;
  minValue?: number;
  maxValue?: number;
  dataType?: "number" | "text" | "boolean";
}

const VALID_STATUSES = ["pending", "sample_collected", "processing", "completed", "delivered", "cancelled"];
const VALID_PRIORITIES = ["routine", "urgent", "stat"];

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "lab", "view")) return apiError("Forbidden", 403);

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) return apiError("Invalid lab test ID", 400);

  await connectDB();

  const test = await LabTest.findById(id)
    .populate("patient", "firstName lastName patientId age gender dateOfBirth bloodGroup")
    .populate("requestedBy", "firstName lastName")
    .populate("sampleCollectedBy", "firstName lastName")
    .populate("processedBy", "firstName lastName")
    .populate("approvedBy", "firstName lastName")
    .populate("tests.catalogId", "testName testCode category turnaroundTime")
    .populate("invoiceId", "invoiceNumber status paidAmount total balanceDue")
    .lean();

  if (!test || test.status === "cancelled" || isInactiveRecord(test)) {
    return apiError("Lab test not found", 404);
  }

  // Auto-sync isPaid if an invoice exists and is paid for this specific test
  if (!test.isPaid) {
    const { Invoice } = await import("@/models/operations.model");
    const testInvoiceId = typeof test.invoiceId === "object" ? (test.invoiceId as any)?._id : test.invoiceId;

    const queryOr: any[] = [{ "items.labOrderId": test._id }];
    if (testInvoiceId) queryOr.push({ _id: testInvoiceId });

    const matchingInvoice = await Invoice.findOne({
      $or: queryOr,
      status: "paid",
    }).lean();

    if (matchingInvoice) {
      await LabTest.findByIdAndUpdate(id, { isPaid: true, invoiceId: matchingInvoice._id });
      test.isPaid = true;
      (test as any).invoiceId = {
        _id: matchingInvoice._id,
        invoiceNumber: matchingInvoice.invoiceNumber,
        status: matchingInvoice.status,
      };
    }
  }

  return apiSuccess(test, "Lab test fetched", 200);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "lab", "update")) return apiError("Forbidden", 403);

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) return apiError("Invalid lab test ID", 400);

  await connectDB();
  const body = await req.json();

  // 1. Fetch current document before any update logic
  const current = await LabTest.findById(id);
  if (!current || current.status === "cancelled" || isInactiveRecord(current)) {
    return apiError("Lab test not found", 404);
  }

  const update: Record<string, unknown> = {};

  // 2. Status validation & rules
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return apiError("Invalid status value", 400);
    }

    // Cannot set status to delivered if order is unpaid
    const willBePaid = body.isPaid !== undefined ? Boolean(body.isPaid) : current.isPaid;
    if (body.status === "delivered" && !willBePaid) {
      return apiError("Cannot deliver order - payment is pending", 400);
    }

    update.status = body.status;

    if (body.status === "sample_collected" && current.status !== "sample_collected") {
      update.sampleCollectedAt = new Date();
      update.sampleCollectedBy = session.user.id;
    }
    if (body.status === "processing" && current.status !== "processing") {
      update.processedBy = session.user.id;
    }
    if (body.status === "completed" && current.status !== "completed") {
      update.completedAt = new Date();
      if (hasPermission(session.user.permissions, session.user.isSuperAdmin, "lab", "approve")) {
        update.approvedBy = session.user.id;
      }
    }
  }

  // 3. Priority validation
  if (body.priority !== undefined) {
    if (!VALID_PRIORITIES.includes(body.priority)) {
      return apiError("Invalid priority value", 400);
    }
    update.priority = body.priority;
  }

  // 4. Tests update — only allowed when status is currently pending
  if (body.tests !== undefined) {
    if (current.status !== "pending") {
      return apiError("Can only edit tests when status is pending", 409);
    }
    if (!Array.isArray(body.tests) || body.tests.length === 0) {
      return apiError("At least one test must be selected", 400);
    }

    const catalogIds = body.tests.map((t: { catalogId: string }) => t.catalogId);
    const catalogTests = await LabCatalog.find({ _id: { $in: catalogIds }, isActive: true }).lean();
    if (catalogTests.length !== catalogIds.length) {
      return apiError("One or more tests not found or inactive", 404);
    }

    const newTests = catalogTests.map(ct => ({
      catalogId: ct._id,
      testName: ct.testName,
      testCode: ct.testCode,
      category: ct.category,
      cost: ct.cost,
    }));
    update.tests = newTests;
    update.totalCost = newTests.reduce((sum, t) => sum + t.cost, 0);
  }

  // 5. Results update — schema validated + auto abnormal computation
  if (body.results !== undefined) {
    const parsedResults = updateLabTestResultsSchema.safeParse({
      results: body.results,
      reportUrl: body.reportUrl,
      notes: body.notes,
    });
    if (!parsedResults.success) {
      return apiError(parsedResults.error.issues[0].message, 422);
    }

    const catalogIds = parsedResults.data.results.map(r => r.catalogId);
    const catalogDocs = await LabCatalog.find({ _id: { $in: catalogIds } }).lean();
    const catalogMap = new Map(catalogDocs.map(c => [c._id.toString(), c]));

    const enrichedResults = parsedResults.data.results.map(r => {
      const catalog = catalogMap.get(r.catalogId);
      const rawParams = (catalog?.parameters || []) as unknown as CatalogParamDef[];
      const paramDefs = new Map<string, CatalogParamDef>(rawParams.map(p => [p.name, p]));

      const parameterResults = r.parameterResults.map(pr => {
        const def = paramDefs.get(pr.parameterName);
        let isAbnormal = pr.isAbnormal ?? false;

        if (def?.dataType === "number" && pr.isAbnormal === undefined) {
          const numValue = Number(pr.value);
          if (!Number.isNaN(numValue)) {
            const minVal = def.minValue;
            const maxVal = def.maxValue;
            if (minVal !== undefined && numValue < minVal) isAbnormal = true;
            if (maxVal !== undefined && numValue > maxVal) isAbnormal = true;
          }
        }

        return {
          ...pr,
          unit: pr.unit ?? def?.unit,
          referenceRange: pr.referenceRange ?? def?.referenceRange,
          isAbnormal,
        };
      });

      return { ...r, parameterResults };
    });

    update.results = enrichedResults;
  }

  // 6. Scalar & invoice fields
  if (body.reportUrl !== undefined) update.reportUrl = body.reportUrl;
  if (body.notes !== undefined) update.notes = body.notes;
  if (body.isPaid !== undefined) update.isPaid = Boolean(body.isPaid);
  if (body.totalCost !== undefined && !body.tests) update.totalCost = Number(body.totalCost);

  if (body.invoiceId) {
    if (!mongoose.Types.ObjectId.isValid(body.invoiceId)) {
      return apiError("Invalid invoice ID", 400);
    }
    update.invoiceId = body.invoiceId;
  }

  if (Object.keys(update).length === 0) {
    return apiError("No valid fields provided to update", 400);
  }

  const updatedTest = await LabTest.findByIdAndUpdate(id, update, { new: true, runValidators: true })
    .populate("patient", "firstName lastName patientId age gender dateOfBirth bloodGroup")
    .populate("requestedBy", "firstName lastName")
    .populate("sampleCollectedBy", "firstName lastName")
    .populate("processedBy", "firstName lastName")
    .populate("approvedBy", "firstName lastName")
    .populate("tests.catalogId", "testName testCode category turnaroundTime")
    .populate("invoiceId", "invoiceNumber")
    .lean();

  if (!updatedTest) return apiError("Lab test not found", 404);

  // Notify when lab results transition into completed
  if (body.status === "completed" && current.status !== "completed") {
    const populatedTest = await LabTest.findById(id)
      .populate("requestedBy", "_id")
      .populate("patient", "firstName lastName")
      .lean();

    if (populatedTest?.requestedBy?._id) {
      const patientData = populatedTest.patient as unknown as Record<string, unknown> | null | undefined;
      await NotificationService.create({
        userId: (populatedTest.requestedBy as unknown as Record<string, unknown>)._id!.toString(),
        type: "lab_result_ready",
        title: "Lab Results Ready",
        message: `Lab results for ${patientData?.firstName || ""} ${patientData?.lastName || ""} (${populatedTest.labTestId}) are ready for review`,
        priority: "medium",
        actionUrl: `/lab/${id}`,
        metadata: { labTestId: populatedTest.labTestId },
      });
    }
  }

  await auditLog({
    userId: session.user.id,
    action: "update",
    module: "lab",
    description: `Updated lab test order ${updatedTest.labTestId} — ${body.status ? `status: ${body.status}` : body.tests ? "tests changed" : "details updated"}`,
    resourceId: id,
    resourceType: "LabTest",
    ipAddress: getIpFromHeaders(req.headers),
  });

  return apiSuccess(updatedTest, "Lab test updated", 200);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "lab", "delete")) return apiError("Forbidden", 403);

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) return apiError("Invalid lab test ID", 400);

  await connectDB();

  const test = await LabTest.findById(id)
    .populate("invoiceId", "invoiceNumber")
    .lean();

  if (!test || test.status === "cancelled" || isInactiveRecord(test)) {
    return apiError("Lab test not found", 404);
  }

  // Only allow deleting if pending
  if (test.status !== "pending") {
    return apiError(`Cannot delete — order is in ${test.status} status`, 409);
  }

  const testId = test.labTestId;
  await LabTest.findByIdAndUpdate(id, { status: "cancelled" });

  await auditLog({
    userId: session.user.id,
    action: "delete",
    module: "lab",
    description: `Archived lab test order ${testId}`,
    resourceId: id,
    resourceType: "LabTest",
    ipAddress: getIpFromHeaders(req.headers),
  });

  return apiSuccess(null, "Lab test order deleted", 200);
}