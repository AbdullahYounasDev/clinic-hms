// lib/utils/barcode-parser.ts

export interface ParsedBarcodeData {
  barcode?: string;
  name?: string;
  genericName?: string;
  category?: string;
  batchNumber?: string;
  expiryDate?: string; // YYYY-MM-DD
  unitCost?: number;
  sellingPrice?: number;
  unit?: string;
  manufacturer?: string;
  storageCondition?: string;
  storageLocation?: string;
}

/**
 * Normalizes and parses raw scanned text from 1D barcodes or structured 2D QR codes.
 * Accepts simple code strings, JSON objects, or key=value / query-string formats.
 */
export function parseBarcodeData(rawText: string): ParsedBarcodeData {
  if (!rawText || typeof rawText !== "string") return {};
  const trimmed = rawText.trim();
  if (!trimmed) return {};

  const result: ParsedBarcodeData = {};

  // 1. Try parsing as JSON
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      const obj = JSON.parse(trimmed);
      if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
        extractFromObject(obj, result);
        if (Object.keys(result).length > 0) {
          if (!result.barcode) result.barcode = trimmed;
          return result;
        }
      }
    } catch {
      // ignore json parse error
    }
  }

  // 2. Try parsing as Key-Value Query String (e.g. name=Panadol&price=150&batch=B123&expiry=2027-05-31)
  if (trimmed.includes("=") || trimmed.includes("&") || trimmed.includes(";")) {
    const params = new URLSearchParams(trimmed.replace(/;/g, "&"));
    const obj: Record<string, string> = {};
    params.forEach((val, key) => {
      obj[key.trim()] = val.trim();
    });
    extractFromObject(obj, result);
    if (Object.keys(result).length > 0) {
      if (!result.barcode) result.barcode = obj.code || obj.barcode || trimmed;
      return result;
    }
  }

  // 3. Try parsing as GS1 DataMatrix (e.g. (01)08901234567890(17)261231(10)BATCH123 or raw AI format)
  const gs1Parsed = parseGS1DataMatrix(trimmed);
  if (gs1Parsed && (gs1Parsed.barcode || gs1Parsed.batchNumber || gs1Parsed.expiryDate)) {
    return gs1Parsed;
  }

  // 4. Fallback: Raw 1D barcode or single identifier string
  result.barcode = trimmed;
  return result;
}

/**
 * Parses GS1 formatted DataMatrix strings (with parenthesized AIs or FNC1 separators).
 * Example: (01)08901234567890(17)261231(10)BATCH123
 */
function parseGS1DataMatrix(rawText: string): ParsedBarcodeData | null {
  // Strip standard symbology identifier prefix like ]d2 or \u001d if present
  let cleanText = rawText.replace(/^\]d\d/i, "").replace(/^\u001d/, "");

  const result: ParsedBarcodeData = {};

  // Case A: Parenthesized AIs like (01)08901234567890(17)261231(10)B101
  if (cleanText.includes("(") && cleanText.includes(")")) {
    const aiMatches = cleanText.matchAll(/\((\d{2,4})\)([^(]+)/g);
    let matchedAny = false;
    for (const match of aiMatches) {
      const ai = match[1];
      const val = match[2].trim();
      matchedAny = true;
      applyGS1Ai(ai, val, result);
    }
    if (matchedAny) return result;
  }

  // Case B: Raw concatenated GS1 AI stream (e.g. 01089012345678901726123110BATCH123)
  if (cleanText.startsWith("01") && cleanText.length >= 16) {
    result.barcode = cleanText.slice(2, 16);
    let rest = cleanText.slice(16);

    // Check for AI 17 (Expiry YYMMDD)
    if (rest.startsWith("17") && rest.length >= 8) {
      const yymmdd = rest.slice(2, 8);
      if (/^\d{6}$/.test(yymmdd)) {
        const yy = parseInt(yymmdd.slice(0, 2), 10);
        const mm = yymmdd.slice(2, 4);
        const dd = yymmdd.slice(4, 6);
        const year = yy >= 50 ? 1900 + yy : 2000 + yy;
        result.expiryDate = `${year}-${mm}-${dd}`;
        rest = rest.slice(8);
      }
    }

    // Check for AI 10 (Batch number)
    if (rest.startsWith("10") && rest.length > 2) {
      // Split by FNC1/separator if present or take up to 20 chars
      const batchPart = rest.slice(2).split(/[\u001d;]/)[0];
      result.batchNumber = batchPart.slice(0, 20);
    }

    return result;
  }

  return null;
}

