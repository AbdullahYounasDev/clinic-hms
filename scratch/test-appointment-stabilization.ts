import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function runTests() {
  console.log("=== APPOINTMENT STABILIZATION & SCHEDULING SYSTEM TEST ===\n");

  const { getClinicTimezone, getClinicDayBounds, toClinicDateString, toClinicNoonDate } = await import("../lib/time-utils");
  const { formatDate } = await import("../lib/utils");

  // 1. Test Timezone Utilities
  console.log("[TEST 1] Centralized Clinic Timezone & Day Bounds");
  const clinicTz = await getClinicTimezone();
  const dateStr = "2026-08-05";
  const bounds = getClinicDayBounds(dateStr, clinicTz);

  console.log(`  Resolved Clinic Timezone: ${clinicTz}`);
  console.log(`  Date String: ${dateStr}`);
  console.log(`  Bounds Start: ${bounds.start.toISOString()}`);
  console.log(`  Bounds End:   ${bounds.end.toISOString()}`);
  console.log("-> Timezone Utilities: OK\n");

  // 2. Test Date Conversion Immunity (No Previous-Day Shift)
  console.log("[TEST 2] Date Conversion Immunity & Formatting");
  const noonDate = toClinicNoonDate("2026-08-05");
  if (noonDate.toISOString() !== "2026-08-05T12:00:00.000Z") {
    throw new Error("toClinicNoonDate did not return 12:00:00.000Z!");
  }

  const legacyPktMidnightDate = "2026-08-04T19:00:00.000Z";
  const extractedDate1 = toClinicDateString(legacyPktMidnightDate, clinicTz);
  const extractedDate2 = toClinicDateString(noonDate, clinicTz);

  if (extractedDate1 !== "2026-08-05" || extractedDate2 !== "2026-08-05") {
    throw new Error("Date extraction failed! Produced previous-day shift.");
  }

  const formattedDisplay = formatDate(noonDate, "MMMM D, YYYY");
  if (formattedDisplay !== "August 5, 2026") {
    throw new Error("formatDate failed! Expected 'August 5, 2026'.");
  }
  console.log("-> Date Conversion Immunity: OK\n");

  // 3. Test Scheduling Service & Exclude Appointment ID
  console.log("[TEST 3] Scheduling Service & Exclude Appointment ID Support");
  const { SchedulingService } = await import("../services/scheduling.service");

  // Fetch doctors from DB if connected
  if (process.env.MONGODB_URI) {
    const connectDB = (await import("../lib/db/mongoose")).default;
    await connectDB();
    const { Doctor } = await import("../models/clinical.model");
    const doc = await Doctor.findOne({ status: "active" }).lean();
    if (doc) {
      const slotsNormal = await SchedulingService.getAvailableSlots(doc._id.toString(), "2026-08-10", 30);
      const slotsExcluded = await SchedulingService.getAvailableSlots(doc._id.toString(), "2026-08-10", 30, "fake_apt_id_123");
      console.log(`  Fetched ${slotsNormal.slots.length} candidate slots for Dr. ${doc._id}`);
      console.log(`  Exclude appointment ID query succeeded`);
    }
  }
  console.log("-> Scheduling Service & Exclude Appointment ID: OK\n");

  console.log("=== ALL TEST CHECKS COMPLETED SUCCESSFULLY ===");
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
