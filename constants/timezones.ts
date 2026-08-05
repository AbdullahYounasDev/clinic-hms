// constants/timezones.ts
import { isValidIANATimezone } from "@/lib/time-utils";

export interface TimezoneOption {
  value: string;
  label: string;
  region: string;
}

export interface TimezoneGroup {
  region: string;
  options: TimezoneOption[];
}

export const TIMEZONE_GROUPS: TimezoneGroup[] = [
  {
    region: "Asia",
    options: [
      { value: "Asia/Karachi", label: "Asia/Karachi — Pakistan Time", region: "Asia" },
      { value: "Asia/Riyadh", label: "Asia/Riyadh — Arabia Standard Time", region: "Asia" },
      { value: "Asia/Dubai", label: "Asia/Dubai — Gulf Standard Time", region: "Asia" },
      { value: "Asia/Kolkata", label: "Asia/Kolkata — India Standard Time", region: "Asia" },
      { value: "Asia/Dhaka", label: "Asia/Dhaka — Bangladesh Standard Time", region: "Asia" },
      { value: "Asia/Colombo", label: "Asia/Colombo — Sri Lanka Standard Time", region: "Asia" },
      { value: "Asia/Kathmandu", label: "Asia/Kathmandu — Nepal Time", region: "Asia" },
      { value: "Asia/Bangkok", label: "Asia/Bangkok — Indochina Time", region: "Asia" },
      { value: "Asia/Singapore", label: "Asia/Singapore — Singapore Time", region: "Asia" },
      { value: "Asia/Kuala_Lumpur", label: "Asia/Kuala_Lumpur — Malaysia Time", region: "Asia" },
      { value: "Asia/Jakarta", label: "Asia/Jakarta — Western Indonesia Time", region: "Asia" },
      { value: "Asia/Manila", label: "Asia/Manila — Philippine Standard Time", region: "Asia" },
      { value: "Asia/Tokyo", label: "Asia/Tokyo — Japan Standard Time", region: "Asia" },
      { value: "Asia/Seoul", label: "Asia/Seoul — Korea Standard Time", region: "Asia" },
      { value: "Asia/Shanghai", label: "Asia/Shanghai — China Standard Time", region: "Asia" },
      { value: "Asia/Hong_Kong", label: "Asia/Hong_Kong — Hong Kong Time", region: "Asia" },
      { value: "Asia/Taipei", label: "Asia/Taipei — Taiwan Time", region: "Asia" },
      { value: "Asia/Tehran", label: "Asia/Tehran — Iran Standard Time", region: "Asia" },
      { value: "Asia/Baghdad", label: "Asia/Baghdad — Arabian Standard Time", region: "Asia" },
      { value: "Asia/Amman", label: "Asia/Amman — Eastern European Time", region: "Asia" },
      { value: "Asia/Beirut", label: "Asia/Beirut — Eastern European Time", region: "Asia" },
      { value: "Asia/Tashkent", label: "Asia/Tashkent — Uzbekistan Time", region: "Asia" },
      { value: "Asia/Almaty", label: "Asia/Almaty — Kazakhstan Time", region: "Asia" },
    ],
  },
  {
    region: "Europe",
    options: [
      { value: "Europe/London", label: "Europe/London — Greenwich / British Time", region: "Europe" },
      { value: "Europe/Berlin", label: "Europe/Berlin — Central European Time", region: "Europe" },
      { value: "Europe/Paris", label: "Europe/Paris — Central European Time", region: "Europe" },
      { value: "Europe/Rome", label: "Europe/Rome — Central European Time", region: "Europe" },
      { value: "Europe/Madrid", label: "Europe/Madrid — Central European Time", region: "Europe" },
      { value: "Europe/Amsterdam", label: "Europe/Amsterdam — Central European Time", region: "Europe" },
      { value: "Europe/Brussels", label: "Europe/Brussels — Central European Time", region: "Europe" },
      { value: "Europe/Vienna", label: "Europe/Vienna — Central European Time", region: "Europe" },
      { value: "Europe/Zurich", label: "Europe/Zurich — Central European Time", region: "Europe" },
      { value: "Europe/Budapest", label: "Europe/Budapest — Central European Time", region: "Europe" },
      { value: "Europe/Warsaw", label: "Europe/Warsaw — Central European Time", region: "Europe" },
      { value: "Europe/Prague", label: "Europe/Prague — Central European Time", region: "Europe" },
      { value: "Europe/Stockholm", label: "Europe/Stockholm — Central European Time", region: "Europe" },
      { value: "Europe/Oslo", label: "Europe/Oslo — Central European Time", region: "Europe" },
      { value: "Europe/Copenhagen", label: "Europe/Copenhagen — Central European Time", region: "Europe" },
      { value: "Europe/Dublin", label: "Europe/Dublin — Greenwich / Irish Time", region: "Europe" },
      { value: "Europe/Lisbon", label: "Europe/Lisbon — Western European Time", region: "Europe" },
      { value: "Europe/Athens", label: "Europe/Athens — Eastern European Time", region: "Europe" },
      { value: "Europe/Bucharest", label: "Europe/Bucharest — Eastern European Time", region: "Europe" },
      { value: "Europe/Helsinki", label: "Europe/Helsinki — Eastern European Time", region: "Europe" },
      { value: "Europe/Kiev", label: "Europe/Kiev — Eastern European Time", region: "Europe" },
      { value: "Europe/Istanbul", label: "Europe/Istanbul — Turkey Time", region: "Europe" },
      { value: "Europe/Moscow", label: "Europe/Moscow — Moscow Standard Time", region: "Europe" },
    ],
  },
  {
    region: "North America",
    options: [
      { value: "America/New_York", label: "America/New_York — Eastern Time", region: "North America" },
      { value: "America/Chicago", label: "America/Chicago — Central Time", region: "North America" },
      { value: "America/Denver", label: "America/Denver — Mountain Time", region: "North America" },
      { value: "America/Phoenix", label: "America/Phoenix — Mountain Standard Time", region: "North America" },
      { value: "America/Los_Angeles", label: "America/Los_Angeles — Pacific Time", region: "North America" },
      { value: "America/Anchorage", label: "America/Anchorage — Alaska Time", region: "North America" },
      { value: "America/Adak", label: "America/Adak — Hawaii-Aleutian Time", region: "North America" },
      { value: "Pacific/Honolulu", label: "Pacific/Honolulu — Hawaii Standard Time", region: "North America" },
      { value: "America/Toronto", label: "America/Toronto — Eastern Time", region: "North America" },
      { value: "America/Vancouver", label: "America/Vancouver — Pacific Time", region: "North America" },
      { value: "America/Edmonton", label: "America/Edmonton — Mountain Time", region: "North America" },
      { value: "America/Winnipeg", label: "America/Winnipeg — Central Time", region: "North America" },
      { value: "America/Halifax", label: "America/Halifax — Atlantic Time", region: "North America" },
      { value: "America/St_Johns", label: "America/St_Johns — Newfoundland Time", region: "North America" },
      { value: "America/Mexico_City", label: "America/Mexico_City — Central Time", region: "North America" },
      { value: "America/Monterrey", label: "America/Monterrey — Central Time", region: "North America" },
      { value: "America/Tijuana", label: "America/Tijuana — Pacific Time", region: "North America" },
    ],
  },
  {
    region: "Central America & Caribbean",
    options: [
      { value: "America/Guatemala", label: "America/Guatemala — Central America Time", region: "Central America & Caribbean" },
      { value: "America/Costa_Rica", label: "America/Costa_Rica — Central America Time", region: "Central America & Caribbean" },
      { value: "America/Panama", label: "America/Panama — Eastern Standard Time", region: "Central America & Caribbean" },
      { value: "America/El_Salvador", label: "America/El_Salvador — Central America Time", region: "Central America & Caribbean" },
      { value: "America/Tegucigalpa", label: "America/Tegucigalpa — Central America Time", region: "Central America & Caribbean" },
      { value: "America/Managua", label: "America/Managua — Central America Time", region: "Central America & Caribbean" },
      { value: "America/Havana", label: "America/Havana — Cuba Standard Time", region: "Central America & Caribbean" },
      { value: "America/Santo_Domingo", label: "America/Santo_Domingo — Atlantic Standard Time", region: "Central America & Caribbean" },
      { value: "America/Puerto_Rico", label: "America/Puerto_Rico — Atlantic Standard Time", region: "Central America & Caribbean" },
      { value: "America/Jamaica", label: "America/Jamaica — Eastern Standard Time", region: "Central America & Caribbean" },
    ],
  },
  {
    region: "South America",
    options: [
      { value: "America/Sao_Paulo", label: "America/Sao_Paulo — Brasilia Time", region: "South America" },
      { value: "America/Buenos_Aires", label: "America/Buenos_Aires — Argentina Time", region: "South America" },
      { value: "America/Santiago", label: "America/Santiago — Chile Time", region: "South America" },
      { value: "America/Bogota", label: "America/Bogota — Colombia Time", region: "South America" },
      { value: "America/Lima", label: "America/Lima — Peru Time", region: "South America" },
      { value: "America/Caracas", label: "America/Caracas — Venezuela Time", region: "South America" },
      { value: "America/Montevideo", label: "America/Montevideo — Uruguay Time", region: "South America" },
      { value: "America/Asuncion", label: "America/Asuncion — Paraguay Time", region: "South America" },
      { value: "America/La_Paz", label: "America/La_Paz — Bolivia Time", region: "South America" },
      { value: "America/Guayaquil", label: "America/Guayaquil — Ecuador Time", region: "South America" },
    ],
  },
  {
    region: "Africa",
    options: [
      { value: "Africa/Cairo", label: "Africa/Cairo — Eastern European Time", region: "Africa" },
      { value: "Africa/Johannesburg", label: "Africa/Johannesburg — South Africa Standard Time", region: "Africa" },
      { value: "Africa/Lagos", label: "Africa/Lagos — West Africa Time", region: "Africa" },
      { value: "Africa/Nairobi", label: "Africa/Nairobi — East Africa Time", region: "Africa" },
      { value: "Africa/Casablanca", label: "Africa/Casablanca — Western European Time", region: "Africa" },
      { value: "Africa/Algiers", label: "Africa/Algiers — Central European Time", region: "Africa" },
      { value: "Africa/Tunis", label: "Africa/Tunis — Central European Time", region: "Africa" },
      { value: "Africa/Addis_Ababa", label: "Africa/Addis_Ababa — East Africa Time", region: "Africa" },
      { value: "Africa/Accra", label: "Africa/Accra — Greenwich Mean Time", region: "Africa" },
      { value: "Africa/Abidjan", label: "Africa/Abidjan — Greenwich Mean Time", region: "Africa" },
      { value: "Africa/Dar_es_Salaam", label: "Africa/Dar_es_Salaam — East Africa Time", region: "Africa" },
      { value: "Africa/Harare", label: "Africa/Harare — Central Africa Time", region: "Africa" },
    ],
  },
  {
    region: "Australia & Pacific",
    options: [
      { value: "Australia/Sydney", label: "Australia/Sydney — Australian Eastern Time", region: "Australia & Pacific" },
      { value: "Australia/Melbourne", label: "Australia/Melbourne — Australian Eastern Time", region: "Australia & Pacific" },
      { value: "Australia/Brisbane", label: "Australia/Brisbane — Australian Eastern Standard Time", region: "Australia & Pacific" },
      { value: "Australia/Adelaide", label: "Australia/Adelaide — Australian Central Time", region: "Australia & Pacific" },
      { value: "Australia/Perth", label: "Australia/Perth — Australian Western Time", region: "Australia & Pacific" },
      { value: "Australia/Darwin", label: "Australia/Darwin — Australian Central Standard Time", region: "Australia & Pacific" },
      { value: "Australia/Hobart", label: "Australia/Hobart — Australian Eastern Time", region: "Australia & Pacific" },
      { value: "Pacific/Auckland", label: "Pacific/Auckland — New Zealand Time", region: "Australia & Pacific" },
      { value: "Pacific/Fiji", label: "Pacific/Fiji — Fiji Time", region: "Australia & Pacific" },
      { value: "Pacific/Port_Moresby", label: "Pacific/Port_Moresby — Papua New Guinea Time", region: "Australia & Pacific" },
      { value: "Pacific/Guam", label: "Pacific/Guam — Chamorro Standard Time", region: "Australia & Pacific" },
      { value: "Pacific/Tahiti", label: "Pacific/Tahiti — Tahiti Time", region: "Australia & Pacific" },
    ],
  },
  {
    region: "Atlantic",
    options: [
      { value: "Atlantic/Reykjavik", label: "Atlantic/Reykjavik — Greenwich Mean Time", region: "Atlantic" },
      { value: "Atlantic/Bermuda", label: "Atlantic/Bermuda — Atlantic Time", region: "Atlantic" },
      { value: "Atlantic/Azores", label: "Atlantic/Azores — Azores Time", region: "Atlantic" },
      { value: "Atlantic/Canary", label: "Atlantic/Canary — Western European Time", region: "Atlantic" },
      { value: "Atlantic/Cape_Verde", label: "Atlantic/Cape_Verde — Cape Verde Time", region: "Atlantic" },
    ],
  },
  {
    region: "Indian Ocean",
    options: [
      { value: "Indian/Maldives", label: "Indian/Maldives — Maldives Time", region: "Indian Ocean" },
      { value: "Indian/Mauritius", label: "Indian/Mauritius — Mauritius Time", region: "Indian Ocean" },
      { value: "Indian/Reunion", label: "Indian/Reunion — Reunion Time", region: "Indian Ocean" },
      { value: "Indian/Mahe", label: "Indian/Mahe — Seychelles Time", region: "Indian Ocean" },
      { value: "Indian/Antananarivo", label: "Indian/Antananarivo — East Africa Time (Madagascar)", region: "Indian Ocean" },
    ],
  },
  {
    region: "Antarctica",
    options: [
      { value: "Antarctica/McMurdo", label: "Antarctica/McMurdo — New Zealand Time", region: "Antarctica" },
      { value: "Antarctica/Casey", label: "Antarctica/Casey — Australian Western Time", region: "Antarctica" },
      { value: "Antarctica/Palmer", label: "Antarctica/Palmer — Chile Time", region: "Antarctica" },
    ],
  },
  {
    region: "UTC / Universal",
    options: [
      { value: "UTC", label: "UTC — Coordinated Universal Time", region: "UTC / Universal" },
    ],
  },
];

/**
 * Returns timezone groups for UI dropdown rendering.
 * If a custom/legacy saved value is valid IANA but not present in the curated list,
 * it is safely injected so the user's saved value is preserved without silent loss.
 */
export function getAllTimezoneOptions(currentValue?: string | null): TimezoneGroup[] {
  if (!currentValue || !isValidIANATimezone(currentValue)) {
    return TIMEZONE_GROUPS;
  }

  const exists = TIMEZONE_GROUPS.some((g) => g.options.some((opt) => opt.value === currentValue));
  if (exists) {
    return TIMEZONE_GROUPS;
  }

  // Inject custom saved IANA timezone under a dedicated group to prevent value loss
  const customGroup: TimezoneGroup = {
    region: "Custom / Additional Timezones",
    options: [
      {
        value: currentValue,
        label: `${currentValue} — Custom Selected Timezone`,
        region: "Custom / Additional Timezones",
      },
    ],
  };

  return [...TIMEZONE_GROUPS, customGroup];
}
