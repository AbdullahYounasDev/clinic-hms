import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth.config";
import connectDB from "@/lib/db/mongoose";
import { EMR, Doctor, Prescription } from "@/models/clinical.model";
import { apiSuccess, apiError, getPaginationParams, buildPagination, getIpFromHeaders } from "@/lib/utils";
import { createEMRSchema } from "@/lib/validations";
import { auditLog, hasPermission } from "@/lib/auth/audit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "emr", "view")) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const sp = req.nextUrl.searchParams;
  const { page, limit, skip } = getPaginationParams(sp);
  const search = sp.get("search") || "";
  const patient = sp.get("patient") || "";
  const doctorId = sp.get("doctor") || "";
  const fromDate = sp.get("from") || sp.get("fromDate") || "";
  const toDate = sp.get("to") || sp.get("toDate") || "";

  const filter: Record<string, unknown> = { status: { $ne: "archived" } };

  // Search by patient first name, last name, or patient ID
  if (search) {
    const { Patient } = await import("@/models/clinical.model");
    const matchingPatientIds = await Patient.find({
      status: { $ne: "archived" },
      $or: [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { patientId: { $regex: search, $options: "i" } },
      ],
    }).distinct("_id");

    filter.patient = { $in: matchingPatientIds };
  } else if (patient) {
    filter.patient = patient;
  }

  // Doctor scope: only show their own EMR records
  if (!session.user.isSuperAdmin) {
    const { Doctor } = await import("@/models/clinical.model");
    const doctor = await Doctor.findOne({ user: session.user.id, status: { $ne: "archived" } }).lean();
    if (doctor) {
      filter.doctor = doctor._id;
    }
  }

  // Admin can filter by specific doctor
  if (session.user.isSuperAdmin && doctorId) {
    filter.doctor = doctorId;
  }

  if (fromDate || toDate) {
    const { getClinicTimezone, getClinicDayBounds } = await import("@/lib/time-utils");
    const clinicTz = await getClinicTimezone();
    const visitDateFilter: Record<string, Date> = {};

    if (fromDate) {
      visitDateFilter.$gte = getClinicDayBounds(fromDate, clinicTz).start;
    }
    if (toDate) {
      visitDateFilter.$lte = getClinicDayBounds(toDate, clinicTz).end;
    }
    filter.visitDate = visitDateFilter;
  }

  const [records, total] = await Promise.all([
    EMR.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ visitDate: -1 })
      .populate("patient", "firstName lastName patientId phone")
      .populate({ path: "doctor", populate: { path: "user", select: "firstName lastName email" } })
      .populate("appointment", "appointmentId scheduledDate")
      .populate("createdBy", "firstName lastName")
      .lean(),
    EMR.countDocuments(filter),
  ]);

  return apiSuccess(records, "EMR records fetched", 200, buildPagination(total, page, limit));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return apiError("Unauthorized", 401);
  if (!hasPermission(session.user.permissions, session.user.isSuperAdmin, "emr", "create")) {
    return apiError("Forbidden", 403);
  }

  const body = await req.json();
  const parsed = createEMRSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 422);
  }

  await connectDB();

  // Compute BMI if height and weight provided
  const vitals = { ...parsed.data.vitals };
  if (vitals?.weight && vitals?.height) {
    const h = vitals.height / 100;
    vitals.bmi = Math.round((vitals.weight / (h * h)) * 10) / 10;
  }

  // Resolve doctor for the EMR record
  let doctor = null;
  const doctorInputId = parsed.data.doctor || (body as any).doctor;

  if (doctorInputId) {
    doctor = await Doctor.findById(doctorInputId);
  }

  if (!doctor && parsed.data.appointment) {
    const { Appointment } = await import("@/models/clinical.model");
    const appt = await Appointment.findById(parsed.data.appointment).select("doctor").lean();
    if (appt?.doctor) {
      doctor = await Doctor.findById(appt.doctor);
    }
  }

  if (!doctor) {
    doctor = await Doctor.findOne({ user: session.user.id, status: { $ne: "archived" } });
  }

  // Fallback for SuperAdmin / Admin / Staff without direct Doctor profile
  if (!doctor && (session.user.isSuperAdmin || hasPermission(session.user.permissions, session.user.isSuperAdmin, "emr", "create"))) {
    doctor = await Doctor.findOne({ status: { $ne: "archived" } });
  }

  if (!doctor) {
    return apiError("No active doctor profile found in the system. Please create a doctor first.", 404);
  }

  // Create EMR record
  const emr = await EMR.create({
    ...parsed.data,
    vitals,
    doctor: doctor._id,
    createdBy: session.user.id,
    visitDate: new Date(),
  });

  // Handle prescriptions if provided
  let prescriptions = [];
  if (parsed.data.prescriptions && parsed.data.prescriptions.length > 0) {
    const prescriptionData = {
      patient: parsed.data.patient,
      doctor: doctor._id,
      emr: emr._id,
      appointment: parsed.data.appointment || null,
      medicines: parsed.data.prescriptions.map((p: Record<string, unknown>) => ({
        medicineName: p.medicine,
        genericName: p.genericName || "",
        strength: p.strength || "",
        dosage: p.dosage,
        frequency: p.frequency,
        duration: p.duration,
        durationDays: p.durationDays || 0,
        route: p.route || "oral",
        instructions: p.instructions || "",
        quantity: p.quantity || 0,
        isRefillable: p.isRefillable || false,
        refillsRemaining: p.refillsRemaining || 0,
      })),
      notes: parsed.data.prescriptionNotes || "",
      type: parsed.data.prescriptionType || "new",
      duration: {
        value: parsed.data.durationValue || 5,
        unit: parsed.data.durationUnit || "days",
      },
      allergies: parsed.data.allergies || [],
      safetyChecks: {
        allergenChecked: parsed.data.allergenChecked || false,
        interactionsChecked: parsed.data.interactionsChecked || false,
        checkedBy: session.user.id,
        checkedAt: new Date(),
      },
      validUntil: new Date(Date.now() + (parsed.data.durationValue || 5) * 24 * 60 * 60 * 1000),
      prescribedDate: new Date(),
      createdBy: session.user.id,
    };

    prescriptions = await Prescription.create(prescriptionData);
  }

  // Synchronize linked appointment status to completed
  if (parsed.data.appointment) {
    try {
      const { Appointment } = await import("@/models/clinical.model");
      const targetApt = await Appointment.findById(parsed.data.appointment);
      if (targetApt && !["completed", "cancelled", "no_show", "archived"].includes(targetApt.status)) {
        targetApt.status = "completed";
        targetApt.completedAt = new Date();
        await targetApt.save();
      }
    } catch {
      // Silently catch status update error so EMR creation is never blocked
    }
  }

  // Populate the created EMR
  const populated = await EMR.findById(emr._id)
    .populate("patient", "firstName lastName patientId")
    .populate({ path: "doctor", populate: { path: "user", select: "firstName lastName" } })
    .populate("createdBy", "firstName lastName")
    .lean();

  await auditLog({
    userId: session.user.id,
    action: "create",
    module: "emr",
    description: `Created EMR for patient ${parsed.data.patient}`,
    resourceId: emr._id.toString(),
    ipAddress: getIpFromHeaders(req.headers),
  });

  return apiSuccess({
    emr: populated,
    prescriptions: prescriptions,
  }, "EMR record created successfully", 201);
}