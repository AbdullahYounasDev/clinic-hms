import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Settings } from "@/models/operations.model";
import { apiSuccess, apiError } from "@/lib/utils";
import { auditLog, hasPermission } from "@/lib/auth/audit";
import { uploadFile, deleteFile } from "@/lib/cloudinary";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "settings", "update")) {
    return apiError("Forbidden", 403);
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return apiError("No file provided", 400);
    }

    if (!file.type.startsWith("image/")) {
      return apiError("Only image files are allowed", 400);
    }

    // Limit size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      return apiError("Image size must be less than 5MB", 400);
    }

    // Convert file to base64 Data URI
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const base64 = Buffer.from(bytes).toString("base64");
    const dataURI = `data:${file.type};base64,${base64}`;

    await connectDB();
    const existingSettings = await Settings.findOne({});

    // Delete previous logo from Cloudinary if it exists
    if (existingSettings?.logoPublicId) {
      try {
        await deleteFile(existingSettings.logoPublicId);
      } catch (err) {
        console.error("Failed to delete previous logo from Cloudinary:", err);
      }
    }

    // Upload new logo to Cloudinary
    const uploadResult = await uploadFile(dataURI, "clinic/logos");

    const updatedSettings = await Settings.findOneAndUpdate(
      {},
      {
        logo: uploadResult.url,
        logoPublicId: uploadResult.publicId,
        updatedBy: session.user.id,
      },
      { upsert: true, new: true }
    ).lean();

    await auditLog({
      userId: session.user.id,
      action: "update",
      module: "settings",
      description: "Updated clinic logo on Cloudinary",
    });

    return apiSuccess({
      logo: updatedSettings.logo,
      logoPublicId: updatedSettings.logoPublicId,
    }, "Logo updated successfully");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to upload logo";
    return apiError(message, 500);
  }
}

export async function DELETE(_req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "settings", "update")) {
    return apiError("Forbidden", 403);
  }

  try {
    await connectDB();
    const existingSettings = await Settings.findOne({});

    if (existingSettings?.logoPublicId) {
      try {
        await deleteFile(existingSettings.logoPublicId);
      } catch (err) {
        console.error("Failed to delete logo from Cloudinary:", err);
      }
    }

    const updatedSettings = await Settings.findOneAndUpdate(
      {},
      {
        logo: "/logo.png",
        logoPublicId: "",
        updatedBy: session.user.id,
      },
      { upsert: true, new: true }
    ).lean();

    await auditLog({
      userId: session.user.id,
      action: "update",
      module: "settings",
      description: "Deleted custom clinic logo from Cloudinary (reset to default logo)",
    });

    return apiSuccess({
      logo: updatedSettings.logo,
      logoPublicId: "",
    }, "Logo removed. Reverted to default logo.");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to remove logo";
    return apiError(message, 500);
  }
}
