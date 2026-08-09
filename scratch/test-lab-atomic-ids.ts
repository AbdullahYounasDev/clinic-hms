import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function runLabAtomicTests() {
  console.log("=== LABORATORY ATOMIC ID STABILIZATION TEST ===\n");

  const { getNextLabTestId, getNextReportId } = await import("../models/counter.model");

  // 1. Test Atomic Counter functions
  console.log("[TEST 1] Testing Atomic Counter ID Format");
  const labId1 = await getNextLabTestId();
  const labId2 = await getNextLabTestId();
  console.log(`  Lab Order ID 1: ${labId1}`);
  console.log(`  Lab Order ID 2: ${labId2}`);

  if (!/^LAB-\d{6}$/.test(labId1) || !/^LAB-\d{6}$/.test(labId2)) {
    throw new Error(`Invalid LAB ID format generated: ${labId1}, ${labId2}`);
  }

  const reportId1 = await getNextReportId();
  const reportId2 = await getNextReportId();
  console.log(`  Report ID 1: ${reportId1}`);
  console.log(`  Report ID 2: ${reportId2}`);

  if (!/^RPT-\d{6}$/.test(reportId1) || !/^RPT-\d{6}$/.test(reportId2)) {
    throw new Error(`Invalid Report ID format generated: ${reportId1}, ${reportId2}`);
  }
  console.log("-> Atomic Counter Formats: OK\n");

  // 2. Test Concurrent Generation for Duplicates
  console.log("[TEST 2] Testing Concurrent Atomic Counter Calls");
  const concurrentCalls = await Promise.all([
    getNextLabTestId(),
    getNextLabTestId(),
    getNextLabTestId(),
    getNextLabTestId(),
    getNextLabTestId(),
  ]);

  console.log("  Concurrent Lab Test IDs generated:", concurrentCalls);
  const uniqueCount = new Set(concurrentCalls).size;
  if (uniqueCount !== concurrentCalls.length) {
    throw new Error("Duplicate Lab Test IDs were generated during concurrent calls!");
  }
  console.log("-> Concurrent Generation & Uniqueness: OK\n");

  console.log("=== ALL LAB ATOMIC ID TESTS COMPLETED SUCCESSFULLY ===");
}

runLabAtomicTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Lab Atomic ID Test execution failed:", err);
    process.exit(1);
  });
