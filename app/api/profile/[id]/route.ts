// app/api/profile/[id]/route.ts
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { User } from "@/models/user.model";
import { Doctor } from "@/models/clinical.model";
import { apiSuccess, apiError, getIpFromHeaders, isArchivedStatus } from "@/lib/utils";
import { auditLog, hasPermission } from "@/lib/auth/audit";
import bcrypt from "bcryptjs";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
    const session = await auth();
    if (!session) return apiError("Unauthorized", 401);

    await connectDB();
    const { id } = await params;

    if (session.user.id !== id && !session.user.isSuperAdmin) {
        return apiError("Forbidden", 403);
    }

    const user = await User.findById(id)
        .populate("role", "name slug")
        .populate("createdBy", "firstName lastName email")
        .select("-password")
        .lean();

    if (!user) return apiError("User not found", 404);
    if (isArchivedStatus(user.status)) return apiError("User not found", 404);

    let doctorData = null;
    const doctor = await Doctor.findOne({ user: id })
        .populate("department", "name code")
        .lean();

    if (doctor) {
        doctorData = {
            _id: doctor._id,
            doctorId: doctor.doctorId,
            specialization: doctor.specialization,
            qualifications: doctor.qualifications,
            experience: doctor.experience,
            consultationFee: doctor.consultationFee,
            department: doctor.department,
            isAvailable: doctor.isAvailable,
            bio: doctor.bio,
            languages: doctor.languages,
            createdAt: doctor.createdAt,
            updatedAt: doctor.updatedAt,
        };
    }

    return apiSuccess({ ...user, doctor: doctorData });
}

export async function PUT(req: NextRequest, { params }: Params) {
    const session = await auth();
    if (!session) return apiError("Unauthorized", 401);

    await connectDB();
    const { id } = await params;

    if (session.user.id !== id && !session.user.isSuperAdmin) {
        return apiError("Forbidden", 403);
    }

    const existing = await User.findById(id).lean();
    if (!existing) return apiError("User not found", 404);
    if (isArchivedStatus(existing.status)) return apiError("User not found", 404);

    const body = await req.json();

    // Update profile info only
    const allowed = ["firstName", "lastName", "phone"];
    const updateData: Record<string, unknown> = {};
    for (const key of allowed) {
        if (key in body) updateData[key] = body[key];
    }

    const user = await User.findByIdAndUpdate(id, updateData, { new: true })
        .populate("role", "name slug")
        .select("-password")
        .lean();

    if (!user) return apiError("User not found", 404);
    if (isArchivedStatus(user.status)) return apiError("User not found", 404);

    await auditLog({
        userId: session.user.id,
        action: "update",
        module: "profile",
        description: `User updated own profile`,
        resourceId: id,
        ipAddress: getIpFromHeaders(req.headers),
    });

    return apiSuccess(user, "Profile updated successfully");
}

export async function DELETE(req: NextRequest, { params }: Params) {
    const session = await auth();
    if (!session) return apiError("Unauthorized", 401);
    if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "users", "delete")) {
        return apiError("Forbidden", 403);
    }

    await connectDB();
    const { id } = await params;

    if (session.user.id === id) {
        return apiError("You cannot delete your own account", 403);
    }

    const existingUser = await User.findById(id).lean();
    if (!existingUser) return apiError("User not found", 404);
    if (isArchivedStatus(existingUser.status)) return apiError("User not found", 404);
    if (existingUser.isSuperAdmin) return apiError("Cannot delete super administrator", 403);

    await User.findByIdAndUpdate(id, { status: "archived" });

    const doctor = await Doctor.findOne({ user: id }).lean();
    if (doctor) {
        await Doctor.findByIdAndUpdate(doctor._id, { status: "archived", isAvailable: false });
    }

    await auditLog({
        userId: session.user.id,
        action: "delete",
        module: "users",
        description: `Archived user ${existingUser.email}`,
        resourceId: id,
        resourceType: "User",
        ipAddress: getIpFromHeaders(req.headers),
    });

    return apiSuccess(null, "User deleted successfully");
}