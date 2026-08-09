import mongoose from "mongoose";
import connectDB from "@/lib/db/mongoose";
import { Doctor, Appointment } from "@/models/clinical.model";
import { Settings } from "@/models/operations.model";
import { SlotInfo, SlotResult, DaySchedule, WeeklySchedule } from "@/types";
import {
  timeToMinutes,
  minutesToTime,
  minutesToDisplayTime,
  normalizeTimeString,
  getWeekdayKey,
  formatDateYYYYMMDD,
} from "@/lib/time-utils";

export {
  timeToMinutes,
  minutesToTime,
  minutesToDisplayTime,
  normalizeTimeString,
  getWeekdayKey,
  formatDateYYYYMMDD,
};

// ─── SCHEDULING SERVICE ───────────────────────────────────

export class SchedulingService {
  /**
   * Calculate all appointment slots for a given doctor and date.
   */
  static async getAvailableSlots(
    doctorId: string,
    dateInput: string | Date,
    requestedDuration?: number,
    excludeAppointmentId?: string
  ): Promise<SlotResult> {
    await connectDB();

    let targetDate: Date;
    let dateStr: string;

    if (typeof dateInput === "string") {
      const parts = dateInput.split("-").map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
        dateStr = dateInput;
      } else {
        targetDate = new Date(dateInput);
        dateStr = formatDateYYYYMMDD(targetDate);
      }
    } else {
      targetDate = dateInput;
      dateStr = formatDateYYYYMMDD(dateInput);
    }

    const weekdayKey = getWeekdayKey(targetDate);

    // 1. Fetch Clinic Settings
    const settings = await Settings.findOne({}).lean();
    const defaultDuration = settings?.appointmentDuration || 30;

    // Check Clinic Closing Days / Holidays
    if (settings?.closingDays && settings.closingDays.length > 0) {
      const holiday = settings.closingDays.find((cd) => cd.date === dateStr);
      if (holiday) {
        return {
          doctorId,
          date: dateStr,
          appointmentDuration: defaultDuration,
          isWorkingDay: false,
          isHoliday: true,
          holidayReason: holiday.reason || "Clinic Holiday",
          isOnLeave: false,
          slots: [],
        };
      }
    }

    // Check Clinic Working Days
    let clinicIsOpen = true;
    let clinicOpenTime = "08:00";
    let clinicCloseTime = "20:00";

    if (settings?.workingDays && settings.workingDays.length > 0) {
      const daySetting = settings.workingDays.find(
        (wd) => wd.day.toLowerCase() === weekdayKey
      );
      if (!daySetting || daySetting.isOpen === false) {
        clinicIsOpen = false;
      } else {
        if (daySetting.openingTime) clinicOpenTime = daySetting.openingTime;
        if (daySetting.closingTime) clinicCloseTime = daySetting.closingTime;
      }
    }

    if (!clinicIsOpen) {
      return {
        doctorId,
        date: dateStr,
        appointmentDuration: defaultDuration,
        isWorkingDay: false,
        isHoliday: false,
        holidayReason: "Clinic is closed on this day",
        isOnLeave: false,
        slots: [],
      };
    }

    // 2. Fetch Doctor Profile
    const doctor = await Doctor.findById(doctorId).lean();

    if (!doctor || doctor.status === "archived" || !doctor.isAvailable) {
      return {
        doctorId,
        date: dateStr,
        appointmentDuration: defaultDuration,
        isWorkingDay: false,
        isHoliday: false,
        isOnLeave: false,
        slots: [],
      };
    }

    const baseDuration = doctor.appointmentDuration || defaultDuration;
    const activeDuration = requestedDuration && requestedDuration > 0 ? requestedDuration : baseDuration;
    const stepDuration = Math.min(baseDuration, activeDuration);

