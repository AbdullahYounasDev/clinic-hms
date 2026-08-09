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

  // 3. Fallback: Raw 1D barcode or single identifier string
  result.barcode = trimmed;
  return result;
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
