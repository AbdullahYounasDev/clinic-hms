import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { Settings } from "@/models/operations.model";
import { apiSuccess, apiError } from "@/lib/utils";
import { auditLog, hasPermission } from "@/lib/auth/audit";
import { uploadFile, deleteFile, extractPublicIdFromUrl } from "@/lib/cloudinary";

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

    // Delete previous logo from Cloudinary if it exists.
    // Fallback: if logoPublicId is missing (legacy record), derive it from the logo URL.
    const prevPublicId = existingSettings?.logoPublicId ||
      (existingSettings?.logo?.includes("cloudinary.com")
        ? extractPublicIdFromUrl(existingSettings.logo)
        : "");

    if (prevPublicId) {
      try {
        await deleteFile(prevPublicId);
        console.log(`[Settings] Deleted previous logo from Cloudinary: ${prevPublicId}`);
      } catch (err) {
        // Log but don't block the upload — the new logo should still be saved
        console.error("[Settings] Failed to delete previous logo from Cloudinary:", err);
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

    // Fallback: if logoPublicId is missing (legacy record), derive it from the logo URL.
    const publicIdToDelete = existingSettings?.logoPublicId ||
      (existingSettings?.logo?.includes("cloudinary.com")
        ? extractPublicIdFromUrl(existingSettings.logo)
        : "");

    if (publicIdToDelete) {
      try {
        await deleteFile(publicIdToDelete);
        console.log(`[Settings] Deleted logo from Cloudinary: ${publicIdToDelete}`);
      } catch (err) {
        // Log the error but still reset the DB record to /logo.png
        console.error("[Settings] Failed to delete logo from Cloudinary:", err);
      }
    } else {
      console.log("[Settings] No Cloudinary logo publicId found — nothing to delete from Cloudinary.");
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