    // Check Doctor Leave
    if (doctor.leaves && doctor.leaves.length > 0) {
      const startOfDayTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
      const endOfDayTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

      const activeLeave = doctor.leaves.find((leave) => {
        const lStartStr = formatDateYYYYMMDD(new Date(leave.startDate));
        const lEndStr = formatDateYYYYMMDD(new Date(leave.endDate));
        return dateStr >= lStartStr && dateStr <= lEndStr;
      });

      if (activeLeave) {
        return {
          doctorId,
          date: dateStr,
          appointmentDuration: activeDuration,
          isWorkingDay: false,
          isHoliday: false,
          isOnLeave: true,
          leaveReason: activeLeave.reason || "Doctor is on leave",
          slots: [],
        };
      }
    }

    // Check Doctor Schedule for weekday
    let docDaySchedule: DaySchedule | null = null;
    if (doctor.weeklySchedule && doctor.weeklySchedule[weekdayKey]) {
      docDaySchedule = doctor.weeklySchedule[weekdayKey] as DaySchedule;
    } else if (doctor.availability && doctor.availability[weekdayKey]) {
      const legacy = doctor.availability[weekdayKey] as { isWorking: boolean; slots?: { start: string; end: string }[] };
      docDaySchedule = {
        isWorking: legacy.isWorking,
        startTime: legacy.slots?.[0]?.start || clinicOpenTime,
        endTime: legacy.slots?.[0]?.end || clinicCloseTime,
      };
    } else {
      const isWeekend = weekdayKey === "saturday" || weekdayKey === "sunday";
      docDaySchedule = {
        isWorking: !isWeekend,
        startTime: "09:00",
        endTime: "17:00",
      };
    }

    if (!docDaySchedule || !docDaySchedule.isWorking) {
      return {
        doctorId,
        date: dateStr,
        appointmentDuration: activeDuration,
        isWorkingDay: false,
        isHoliday: false,
        isOnLeave: false,
        slots: [],
      };
    }

    const docStartMins = timeToMinutes(docDaySchedule.startTime || "09:00");
    const docEndMins = timeToMinutes(docDaySchedule.endTime || "17:00");

    const breakStartMins = docDaySchedule.breakStart ? timeToMinutes(docDaySchedule.breakStart) : null;
    const breakEndMins = docDaySchedule.breakEnd ? timeToMinutes(docDaySchedule.breakEnd) : null;

