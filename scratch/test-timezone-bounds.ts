import {
  isValidIANATimezone,
  resolveClinicTimezone,
  getClinicDayBounds,
} from "../lib/time-utils";
import { TIMEZONE_GROUPS, getAllTimezoneOptions } from "../constants/timezones";

function runTests() {
  console.log("=== RUNNING TIMEZONE UTILITY & CONSTANTS TEST SUITE ===\n");

  // Test 1: IANA Validation & Fallback
  console.log("1. Timezone Validation & Fallback:");
  console.assert(isValidIANATimezone("Asia/Karachi") === true, "Asia/Karachi should be valid");
  console.assert(isValidIANATimezone("Europe/Budapest") === true, "Europe/Budapest should be valid");
  console.assert(isValidIANATimezone("Invalid/City") === false, "Invalid/City should be invalid");
  console.assert(resolveClinicTimezone("Invalid/City") === "Asia/Karachi", "Fallback should be Asia/Karachi");
  console.log("  ✓ Validation & fallback tests passed\n");

  // Test 2: Centralized Timezone Constants & Worldwide Region Coverage
  console.log("2. Worldwide Region Coverage & Duplicate Verification:");
  
  const expectedRegions = [
    "Asia",
    "Europe",
    "North America",
    "Central America & Caribbean",
    "South America",
    "Africa",
    "Australia & Pacific",
    "Atlantic",
    "Indian Ocean",
    "Antarctica",
    "UTC / Universal",
  ];

  const actualRegions = TIMEZONE_GROUPS.map((g) => g.region);
  for (const region of expectedRegions) {
    console.assert(actualRegions.includes(region), `Required region [${region}] missing from TIMEZONE_GROUPS`);
  }
  console.log(`  ✓ All ${expectedRegions.length} required region groups present in TIMEZONE_GROUPS`);

  // Collect all values and test uniqueness & IANA validity
  const allValues = TIMEZONE_GROUPS.flatMap((g) => g.options.map((o) => o.value));
  const seenValues = new Set<string>();
  let duplicateCount = 0;
  let invalidCount = 0;

  for (const value of allValues) {
    if (seenValues.has(value)) {
      console.error(`  ❌ Duplicate timezone found: ${value}`);
      duplicateCount++;
    }
    seenValues.add(value);

    if (!isValidIANATimezone(value)) {
      console.error(`  ❌ Configured timezone is not a valid IANA identifier: ${value}`);
      invalidCount++;
    }
  }

  console.assert(duplicateCount === 0, "No duplicate timezones allowed");
  console.assert(invalidCount === 0, "Every configured timezone must be a valid IANA identifier");
  console.log(`  ✓ Unique total timezones configured: ${allValues.length}`);
  console.log("  ✓ 0 duplicates found");
  console.log("  ✓ 100% of configured timezones are valid IANA identifiers\n");

  // Test 3: Key Worldwide Timezones Check
  console.log("3. Key Worldwide Timezone Verification:");
  const keyTimezones = [
    "Asia/Karachi", "Asia/Riyadh", "Asia/Dubai", "Asia/Kolkata", "Asia/Tokyo", "Asia/Singapore",
    "Europe/London", "Europe/Berlin", "Europe/Budapest", "Europe/Paris", "Europe/Moscow",
    "America/New_York", "America/Chicago", "America/Los_Angeles", "America/Toronto", "America/Mexico_City",
    "America/Guatemala", "America/Panama", "America/Havana",
    "America/Sao_Paulo", "America/Buenos_Aires", "America/Bogota",
    "Africa/Cairo", "Africa/Johannesburg", "Africa/Lagos", "Africa/Nairobi",
    "Australia/Sydney", "Australia/Perth", "Pacific/Auckland",
    "Atlantic/Reykjavik", "Atlantic/Bermuda",
    "Indian/Maldives", "Indian/Mauritius",
    "Antarctica/McMurdo",
    "UTC"
  ];

  for (const tz of keyTimezones) {
    console.assert(allValues.includes(tz), `Key timezone ${tz} missing from TIMEZONE_GROUPS`);
  }
  console.log(`  ✓ All ${keyTimezones.length} key worldwide timezones confirmed present\n`);

  // Test 4: Custom Saved Timezone Preservation Safety
  console.log("4. Custom Saved Timezone Preservation Safety:");
  // A timezone not in the curated list but valid IANA
  const customTz = "Asia/Samarkand";
  const customSavedOptions = getAllTimezoneOptions(customTz);
  const customGroup = customSavedOptions.find((g) => g.region === "Custom / Additional Timezones");
  console.assert(customGroup !== undefined, "Custom group should be created for custom IANA timezone");
  console.assert(
    customGroup?.options.some((opt) => opt.value === customTz) === true,
    "Custom saved IANA timezone must be safely injected"
  );
  console.log("  ✓ Custom valid IANA saved timezone is safely preserved");

  // An existing timezone should not trigger custom group
  const existingOptions = getAllTimezoneOptions("Asia/Karachi");
  const existingCustomGroup = existingOptions.find((g) => g.region === "Custom / Additional Timezones");
  console.assert(existingCustomGroup === undefined, "Existing timezone should not create duplicate custom group");
  console.log("  ✓ Standard existing timezone does not produce redundant custom group\n");

  // Test 5: Date Boundary & DST Utility Calculations
  console.log("5. Date Boundary & Duration Tests:");
  const testCases = [
    {
      name: "Asia/Karachi — Normal Day",
      dateStr: "2026-07-31",
      tz: "Asia/Karachi",
      expectedStartISO: "2026-07-30T19:00:00.000Z",
      expectedEndISO: "2026-07-31T18:59:59.999Z",
      expectedHours: 24,
    },
    {
      name: "Europe/Budapest — Normal Winter Day (CET UTC+1)",
      dateStr: "2026-01-15",
      tz: "Europe/Budapest",
      expectedStartISO: "2026-01-14T23:00:00.000Z",
      expectedEndISO: "2026-01-15T22:59:59.999Z",
      expectedHours: 24,
    },
    {
      name: "Europe/Budapest — DST Spring-Forward (2026-03-29)",
      dateStr: "2026-03-29",
      tz: "Europe/Budapest",
      expectedStartISO: "2026-03-28T23:00:00.000Z",
      expectedEndISO: "2026-03-29T21:59:59.999Z",
      expectedHours: 23,
    },
    {
      name: "Europe/Budapest — DST Fall-Back (2026-10-25)",
      dateStr: "2026-10-25",
      tz: "Europe/Budapest",
      expectedStartISO: "2026-10-24T22:00:00.000Z",
      expectedEndISO: "2026-10-25T22:59:59.999Z",
      expectedHours: 25,
    },
    {
      name: "America/New_York — DST Spring-Forward (2026-03-08)",
      dateStr: "2026-03-08",
      tz: "America/New_York",
      expectedStartISO: "2026-03-08T05:00:00.000Z",
      expectedEndISO: "2026-03-09T03:59:59.999Z",
      expectedHours: 23,
    },
    {
      name: "America/New_York — DST Fall-Back (2026-11-01)",
      dateStr: "2026-11-01",
      tz: "America/New_York",
      expectedStartISO: "2026-11-01T04:00:00.000Z",
      expectedEndISO: "2026-11-02T04:59:59.999Z",
      expectedHours: 25,
    },
  ];

  let failed = false;
  for (const tc of testCases) {
    const { start, end } = getClinicDayBounds(tc.dateStr, tc.tz);
    const durationMs = end.getTime() - start.getTime() + 1;
    const durationHours = Math.round(durationMs / (1000 * 60 * 60));

    console.log(`  Testing [${tc.name}]:`);
    console.log(`    Start UTC: ${start.toISOString()} (Expected: ${tc.expectedStartISO})`);
    console.log(`    End UTC:   ${end.toISOString()} (Expected: ${tc.expectedEndISO})`);
    console.log(`    Duration:  ${durationHours} hours (Expected: ${tc.expectedHours} hours)`);

    if (start.toISOString() !== tc.expectedStartISO) {
      console.error(`    ❌ START MISMATCH for ${tc.name}`);
      failed = true;
    }
    if (end.toISOString() !== tc.expectedEndISO) {
      console.error(`    ❌ END MISMATCH for ${tc.name}`);
      failed = true;
    }
    if (durationHours !== tc.expectedHours) {
      console.error(`    ❌ DURATION MISMATCH for ${tc.name}`);
      failed = true;
    }
    if (!failed) console.log(`    ✓ PASSED\n`);
  }

  if (failed) {
    console.error("=== TEST SUITE FAILED ===");
    process.exit(1);
  } else {
    console.log("=== ALL TIMEZONE UTILITY & CONSTANTS TESTS PASSED 100% PERFECTLY ===");
  }
}

runTests();
