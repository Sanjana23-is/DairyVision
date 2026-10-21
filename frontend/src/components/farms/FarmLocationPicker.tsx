import { useState, useEffect, useRef } from "react";
import {
  MapPin,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  X,
  Crosshair,
  Sliders,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import {
  fetchIndianStates,
  fetchDistrictsForState,
  searchIndianLocations,
  reverseGeocodeCoordinates,
  LocationSearchResult,
} from "@/services/location";

export interface FarmLocationData {
  country: string;
  state: string;
  district: string;
  taluk: string;
  village: string;
  location_city: string;
  latitude?: number;
  longitude?: number;
  source?: "gps" | "geocoded" | "manual";
}

interface FarmLocationPickerProps {
  value: FarmLocationData;
  onChange: (val: FarmLocationData) => void;
  error?: string;
}

export default function FarmLocationPicker({
  value,
  onChange,
  error,
}: FarmLocationPickerProps) {
  const { t } = useLanguage();

  // State & District options
  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  // Combobox filter states
  const [stateSearch, setStateSearch] = useState("");
  const [isStateOpen, setIsStateOpen] = useState(false);
  const [districtSearch, setDistrictSearch] = useState("");
  const [isDistrictOpen, setIsDistrictOpen] = useState(false);

  // Village/City place search state
  const [villageSearchInput, setVillageSearchInput] = useState(value.village || "");
  const [suggestions, setSuggestions] = useState<LocationSearchResult[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // GPS geolocation state
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Manual coordinate fine-tuning toggle
  const [showManualCoords, setShowManualCoords] = useState(false);

  // Dropdown refs for click-outside
  const stateRef = useRef<HTMLDivElement>(null);
  const districtRef = useRef<HTMLDivElement>(null);
  const villageRef = useRef<HTMLDivElement>(null);

  // Load States on mount
  useEffect(() => {
    let mounted = true;
    setLoadingStates(true);
    fetchIndianStates()
      .then((data) => {
        if (mounted) {
          setStates(data);
          setLoadingStates(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load states:", err);
        if (mounted) setLoadingStates(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Load Districts when value.state changes
  useEffect(() => {
    if (!value.state) {
      setDistricts([]);
      return;
    }
    let mounted = true;
    setLoadingDistricts(true);
    fetchDistrictsForState(value.state)
      .then((data) => {
        if (mounted) {
          setDistricts(data);
          setLoadingDistricts(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load districts:", err);
        if (mounted) setLoadingDistricts(false);
      });
    return () => {
      mounted = false;
    };
  }, [value.state]);

  // Keep village input in sync if parent resets or GPS updates it
  useEffect(() => {
    setVillageSearchInput(value.village || "");
  }, [value.village]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (stateRef.current && !stateRef.current.contains(event.target as Node)) {
        setIsStateOpen(false);
      }
      if (districtRef.current && !districtRef.current.contains(event.target as Node)) {
        setIsDistrictOpen(false);
      }
      if (villageRef.current && !villageRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filtered lists
  const filteredStates = states.filter((s) =>
    s.toLowerCase().includes(stateSearch.toLowerCase())
  );
  const filteredDistricts = districts.filter((d) =>
    d.toLowerCase().includes(districtSearch.toLowerCase())
  );

  // Handle State Selection (Clears child selections: district, taluk, village, coords)
  const handleSelectState = (stateName: string) => {
    setIsStateOpen(false);
    setStateSearch("");
    onChange({
      country: "India",
      state: stateName,
      district: "",
      taluk: "",
      village: "",
      location_city: stateName,
      latitude: undefined,
      longitude: undefined,
      source: undefined,
    });
  };

  // Handle District Selection (Clears child selections: taluk, village, coords)
  const handleSelectDistrict = (districtName: string) => {
    setIsDistrictOpen(false);
    setDistrictSearch("");
    onChange({
      ...value,
      district: districtName,
      taluk: "",
      village: "",
      location_city: `${districtName}, ${value.state}`,
      latitude: undefined,
      longitude: undefined,
      source: undefined,
    });
  };

  // Handle Village Search debounce
  useEffect(() => {
    const q = villageSearchInput.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingPlaces(true);
      try {
        const results = await searchIndianLocations(q, value.state, value.district);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (e) {
        console.error("Search error:", e);
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [villageSearchInput, value.state, value.district]);

  // Select place from suggestions
  const handleSelectSuggestion = (item: LocationSearchResult) => {
    const parts = [
      item.name,
      item.taluk,
      item.district || value.district,
      item.state || value.state,
    ].filter(Boolean);
    const readableCity = parts.join(", ");

    onChange({
      country: "India",
      state: item.state || value.state,
      district: item.district || value.district,
      taluk: item.taluk || value.taluk,
      village: item.name,
      location_city: readableCity,
      latitude: Number(item.latitude.toFixed(6)),
      longitude: Number(item.longitude.toFixed(6)),
      source: "geocoded",
    });
    setVillageSearchInput(item.name);
    setShowSuggestions(false);
    setGeoError(null);
  };

  // Browser Geolocation API ("Use my current location")
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lon = Number(pos.coords.longitude.toFixed(6));

        try {
          const rev = await reverseGeocodeCoordinates(lat, lon);
          const readableCity =
            rev.display_name ||
            [rev.village, rev.taluk, rev.district, rev.state, "India"]
              .filter(Boolean)
              .join(", ");

          onChange({
            country: "India",
            state: rev.state || value.state,
            district: rev.district || value.district,
            taluk: rev.taluk || value.taluk,
            village: rev.village || "",
            location_city: readableCity,
            latitude: lat,
            longitude: lon,
            source: "gps",
          });
          if (rev.village) setVillageSearchInput(rev.village);
        } catch (revErr) {
          console.warn("Reverse geocode failed, using direct coords:", revErr);
          onChange({
            ...value,
            latitude: lat,
            longitude: lon,
            location_city: value.location_city || `Farm Coordinates (${lat}, ${lon})`,
            source: "gps",
          });
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError(
            "Location permission was denied. You can still select your State, District, and Village above."
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoError("Device GPS position unavailable. Please search your village or city.");
        } else {
          setGeoError("Location request timed out. Please search for your village or district.");
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  return (
    <div className="space-y-3.5">
      {/* Country (India Fixed) & State Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Country */}
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-[#F4F4F5]">
            {t("farm.country")}
          </label>
          <div className="mt-1 flex items-center justify-between rounded-xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#1B1D20]/60 px-3 py-2 text-xs text-slate-600 dark:text-[#A1A1AA]">
            <span>🇮🇳 India</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40">
              Fixed
            </span>
          </div>
        </div>

        {/* State Combobox */}
        <div ref={stateRef} className="relative">
          <label className="text-xs font-bold text-slate-700 dark:text-[#F4F4F5]">
            {t("farm.state")} <span className="text-rose-500">*</span>
          </label>
          <button
            type="button"
            onClick={() => setIsStateOpen(!isStateOpen)}
            className="mt-1 flex w-full items-center justify-between rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-xs text-slate-900 dark:text-[#F4F4F5] hover:border-slate-300 dark:hover:border-slate-600 focus:border-emerald-600 focus:outline-none transition"
          >
            <span className={value.state ? "font-semibold" : "text-slate-400"}>
              {value.state || t("farm.select_state")}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>

          {isStateOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] shadow-xl p-1.5 space-y-1">
              <div className="p-1">
                <input
                  type="text"
                  autoFocus
                  placeholder="Type to filter state..."
                  value={stateSearch}
                  onChange={(e) => setStateSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#1B1D20] px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#F4F4F5] focus:border-emerald-600 focus:outline-none"
                />
              </div>
              {loadingStates ? (
                <div className="flex items-center justify-center p-3 text-xs text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading Indian states...
                </div>
              ) : filteredStates.length === 0 ? (
                <div className="p-2.5 text-center text-xs text-slate-500">
                  No matching states found
                </div>
              ) : (
                filteredStates.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleSelectState(st)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition flex items-center justify-between ${
                      value.state === st
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold"
                        : "text-slate-700 dark:text-[#F4F4F5] hover:bg-slate-100 dark:hover:bg-[#1B1D20]"
                    }`}
                  >
                    <span>{st}</span>
                    {value.state === st && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* District & Taluk Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* District Combobox */}
        <div ref={districtRef} className="relative">
          <label className="text-xs font-bold text-slate-700 dark:text-[#F4F4F5]">
            {t("farm.district")} <span className="text-rose-500">*</span>
          </label>
          <button
            type="button"
            disabled={!value.state}
            onClick={() => setIsDistrictOpen(!isDistrictOpen)}
            className="mt-1 flex w-full items-center justify-between rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-xs text-slate-900 dark:text-[#F4F4F5] disabled:opacity-50 disabled:cursor-not-allowed hover:border-slate-300 dark:hover:border-slate-600 focus:border-emerald-600 focus:outline-none transition"
          >
            <span className={value.district ? "font-semibold" : "text-slate-400"}>
              {value.district ||
                (value.state ? t("farm.select_district") : "Select State first")}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>

          {isDistrictOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] shadow-xl p-1.5 space-y-1">
              <div className="p-1">
                <input
                  type="text"
                  autoFocus
                  placeholder="Type to filter district..."
                  value={districtSearch}
                  onChange={(e) => setDistrictSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#1B1D20] px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#F4F4F5] focus:border-emerald-600 focus:outline-none"
                />
              </div>
              {loadingDistricts ? (
                <div className="flex items-center justify-center p-3 text-xs text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading districts...
                </div>
              ) : filteredDistricts.length === 0 ? (
                <div className="p-2.5 text-center text-xs text-slate-500">
                  No matching districts found
                </div>
              ) : (
                filteredDistricts.map((dst) => (
                  <button
                    key={dst}
                    type="button"
                    onClick={() => handleSelectDistrict(dst)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition flex items-center justify-between ${
                      value.district === dst
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold"
                        : "text-slate-700 dark:text-[#F4F4F5] hover:bg-slate-100 dark:hover:bg-[#1B1D20]"
                    }`}
                  >
                    <span>{dst}</span>
                    {value.district === dst && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Taluk / Tehsil */}
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-[#F4F4F5]">
            {t("farm.taluk")}
          </label>
          <input
            type="text"
            disabled={!value.district}
            value={value.taluk || ""}
            onChange={(e) => {
              const val = e.target.value;
              onChange({
                ...value,
                taluk: val,
                location_city: [value.village, val, value.district, value.state]
                  .filter(Boolean)
                  .join(", "),
              });
            }}
            placeholder={
              value.district ? t("farm.select_taluk") : "Select District first"
            }
            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-xs text-slate-900 dark:text-[#F4F4F5] disabled:opacity-50 disabled:cursor-not-allowed focus:border-emerald-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Village / City Search Field with Suggestions */}
      <div ref={villageRef} className="relative">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 dark:text-[#F4F4F5]">
            {t("farm.village")} <span className="text-rose-500">*</span>
          </label>
          <span className="text-[11px] text-slate-500 dark:text-[#A1A1AA]">
            Type village name to resolve coordinates
          </span>
        </div>
        <div className="relative mt-1">
          <input
            type="text"
            value={villageSearchInput}
            onChange={(e) => {
              const str = e.target.value;
              setVillageSearchInput(str);
              onChange({
                ...value,
                village: str,
                location_city: [str, value.taluk, value.district, value.state]
                  .filter(Boolean)
                  .join(", "),
              });
            }}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            placeholder={t("farm.enter_village")}
            className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] pl-9 pr-9 py-2 text-xs text-slate-900 dark:text-[#F4F4F5] focus:border-emerald-600 focus:outline-none"
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          {isSearchingPlaces ? (
            <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-emerald-600" />
          ) : villageSearchInput ? (
            <button
              type="button"
              onClick={() => {
                setVillageSearchInput("");
                onChange({
                  ...value,
                  village: "",
                  latitude: undefined,
                  longitude: undefined,
                });
              }}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {/* Suggestion Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] shadow-xl p-1.5 space-y-1">
            <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Matching Indian Locations (Click to confirm coordinates)
            </div>
            {suggestions.map((item, idx) => (
              <button
                key={`${item.latitude}-${item.longitude}-${idx}`}
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/40 transition flex items-start gap-2.5"
              >
                <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 dark:text-[#F4F4F5]">
                    {item.name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-[#A1A1AA] truncate">
                    {item.display_name}
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                    Lat: {item.latitude.toFixed(4)}, Lon: {item.longitude.toFixed(4)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Geolocation "Use my current location" Action Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/70 dark:bg-emerald-950/30 px-3.5 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition disabled:opacity-60"
        >
          {isLocating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-emerald-700 dark:text-emerald-300" />
              <span>{t("farm.locating")}</span>
            </>
          ) : (
            <>
              <Crosshair className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>{t("farm.use_current_location")}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowManualCoords(!showManualCoords)}
          className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-[#A1A1AA] hover:text-slate-800 dark:hover:text-[#F4F4F5] py-1"
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>{showManualCoords ? "Hide coordinates" : "Fine-tune coordinates"}</span>
        </button>
      </div>

      {/* Geolocation feedback / error banner */}
      {geoError && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/40 p-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 leading-relaxed">{geoError}</div>
        </div>
      )}

      {/* Confirmed Coordinates Display Card */}
      {value.latitude !== undefined && value.longitude !== undefined && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/40 dark:bg-[#151719] p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>{t("farm.confirmed_coords")}</span>
            </div>
            <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">
              {value.source === "gps" ? "Device GPS" : "Resolved Geocoding"}
            </span>
          </div>

          <div className="text-xs text-slate-700 dark:text-[#F4F4F5] font-medium flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">{value.location_city || "Custom Coordinates"}</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono text-slate-600 dark:text-[#A1A1AA] pt-1 border-t border-emerald-100 dark:border-emerald-900/30">
            <div>
              <span className="text-slate-400 dark:text-slate-500 font-sans">Lat:</span>{" "}
              {value.latitude}° N
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500 font-sans">Lon:</span>{" "}
              {value.longitude}° E
            </div>
          </div>

          <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 leading-normal">
            Weather and THI for milk yield predictions will be automatically retrieved for this exact location.
          </p>
        </div>
      )}

      {/* Manual Coordinate Fine-Tuning (Accordion) */}
      {showManualCoords && (
        <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#1B1D20]/50 p-3 space-y-2">
          <div className="text-[11px] font-bold text-slate-700 dark:text-[#F4F4F5]">
            Refine Coordinates Manually (Optional)
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-500">
                {t("farm.latitude")}
              </label>
              <input
                type="number"
                step="any"
                value={value.latitude ?? ""}
                onChange={(e) => {
                  const val = e.target.value === "" ? undefined : Number(e.target.value);
                  onChange({
                    ...value,
                    latitude: val,
                    source: "manual",
                  });
                }}
                placeholder="e.g. 12.9716"
                className="mt-0.5 w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#F4F4F5] focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500">
                {t("farm.longitude")}
              </label>
              <input
                type="number"
                step="any"
                value={value.longitude ?? ""}
                onChange={(e) => {
                  const val = e.target.value === "" ? undefined : Number(e.target.value);
                  onChange({
                    ...value,
                    longitude: val,
                    source: "manual",
                  });
                }}
                placeholder="e.g. 77.5946"
                className="mt-0.5 w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#F4F4F5] focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="text-rose-600 dark:text-rose-400 text-xs mt-1">{error}</div>
      )}
    </div>
  );
}