function applyGS1Ai(ai: string, val: string, result: ParsedBarcodeData) {
  if (ai === "01" || ai === "02") {
    result.barcode = val;
  } else if (ai === "17") {
    // Expiration date in YYMMDD format
    if (/^\d{6}$/.test(val)) {
      const yy = parseInt(val.slice(0, 2), 10);
      const mm = val.slice(2, 4);
      const dd = val.slice(4, 6);
      const year = yy >= 50 ? 1900 + yy : 2000 + yy;
      result.expiryDate = `${year}-${mm}-${dd}`;
    }
  } else if (ai === "10") {
    result.batchNumber = val;
  }
}

function extractFromObject(obj: Record<string, any>, result: ParsedBarcodeData) {
  const findVal = (keys: string[]): any => {
    for (const k of keys) {
      for (const prop of Object.keys(obj)) {
        if (
          prop.toLowerCase().replace(/[^a-z0-9]/g, "") ===
          k.toLowerCase().replace(/[^a-z0-9]/g, "")
        ) {
          return obj[prop];
        }
      }
    }
    return undefined;
  };

  const barcodeVal = findVal(["barcode", "code", "productcode", "itemcode", "sku", "gtin", "id", "productid"]);
  if (barcodeVal != null) result.barcode = String(barcodeVal).trim();

  const nameVal = findVal(["name", "medicinename", "productname", "title"]);
  if (nameVal != null) result.name = String(nameVal).trim();

  const genericVal = findVal(["genericname", "generic", "composition"]);
  if (genericVal != null) result.genericName = String(genericVal).trim();

  const catVal = findVal(["category", "type"]);
  if (catVal != null) result.category = String(catVal).trim();

  const batchVal = findVal(["batch", "batchnumber", "lot", "lotnumber"]);
  if (batchVal != null) result.batchNumber = String(batchVal).trim();

  const expVal = findVal(["expiry", "expirydate", "expirationdate", "expdate", "exp"]);
  if (expVal != null) {
    const expStr = String(expVal).trim();
    const dateMatch = expStr.match(/\d{4}-\d{2}-\d{2}/);
    if (dateMatch) {
      result.expiryDate = dateMatch[0];
    } else {
      const parsedDate = new Date(expStr);
      if (!isNaN(parsedDate.getTime())) {
        result.expiryDate = parsedDate.toISOString().split("T")[0];
      }
    }
  }

  const costVal = findVal(["unitcost", "cost", "purchaseprice", "buyingprice"]);
  if (costVal !== undefined && !isNaN(Number(costVal))) result.unitCost = Number(costVal);

  const priceVal = findVal(["sellingprice", "price", "mrp"]);
  if (priceVal !== undefined && !isNaN(Number(priceVal))) result.sellingPrice = Number(priceVal);

  const unitVal = findVal(["unit", "packaging", "form"]);
  if (unitVal != null) result.unit = String(unitVal).trim();

  const mfgVal = findVal(["manufacturer", "company", "brand"]);
  if (mfgVal != null) result.manufacturer = String(mfgVal).trim();

  const condVal = findVal(["storagecondition", "condition"]);
  if (condVal != null) result.storageCondition = String(condVal).trim();

  const locVal = findVal(["storageLocation", "location"]);
  if (locVal != null) result.storageLocation = String(locVal).trim();
}
