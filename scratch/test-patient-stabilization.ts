import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function runTests() {
  console.log("=== PATIENT MODULE STABILIZATION TEST SUITE ===\n");

  const { formatCNIC, normalizeCNIC, isValidCNIC } = await import("../lib/utils/cnic-utils");
  const { findPortalPatientByLogin } = await import("../lib/auth/patient-portal");
  const { updatePatientSchema } = await import("../lib/validations");

  // 1. Test CNIC Utilities
  console.log("[TEST 1] CNIC Utilities (Formatting, Normalization, Validation)");
  const rawCnic = "3410426117161";
  const formattedCnic = formatCNIC(rawCnic);
  const normalizedBack = normalizeCNIC(formattedCnic);
  const validCheck = isValidCNIC(formattedCnic);
  const invalidCheck = isValidCNIC("34104-26117"); // Only 10 digits

  console.log(`  Raw input: "${rawCnic}" -> Formatted: "${formattedCnic}"`);
  console.log(`  Formatted input: "${formattedCnic}" -> Normalized: "${normalizedBack}"`);
  console.log(`  Valid CNIC check (13 digits): ${validCheck === true ? "PASS" : "FAIL"}`);
  console.log(`  Invalid CNIC check (10 digits): ${invalidCheck === false ? "PASS" : "FAIL"}`);

  if (rawCnic !== normalizedBack || formattedCnic !== "34104-2611716-1" || !validCheck || invalidCheck) {
    throw new Error("CNIC utilities test failed!");
  }
  console.log("-> CNIC Utilities: OK\n");

  // 2. Test Optional Reset Password Validation in Update Patient Schema
  console.log("[TEST 2] Optional Reset Password Validation");
  const emptyPasswordParse = updatePatientSchema.safeParse({
    firstName: "Jane",
    lastName: "Doe",
    gender: "female",
    dateOfBirth: "1995-05-15",
    phone: "+92 300 1112233",
    portalPassword: "",
  });
  console.log(`  Empty portalPassword parse result: ${emptyPasswordParse.success ? "PASS (Valid)" : "FAIL"}`);

  const invalidPasswordParse = updatePatientSchema.safeParse({
    firstName: "Jane",
    lastName: "Doe",
    gender: "female",
    dateOfBirth: "1995-05-15",
    phone: "+92 300 1112233",
    portalPassword: "short",
  });
  console.log(`  Short portalPassword parse result: ${!invalidPasswordParse.success ? "PASS (Rejected short password)" : "FAIL"}`);

  if (!emptyPasswordParse.success || invalidPasswordParse.success) {
    throw new Error("Optional Reset Password validation test failed!");
  }
  console.log("-> Optional Reset Password Validation: OK\n");

  // 3. Test Atomic Sequence Generator
  console.log("[TEST 3] Atomic Sequence Generator");
  if (process.env.MONGODB_URI) {
    const connectDB = (await import("../lib/db/mongoose")).default;
    const { getNextSequenceValue } = await import("../models/counter.model");
    await connectDB();
    const seq1 = await getNextSequenceValue("test_patient_seq");
    const seq2 = await getNextSequenceValue("test_patient_seq");
    console.log(`  Seq 1: ${seq1}, Seq 2: ${seq2}`);
    if (seq2 !== seq1 + 1) {
      throw new Error("Atomic sequence generator failed to increment!");
    }
    console.log("-> Atomic Sequence Generator: OK\n");

    // 4. Test Portal Email-Only Authentication
    console.log("[TEST 4] Portal Email-Only Authentication Lookup");
    const phoneAttempt = await findPortalPatientByLogin("+923001234567");
    console.log(`  Phone login attempt result: ${phoneAttempt === null ? "REJECTED (Correct)" : "FAILED"}`);
    if (phoneAttempt !== null) {
      throw new Error("Portal authentication allowed phone login!");
    }
    console.log("-> Portal Email-Only Auth: OK\n");
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
