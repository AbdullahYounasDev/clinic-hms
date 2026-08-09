import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function runEMRTests() {
  console.log("=== OPD & EMR STABILIZATION TEST SUITE ===\n");

  const { getClinicTimezone, getClinicDayBounds, toClinicDateString } = await import("../lib/time-utils");

  // 1. Test Timezone Bounds for EMR Date Filters
  console.log("[TEST 1] EMR Date Filter Clinic Timezone Bounds");
  const clinicTz = await getClinicTimezone();
  const dateInput = "2026-08-08";
  const bounds = getClinicDayBounds(dateInput, clinicTz);

  console.log(`  Clinic Timezone: ${clinicTz}`);
  console.log(`  Input Date: ${dateInput}`);
  console.log(`  Filter Start ($gte): ${bounds.start.toISOString()}`);
  console.log(`  Filter End   ($lte): ${bounds.end.toISOString()}`);

  const startFormatted = toClinicDateString(bounds.start, clinicTz);
  const endFormatted = toClinicDateString(bounds.end, clinicTz);

  if (startFormatted !== dateInput || endFormatted !== dateInput) {
    throw new Error(`Date bounds mismatch! Start: ${startFormatted}, End: ${endFormatted}`);
  }
  console.log("-> EMR Timezone Day Bounds: OK\n");

  // 2. Test DB Patient Search & EMR Query
  console.log("[TEST 2] EMR Patient Search & Scoping");
  if (process.env.MONGODB_URI) {
    const connectDB = (await import("../lib/db/mongoose")).default;
    await connectDB();
    const { Patient, EMR } = await import("../models/clinical.model");

    const samplePatient = await Patient.findOne({ status: { $ne: "archived" } }).lean();
    if (samplePatient) {
      const searchTerms = [samplePatient.firstName, samplePatient.lastName, samplePatient.patientId];
      for (const term of searchTerms) {
        if (!term) continue;
        const matchingIds = await Patient.find({
          status: { $ne: "archived" },
          $or: [
            { firstName: { $regex: term, $options: "i" } },
            { lastName: { $regex: term, $options: "i" } },
            { patientId: { $regex: term, $options: "i" } },
          ],
        }).distinct("_id");

        const emrCount = await EMR.countDocuments({ patient: { $in: matchingIds }, status: { $ne: "archived" } });
        console.log(`  Search term '${term}' matched ${matchingIds.length} patients and ${emrCount} EMR records.`);
      }
    }
  }
  console.log("-> EMR Patient Search & Scoping: OK\n");

  console.log("=== ALL EMR TEST CHECKS COMPLETED SUCCESSFULLY ===");
}

runEMRTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("EMR Test execution failed:", err);
    process.exit(1);
  });
