// components/settings/timezone-picker.tsx
"use client";

import { useState, useRef, useEffect, useMemo, useId } from "react";
import { Search, Check, ChevronDown, Globe, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllTimezoneOptions, TimezoneOption, TimezoneGroup } from "@/constants/timezones";

const COUNTRY_MAP: Record<string, string[]> = {
  "Asia/Karachi": ["Pakistan", "Karachi", "PK", "Lahore", "Islamabad"],
  "Asia/Riyadh": ["Saudi Arabia", "Riyadh", "KSA", "Jeddah", "Mecca"],
  "Asia/Dubai": ["United Arab Emirates", "UAE", "Dubai", "Abu Dhabi"],
  "Asia/Kolkata": ["India", "Kolkata", "Delhi", "Mumbai", "Bangalore", "Chennai"],
  "Asia/Dhaka": ["Bangladesh", "Dhaka", "Chittagong"],
  "Asia/Colombo": ["Sri Lanka", "Colombo"],
  "Asia/Kathmandu": ["Nepal", "Kathmandu"],
  "Asia/Bangkok": ["Thailand", "Vietnam", "Bangkok", "Hanoi", "Ho Chi Minh"],
  "Asia/Singapore": ["Singapore"],
  "Asia/Kuala_Lumpur": ["Malaysia", "Kuala Lumpur"],
  "Asia/Jakarta": ["Indonesia", "Jakarta"],
  "Asia/Manila": ["Philippines", "Manila"],
  "Asia/Tokyo": ["Japan", "Tokyo", "Osaka"],
  "Asia/Seoul": ["South Korea", "Korea", "Seoul"],
  "Asia/Shanghai": ["China", "Shanghai", "Beijing"],
  "Asia/Hong_Kong": ["Hong Kong", "China"],
  "Asia/Taipei": ["Taiwan", "Taipei"],
  "Asia/Tehran": ["Iran", "Tehran"],
  "Asia/Baghdad": ["Iraq", "Baghdad"],
  "Asia/Amman": ["Jordan", "Amman"],
  "Asia/Beirut": ["Lebanon", "Beirut"],
  "Asia/Tashkent": ["Uzbekistan", "Tashkent"],
  "Asia/Almaty": ["Kazakhstan", "Almaty", "Astana"],

  "Europe/London": ["United Kingdom", "UK", "Great Britain", "England", "London"],
  "Europe/Berlin": ["Germany", "Deutschland", "Berlin", "Munich", "Frankfurt"],
  "Europe/Paris": ["France", "Paris"],
  "Europe/Rome": ["Italy", "Italia", "Rome", "Milan"],
  "Europe/Madrid": ["Spain", "Espana", "Madrid", "Barcelona"],
  "Europe/Amsterdam": ["Netherlands", "Holland", "Amsterdam"],
  "Europe/Brussels": ["Belgium", "Brussels"],
  "Europe/Vienna": ["Austria", "Vienna"],
  "Europe/Zurich": ["Switzerland", "Zurich", "Geneva"],
  "Europe/Budapest": ["Hungary", "Budapest"],
  "Europe/Warsaw": ["Poland", "Warsaw"],
  "Europe/Prague": ["Czech Republic", "Czechia", "Prague"],
  "Europe/Stockholm": ["Sweden", "Stockholm"],
  "Europe/Oslo": ["Norway", "Oslo"],
  "Europe/Copenhagen": ["Denmark", "Copenhagen"],
  "Europe/Dublin": ["Ireland", "Dublin"],
  "Europe/Lisbon": ["Portugal", "Lisbon"],
  "Europe/Athens": ["Greece", "Athens"],
  "Europe/Bucharest": ["Romania", "Bucharest"],
  "Europe/Helsinki": ["Finland", "Helsinki"],
  "Europe/Kiev": ["Ukraine", "Kiev", "Kyiv"],
  "Europe/Istanbul": ["Turkey", "Turkiye", "Istanbul", "Ankara"],
  "Europe/Moscow": ["Russia", "Moscow"],

  "America/New_York": ["United States", "USA", "US", "New York", "NY"],
  "America/Chicago": ["United States", "USA", "US", "Chicago", "Illinois", "IL"],
  "America/Denver": ["United States", "USA", "US", "Denver", "Colorado", "CO"],
  "America/Phoenix": ["United States", "USA", "US", "Phoenix", "Arizona", "AZ"],
  "America/Los_Angeles": ["United States", "USA", "US", "Los Angeles", "California", "CA"],
  "America/Anchorage": ["United States", "USA", "US", "Alaska", "Anchorage"],
  "America/Adak": ["United States", "USA", "US", "Aleutian", "Adak"],
  "Pacific/Honolulu": ["United States", "USA", "US", "Hawaii", "Honolulu"],
  "America/Toronto": ["Canada", "Toronto", "Ontario"],
  "America/Vancouver": ["Canada", "Vancouver", "British Columbia"],
  "America/Edmonton": ["Canada", "Edmonton", "Alberta"],
  "America/Winnipeg": ["Canada", "Winnipeg", "Manitoba"],
  "America/Halifax": ["Canada", "Halifax", "Nova Scotia"],
  "America/St_Johns": ["Canada", "St. John's", "Newfoundland"],
  "America/Mexico_City": ["Mexico", "Mexico City"],
  "America/Monterrey": ["Mexico", "Monterrey"],
  "America/Tijuana": ["Mexico", "Tijuana"],

  "America/Guatemala": ["Guatemala", "Guatemala City"],
  "America/Costa_Rica": ["Costa Rica", "San Jose"],
  "America/Panama": ["Panama", "Panama City"],
  "America/El_Salvador": ["El Salvador", "San Salvador"],
  "America/Tegucigalpa": ["Honduras", "Tegucigalpa"],
  "America/Managua": ["Nicaragua", "Managua"],
  "America/Havana": ["Cuba", "Havana"],
  "America/Santo_Domingo": ["Dominican Republic", "Santo Domingo"],
  "America/Puerto_Rico": ["Puerto Rico", "San Juan"],
  "America/Jamaica": ["Jamaica", "Kingston"],

  "America/Sao_Paulo": ["Brazil", "Brasil", "Sao Paulo", "Rio de Janeiro"],
  "America/Buenos_Aires": ["Argentina", "Buenos Aires"],
  "America/Santiago": ["Chile", "Santiago"],
  "America/Bogota": ["Colombia", "Bogota"],
  "America/Lima": ["Peru", "Lima"],
  "America/Caracas": ["Venezuela", "Caracas"],
  "America/Montevideo": ["Uruguay", "Montevideo"],
  "America/Asuncion": ["Paraguay", "Asuncion"],
  "America/La_Paz": ["Bolivia", "La Paz"],
  "America/Guayaquil": ["Ecuador", "Guayaquil", "Quito"],

  "Africa/Cairo": ["Egypt", "Cairo"],
  "Africa/Johannesburg": ["South Africa", "Johannesburg", "Cape Town"],
  "Africa/Lagos": ["Nigeria", "Lagos", "Abuja"],
  "Africa/Nairobi": ["Kenya", "Nairobi"],
  "Africa/Casablanca": ["Morocco", "Casablanca", "Rabat"],
  "Africa/Algiers": ["Algeria", "Algiers"],
  "Africa/Tunis": ["Tunisia", "Tunis"],
  "Africa/Addis_Ababa": ["Ethiopia", "Addis Ababa"],
  "Africa/Accra": ["Ghana", "Accra"],
  "Africa/Abidjan": ["Ivory Coast", "Cote d'Ivoire", "Abidjan"],
  "Africa/Dar_es_Salaam": ["Tanzania", "Dar es Salaam"],
  "Africa/Harare": ["Zimbabwe", "Harare"],

  "Australia/Sydney": ["Australia", "Sydney", "New South Wales", "NSW"],
  "Australia/Melbourne": ["Australia", "Melbourne", "Victoria", "VIC"],
  "Australia/Brisbane": ["Australia", "Brisbane", "Queensland", "QLD"],
  "Australia/Adelaide": ["Australia", "Adelaide", "South Australia", "SA"],
  "Australia/Perth": ["Australia", "Perth", "Western Australia", "WA"],
  "Australia/Darwin": ["Australia", "Darwin", "Northern Territory", "NT"],
  "Australia/Hobart": ["Australia", "Hobart", "Tasmania", "TAS"],
  "Pacific/Auckland": ["New Zealand", "Auckland", "Wellington"],
  "Pacific/Fiji": ["Fiji", "Suva"],
  "Pacific/Port_Moresby": ["Papua New Guinea", "Port Moresby"],
  "Pacific/Guam": ["Guam"],
  "Pacific/Tahiti": ["French Polynesia", "Tahiti"],

  "Atlantic/Reykjavik": ["Iceland", "Reykjavik"],
  "Atlantic/Bermuda": ["Bermuda"],
  "Atlantic/Azores": ["Portugal", "Azores"],
  "Atlantic/Canary": ["Spain", "Canary Islands"],
  "Atlantic/Cape_Verde": ["Cape Verde", "Praia"],

  "Indian/Maldives": ["Maldives", "Male"],
  "Indian/Mauritius": ["Mauritius", "Port Louis"],
  "Indian/Reunion": ["Reunion", "France"],
  "Indian/Mahe": ["Seychelles", "Mahe", "Victoria"],
  "Indian/Antananarivo": ["Madagascar", "Antananarivo"],

  "Antarctica/McMurdo": ["Antarctica", "McMurdo"],
  "Antarctica/Casey": ["Antarctica", "Casey"],
  "Antarctica/Palmer": ["Antarctica", "Palmer"],
  "UTC": ["UTC", "Coordinated Universal Time", "GMT", "Greenwich"],
};

