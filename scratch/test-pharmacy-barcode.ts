import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function runPharmacyBarcodeTests() {
  console.log("=== PHARMACY BARCODE & QR STABILIZATION TEST SUITE ===\n");

  const { parseBarcodeData } = await import("../lib/utils/barcode-parser");

  // 1. Test 1D Barcode Parsing
  console.log("[TEST 1] Testing 1D Raw Barcode Input");
  const parsed1D = parseBarcodeData("08901234567890");
  console.log("  Input: '08901234567890'");
  console.log("  Parsed:", parsed1D);
  if (parsed1D.barcode !== "08901234567890") {
    throw new Error("1D Barcode parsing failed!");
  }
  console.log("-> 1D Barcode Parsing: OK\n");

  // 2. Test Key-Value Structured QR Code Parsing
  console.log("[TEST 2] Testing Key-Value Structured QR Code Input");
  const rawQuery = "name=Panadol 500mg&genericName=Paracetamol&category=Analgesic&price=150&batch=B-9988&expiry=2027-12-31&code=889900112233";
  const parsedQuery = parseBarcodeData(rawQuery);
  console.log("  Input:", rawQuery);
  console.log("  Parsed:", parsedQuery);

  if (
    parsedQuery.barcode !== "889900112233" ||
    parsedQuery.name !== "Panadol 500mg" ||
    parsedQuery.genericName !== "Paracetamol" ||
    parsedQuery.category !== "Analgesic" ||
    parsedQuery.sellingPrice !== 150 ||
    parsedQuery.batchNumber !== "B-9988" ||
    parsedQuery.expiryDate !== "2027-12-31"
  ) {
    throw new Error("Structured QR Key-Value Parsing failed!");
  }
  console.log("-> Key-Value QR Code Parsing: OK\n");

  // 3. Test Structured JSON QR Code Parsing
  console.log("[TEST 3] Testing Structured JSON QR Code Input");
  const rawJSON = JSON.stringify({
    medicinename: "Amoxil 250mg",
    composition: "Amoxicillin",
    category: "Antibiotic",
    mrp: 280,
    cost: 200,
    lotNumber: "LOT-5544",
    expDate: "2028-06-15",
    gtin: "998877665544",
    unit: "capsule"
  });

  const parsedJSON = parseBarcodeData(rawJSON);
  console.log("  Input:", rawJSON);
  console.log("  Parsed:", parsedJSON);

  if (
    parsedJSON.barcode !== "998877665544" ||
    parsedJSON.name !== "Amoxil 250mg" ||
    parsedJSON.genericName !== "Amoxicillin" ||
    parsedJSON.category !== "Antibiotic" ||
    parsedJSON.sellingPrice !== 280 ||
    parsedJSON.unitCost !== 200 ||
    parsedJSON.batchNumber !== "LOT-5544" ||
    parsedJSON.expiryDate !== "2028-06-15" ||
    parsedJSON.unit !== "capsule"
  ) {
    throw new Error("Structured JSON QR Code Parsing failed!");
  }
  console.log("-> Structured JSON QR Code Parsing: OK\n");

  console.log("=== ALL PHARMACY BARCODE & QR TESTS COMPLETED SUCCESSFULLY ===");
}

runPharmacyBarcodeTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Pharmacy Barcode Test failed:", err);
    process.exit(1);
  });
