import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function runTests() {
  console.log("=== APPOINTMENT DATE STABILIZATION TEST SUITE ===\n");

  const { getClinicTimezone, getClinicDateString, getClinicDayBounds, toClinicDateString, toClinicNoonDate } = await import("../lib/time-utils");
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

  if (!bounds.start || !bounds.end || bounds.start >= bounds.end) {
    throw new Error("Day bounds calculation failed!");
  }
  console.log("-> Timezone Utilities: OK\n");

  // 2. Test Date Conversion Immunity (No Previous-Day Shift)
  console.log("[TEST 2] Date Conversion Immunity & Formatting");
  const noonDate = toClinicNoonDate("2026-08-05");
  console.log(`  toClinicNoonDate("2026-08-05"): ${noonDate.toISOString()}`);
  if (noonDate.toISOString() !== "2026-08-05T12:00:00.000Z") {
    throw new Error("toClinicNoonDate did not return 12:00:00.000Z!");
  }

  // Test converting 19:00:00Z (00:00 PKT Aug 5) and 12:00:00Z to YYYY-MM-DD
  const legacyPktMidnightDate = "2026-08-04T19:00:00.000Z";
  const extractedDate1 = toClinicDateString(legacyPktMidnightDate, clinicTz);
  const extractedDate2 = toClinicDateString(noonDate, clinicTz);

  console.log(`  Legacy PKT midnight ("2026-08-04T19:00:00.000Z") -> toClinicDateString: "${extractedDate1}"`);
  console.log(`  UTC Noon ("2026-08-05T12:00:00.000Z") -> toClinicDateString: "${extractedDate2}"`);

  if (extractedDate1 !== "2026-08-05" || extractedDate2 !== "2026-08-05") {
    throw new Error("Date extraction failed! Produced previous-day shift.");
  }

  const formattedDisplay = formatDate(noonDate, "MMMM D, YYYY");
  console.log(`  formatDate("2026-08-05T12:00:00.000Z", "MMMM D, YYYY"): "${formattedDisplay}"`);

  if (formattedDisplay !== "August 5, 2026") {
    throw new Error("formatDate failed! Expected 'August 5, 2026'.");
  }
  console.log("-> Date Conversion Immunity: OK\n");

  // 3. Test DB Connection & Queue Service Date Bounds
  if (process.env.MONGODB_URI) {
    console.log("[TEST 3] Database Connection & Queue Service Date Bounds");
    const connectDB = (await import("../lib/db/mongoose")).default;
    await connectDB();

    const { getDateRange } = await import("../services/queue.service");
    const queueBounds = getDateRange(dateStr, clinicTz);
    console.log(`  Queue Bounds Start: ${queueBounds.start.toISOString()}`);
    console.log(`  Queue Bounds End:   ${queueBounds.end.toISOString()}`);

    if (!queueBounds.start || !queueBounds.end) {
      throw new Error("Queue date range calculation failed!");
    }
    console.log("-> Database Connection & Queue Service: OK\n");
  } else {
    console.log("  (Skipping DB tests since MONGODB_URI is not set in local env)\n");
  }

  console.log("=== ALL TEST CHECKS COMPLETED SUCCESSFULLY ===");
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