export interface TimezonePickerProps {
  value?: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  className?: string;
}

export function TimezonePicker({ value, onChange, disabled, className }: TimezonePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const isKeyboardNavRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Load all options including custom saved value if valid
  const timezoneGroups = useMemo(() => getAllTimezoneOptions(value), [value]);

  // Find currently selected option for summary trigger display
  const selectedOption = useMemo(() => {
    if (!value) return null;
    for (const group of timezoneGroups) {
      const match = group.options.find((opt) => opt.value === value);
      if (match) return match;
    }
    return { value, label: `${value} — Selected Timezone`, region: "Selected" };
  }, [value, timezoneGroups]);

  // Filter groups based on search input (City, Country, Region, IANA value, Label)
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return timezoneGroups;

    const result: TimezoneGroup[] = [];
    for (const group of timezoneGroups) {
      const matchesGroupRegion = group.region.toLowerCase().includes(q);
      const filteredOptions = group.options.filter((opt) => {
        if (matchesGroupRegion) return true;
        if (opt.value.toLowerCase().includes(q)) return true;
        if (opt.label.toLowerCase().includes(q)) return true;
        if (opt.value.replace(/_/g, " ").toLowerCase().includes(q)) return true;
        const aliases = COUNTRY_MAP[opt.value] || [];
        return aliases.some((alias) => alias.toLowerCase().includes(q));
      });

      if (filteredOptions.length > 0) {
        result.push({
          region: group.region,
          options: filteredOptions,
        });
      }
    }
    return result;
  }, [timezoneGroups, search]);

  // Flat list of visible options for arrow key navigation
  const visibleOptions = useMemo(() => {
    return filteredGroups.flatMap((g) => g.options);
  }, [filteredGroups]);

  // Reset highlighted index when search changes or dropdown opens
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search, isOpen]);

  // Scroll highlighted item into view (only during keyboard navigation)
  useEffect(() => {
    if (!isOpen || !listRef.current || !isKeyboardNavRef.current) return;
    const highlightedEl = listRef.current.querySelector<HTMLElement>(`[data-option-index="${highlightedIndex}"]`);
    if (highlightedEl) {
      highlightedEl.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 30);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        isKeyboardNavRef.current = true;
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      isKeyboardNavRef.current = true;
      setHighlightedIndex((prev) => (visibleOptions.length > 0 ? (prev + 1) % visibleOptions.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      isKeyboardNavRef.current = true;
      setHighlightedIndex((prev) => (visibleOptions.length > 0 ? (prev - 1 + visibleOptions.length) % visibleOptions.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (visibleOptions[highlightedIndex]) {
        handleSelect(visibleOptions[highlightedIndex].value);
      }
    }
  };

  // Helper index tracker for flat option rendering
  let globalOptionCounter = 0;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs text-left transition-colors cursor-pointer",
          "focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600",
          disabled ? "bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200" : "bg-white text-gray-800 border-gray-300 hover:border-gray-400"
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="truncate font-medium">
            {selectedOption ? selectedOption.label : "Select clinic timezone..."}
          </span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {/* Popover / Dropdown Menu */}
      {isOpen && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={() => {
            isKeyboardNavRef.current = false;
          }}
          className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden flex flex-col max-h-80 text-xs"
        >
          {/* Search Header */}
          <div className="p-2 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2 shrink-0">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search timezone, city, country, or region..."
              className="w-full bg-transparent text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none py-1"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="p-1 text-gray-400 hover:text-gray-600 rounded cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div ref={listRef} id={listboxId} role="listbox" className="overflow-y-auto flex-1 p-1">
            {filteredGroups.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400">
                No timezone found. Try a city, country, or IANA timezone.
              </div>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.region} className="mb-2 last:mb-0">
                  <div className="px-2 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/80 rounded sticky top-0 z-10 backdrop-blur-xs">
                    {group.region}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {group.options.map((opt) => {
                      const currentIndex = globalOptionCounter++;
                      const isSelected = opt.value === value;
                      const isHighlighted = currentIndex === highlightedIndex;

                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          data-option-index={currentIndex}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelect(opt.value)}
                          onMouseEnter={() => {
                            isKeyboardNavRef.current = false;
                            setHighlightedIndex(currentIndex);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition-colors cursor-pointer",
                            isSelected ? "bg-teal-50 text-teal-900 font-medium" : "text-gray-700",
                            isHighlighted && !isSelected && "bg-gray-100 text-gray-900",
                            isHighlighted && isSelected && "bg-teal-100 text-teal-950"
                          )}
                        >
                          <span className="truncate pr-2">{opt.label}</span>
                          {isSelected && <Check className="w-4 h-4 text-teal-600 shrink-0 ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
