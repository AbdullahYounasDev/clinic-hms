import { NextRequest } from "next/server";
import { requirePatientSession } from "@/lib/auth/require-portal";
import connectDB from "@/lib/db/mongoose";
import { Appointment } from "@/models/clinical.model";
import { apiSuccess, apiError, getPaginationParams, buildPagination, applyAppointmentStatusFilter } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const authResult = await requirePatientSession();
  if (authResult.error) return authResult.error;

  await connectDB();
  const sp = req.nextUrl.searchParams;
  const { page, limit, skip } = getPaginationParams(sp);

  const filter: Record<string, unknown> = { patient: authResult.patientId };
  applyAppointmentStatusFilter(filter, "");

  const [appointments, total] = await Promise.all([
    Appointment.find(filter)
      .populate({ path: "doctor", populate: { path: "user", select: "firstName lastName" }, select: "doctorId specialization" })
      .populate("department", "name code")
      .sort({ scheduledDate: -1, scheduledTime: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Appointment.countDocuments(filter),
  ]);

  return apiSuccess(appointments, "Appointments fetched", 200, buildPagination(total, page, limit));
}
