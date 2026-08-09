import * as dotenv from "dotenv";
import * as path from "path";
import dns from "dns";

try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch {
  // ignore
}

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function runStaffEmployeeIdTests() {
  console.log("=== STAFF EMPLOYEE ID ATOMIC STABILIZATION TEST ===\n");

  const { getNextEmployeeId } = await import("../models/counter.model");

  // 1. Test Atomic Counter format
  console.log("[TEST 1] Testing Employee ID Format (EMP-XXXXX)");
  const empId1 = await getNextEmployeeId();
  const empId2 = await getNextEmployeeId();
  console.log(`  Employee ID 1: ${empId1}`);
  console.log(`  Employee ID 2: ${empId2}`);

  if (!/^EMP-\d{5}$/.test(empId1) || !/^EMP-\d{5}$/.test(empId2)) {
    throw new Error(`Invalid Employee ID format generated: ${empId1}, ${empId2}`);
  }
  console.log("-> Atomic Counter Formats: OK\n");

  // 2. Test Concurrent Generation for Duplicates
  console.log("[TEST 2] Testing Concurrent Employee ID Generation");
  const concurrentCalls = await Promise.all([
    getNextEmployeeId(),
    getNextEmployeeId(),
    getNextEmployeeId(),
    getNextEmployeeId(),
    getNextEmployeeId(),
  ]);

  console.log("  Concurrent Employee IDs generated:", concurrentCalls);
  const uniqueCount = new Set(concurrentCalls).size;
  if (uniqueCount !== concurrentCalls.length) {
    throw new Error("Duplicate Employee IDs were generated during concurrent calls!");
  }
  console.log("-> Concurrent Generation & Uniqueness: OK\n");

  console.log("=== ALL STAFF EMPLOYEE ID TESTS COMPLETED SUCCESSFULLY ===");
}

runStaffEmployeeIdTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Staff Employee ID Test failed:", err);
    process.exit(1);
  });