    // 3. Query existing booked appointments for this doctor on targetDate (with 1-day timezone margin)
    const searchStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() - 1, 0, 0, 0, 0);
    const searchEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1, 23, 59, 59, 999);

    const filter: Record<string, unknown> = {
      doctor: doctorId,
      scheduledDate: { $gte: searchStart, $lte: searchEnd },
      status: { $in: ["scheduled", "checked_in", "in_consultation", "completed"] },
    };

    if (excludeAppointmentId && mongoose.Types.ObjectId.isValid(excludeAppointmentId)) {
      filter._id = { $ne: excludeAppointmentId };
    }

    const existingAppointments = await Appointment.find(filter).select("scheduledDate scheduledTime duration").lean();

    const bookedIntervals: Array<{ start: number; end: number }> = [];
    for (const appt of existingAppointments) {
      if (appt.scheduledDate && appt.scheduledTime) {
        const apptDateStr = formatDateYYYYMMDD(new Date(appt.scheduledDate));
        if (apptDateStr === dateStr) {
          const apptStart = timeToMinutes(appt.scheduledTime);
          const apptEnd = apptStart + (appt.duration || baseDuration);
          bookedIntervals.push({ start: apptStart, end: apptEnd });
        }
      }
    }

    // Determine current time for past slot checking in Clinic Timezone (if date is today)
    const { resolveClinicTimezone, getClinicDateString } = await import("@/lib/time-utils");
    const clinicTz = resolveClinicTimezone(settings?.timezone);
    const todayStr = getClinicDateString(new Date(), clinicTz);
    const isToday = dateStr === todayStr;

    const nowClinicStr = new Intl.DateTimeFormat("en-US", {
      timeZone: clinicTz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
    const [nowH, nowM] = nowClinicStr.split(":").map(Number);
    const currentNowMins = (nowH % 24) * 60 + (nowM || 0);

    // 4. Generate candidate start times with post-appointment alignment
    const candidateTimesSet = new Set<number>();
    const gridStep = Math.min(10, activeDuration);

    for (let cur = docStartMins; cur + activeDuration <= docEndMins; cur += gridStep) {
      candidateTimesSet.add(cur);
    }

    // Add exact end times of all booked appointments as candidate start times
    for (const b of bookedIntervals) {
      if (b.end >= docStartMins && b.end + activeDuration <= docEndMins) {
        candidateTimesSet.add(b.end);
      }
    }

    const candidateTimes = Array.from(candidateTimesSet).sort((a, b) => a - b);
    const slots: SlotInfo[] = [];

    for (const cur of candidateTimes) {
      const slot24 = minutesToTime(cur);
      const slotDisplay = minutesToDisplayTime(cur);
      const candidateEnd = cur + activeDuration;

      let available = true;
      let reason: SlotInfo["reason"] = undefined;
      let reasonText: string | undefined = undefined;

      // Check Doctor Break Interval Overlap
      if (breakStartMins !== null && breakEndMins !== null && breakStartMins < breakEndMins) {
        if (cur < breakEndMins && candidateEnd > breakStartMins) {
          available = false;
          reason = "break";
          reasonText = "Doctor Break";
        }
      }

      // Check Past Time
      if (available && isToday && cur <= currentNowMins) {
        available = false;
        reason = "past_time";
        reasonText = "Past Time";
      }

      // Check Booked Appointment Interval Collision
      if (available) {
        const isBooked = bookedIntervals.some((b) => cur < b.end && candidateEnd > b.start);
        if (isBooked) {
          available = false;
          reason = "booked";
          reasonText = "Already Booked";
        }
      }

      slots.push({
        time: slot24,
        displayTime: slotDisplay,
        available,
        reason,
        reasonText,
      });
    }

    return {
      doctorId,
      date: dateStr,
      appointmentDuration: activeDuration,
      isWorkingDay: true,
      isHoliday: false,
      isOnLeave: false,
      slots,
    };
  }

  /**
   * Validate a Doctor's weekly schedule against clinic operating hours.
   */
  static async validateDoctorSchedule(
    schedule: WeeklySchedule,
    settings?: Record<string, unknown> | null
  ): Promise<{ valid: boolean; error?: string }> {
    await connectDB();
    const clinicSettings = settings || (await Settings.findOne({}).lean());

    if (!clinicSettings?.workingDays) {
      return { valid: true };
    }

    const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

    for (const day of weekdays) {
      const docDay = schedule[day];
      if (!docDay || !docDay.isWorking) continue;

      const clinicDay = (clinicSettings.workingDays as Array<{ day: string; openingTime: string; closingTime: string; isOpen?: boolean }>).find(
        (wd) => wd.day.toLowerCase() === day
      );

      if (!clinicDay || clinicDay.isOpen === false) {
        return {
          valid: false,
          error: `Cannot set doctor working hours for ${day.toUpperCase()}: Clinic is closed on ${day.toUpperCase()}`,
        };
      }

      const docStart = timeToMinutes(docDay.startTime || "09:00");
      const docEnd = timeToMinutes(docDay.endTime || "17:00");
      const docStartDisp = minutesToDisplayTime(docStart);
      const docEndDisp = minutesToDisplayTime(docEnd);

      if (docStart >= docEnd) {
        return {
          valid: false,
          error: `${day.toUpperCase()}: Doctor start time (${docStartDisp}) must be earlier than end time (${docEndDisp})`,
        };
      }

      if (clinicDay) {
        const clinicOpen = timeToMinutes(clinicDay.openingTime);
        const clinicClose = timeToMinutes(clinicDay.closingTime);
        const clinicOpenDisp = minutesToDisplayTime(clinicOpen);
        const clinicCloseDisp = minutesToDisplayTime(clinicClose);

        if (docStart < clinicOpen) {
          return {
            valid: false,
            error: `${day.toUpperCase()}: Doctor start time (${docStartDisp}) cannot be earlier than clinic opening time (${clinicOpenDisp})`,
          };
        }

        if (docEnd > clinicClose) {
          return {
            valid: false,
            error: `${day.toUpperCase()}: Doctor end time (${docEndDisp}) cannot be later than clinic closing time (${clinicCloseDisp})`,
          };
        }
      }

      if (docDay.breakStart && docDay.breakEnd) {
        const bStart = timeToMinutes(docDay.breakStart);
        const bEnd = timeToMinutes(docDay.breakEnd);
        const bStartDisp = minutesToDisplayTime(bStart);
        const bEndDisp = minutesToDisplayTime(bEnd);

        if (bStart >= bEnd) {
          return {
            valid: false,
            error: `${day.toUpperCase()}: Break start time (${bStartDisp}) must be earlier than break end time (${bEndDisp})`,
          };
        }

        if (bStart < docStart || bEnd > docEnd) {
          return {
            valid: false,
            error: `${day.toUpperCase()}: Doctor break (${bStartDisp} - ${bEndDisp}) must fall inside doctor working hours (${docStartDisp} - ${docEndDisp})`,
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Comprehensive validation prior to saving an appointment.
   */
  static async validateAppointmentBooking(data: {
    doctor: string;
    scheduledDate: string;
    scheduledTime: string;
    duration?: number;
    type?: string;
    excludeAppointmentId?: string;
  }): Promise<{ valid: boolean; error?: string }> {
    const slotResult = await this.getAvailableSlots(
      data.doctor,
      data.scheduledDate,
      data.duration,
      data.excludeAppointmentId
    );

    if (slotResult.isHoliday) {
      return {
        valid: false,
        error: `Cannot book appointment: Selected date is a clinic holiday (${slotResult.holidayReason || "Closed"})`,
      };
    }

    if (slotResult.isOnLeave) {
      return {
        valid: false,
        error: `Cannot book appointment: Doctor is on leave on this date (${slotResult.leaveReason || "On Leave"})`,
      };
    }

    if (!slotResult.isWorkingDay) {
      return {
        valid: false,
        error: "Cannot book appointment: Doctor is not scheduled to work on this day",
      };
    }

    const normTime = normalizeTimeString(data.scheduledTime);
    const targetSlot = slotResult.slots.find((s) => s.time === normTime);

    if (!targetSlot) {
      return {
        valid: false,
        error: `Selected time (${data.scheduledTime}) is outside doctor's working schedule`,
      };
    }

    if (!targetSlot.available) {
      const reasonMsg = targetSlot.reasonText || "Time slot is unavailable";
      return {
        valid: false,
        error: `Cannot book slot ${targetSlot.displayTime}: ${reasonMsg}`,
      };
    }

    return { valid: true };
  }

  /**
   * Check for existing appointments that conflict with proposed doctor leave dates.
   */
  static async checkLeaveConflicts(
    doctorId: string,
    startDateInput: string | Date,
    endDateInput: string | Date
  ): Promise<{ conflictCount: number; appointments: Array<{ id: string; appointmentId: string; date: Date; time: string; patientName: string }> }> {
    await connectDB();
    const { getClinicTimezone, getClinicDayBounds, toClinicDateString } = await import("@/lib/time-utils");
    const clinicTz = await getClinicTimezone();
    const sDateStr = toClinicDateString(startDateInput, clinicTz);
    const eDateStr = toClinicDateString(endDateInput, clinicTz);
    const sStart = getClinicDayBounds(sDateStr, clinicTz).start;
    const eEnd = getClinicDayBounds(eDateStr, clinicTz).end;

    const conflicting = await Appointment.find({
      doctor: doctorId,
      scheduledDate: { $gte: sStart, $lte: eEnd },
      status: { $in: ["scheduled", "checked_in"] },
    })
      .populate("patient", "firstName lastName patientId")
      .lean();

    const result = conflicting.map((a: any) => ({
      id: a._id.toString(),
      appointmentId: a.appointmentId,
      date: a.scheduledDate,
      time: a.scheduledTime,
      patientName: a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : "Unknown Patient",
    }));

    return {
      conflictCount: result.length,
      appointments: result,
    };
  }
}
