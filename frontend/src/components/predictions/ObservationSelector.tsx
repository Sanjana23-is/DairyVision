import { useState, useRef, useEffect, useMemo } from "react";
import {
  Search,
  ChevronDown,
  Calendar,
  Milk,
  Check,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export interface ObservationSelectorProps {
  observations: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading?: boolean;
  isError?: boolean;
  cowName: (cowId: string) => string;
  disabled?: boolean;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function ObservationSelector({
  observations = [],
  selectedId,
  onSelect,
  isLoading = false,
  isError = false,
  cowName,
  disabled = false,
}: ObservationSelectorProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedObservation = useMemo(
    () => observations.find((o) => o.id === selectedId) || null,
    [observations, selectedId],
  );

  // Filter observations based on search term
  const filteredObservations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return observations;

    return observations.filter((o) => {
      const name = cowName(o.cow_id).toLowerCase();
      const rawDate = (o.observation_date || "").toLowerCase();
      const formatted = formatDate(o.observation_date).toLowerCase();
      const yieldStr =
        o.milk_produced_liters != null
          ? `${Number(o.milk_produced_liters).toFixed(1)} l`
          : "";

      return (
        name.includes(query) ||
        rawDate.includes(query) ||
        formatted.includes(query) ||
        yieldStr.includes(query)
      );
    });
  }, [observations, searchQuery, cowName]);

  // Keep highlighted index in bounds
  useEffect(() => {
    setHighlightedIndex((prev) => {
      if (filteredObservations.length === 0) return 0;
      if (prev >= filteredObservations.length) return filteredObservations.length - 1;
      return prev;
    });
  }, [filteredObservations]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);

      // Set highlighted index to selected item if visible
      if (selectedId) {
        const idx = filteredObservations.findIndex((o) => o.id === selectedId);
        if (idx !== -1) setHighlightedIndex(idx);
      }
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Auto-scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const activeEl = listRef.current.querySelector(
      `[data-index="${highlightedIndex}"]`,
    );
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (id: string) => {
    onSelect(id);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || isLoading || observations.length === 0) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredObservations.length - 1 ? prev + 1 : 0,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredObservations.length - 1,
        );
        break;
      case "Enter":
        e.preventDefault();
        if (filteredObservations[highlightedIndex]) {
          handleSelect(filteredObservations[highlightedIndex].id);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  const isDisabled = disabled || isLoading || observations.length === 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        id="observation-selector-trigger"
        data-testid="observation-selector-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="observation-listbox"
        disabled={isDisabled}
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        className={`w-full h-11 px-3.5 pr-10 text-left rounded-xl border transition flex items-center justify-between text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
          isOpen
            ? "border-emerald-500 dark:border-emerald-500 bg-white dark:bg-[#1B1D20] ring-2 ring-emerald-500/20"
            : "border-slate-200 dark:border-[#27272A] bg-slate-50/70 dark:bg-[#1B1D20] hover:border-slate-300 dark:hover:border-[#3F3F46]"
        } ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className="truncate flex items-center gap-2 pr-2">
          {isLoading ? (
            <span className="flex items-center gap-2 text-slate-400 dark:text-[#A1A1AA]">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" />
              <span>{t("pred.loading_observations", "Loading observations...")}</span>
            </span>
          ) : isError ? (
            <span className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Error loading observations</span>
            </span>
          ) : observations.length === 0 ? (
            <span className="text-slate-400 dark:text-[#A1A1AA]">
              {t("pred.no_observations", "No observations available — record one first")}
            </span>
          ) : selectedObservation ? (
            <span className="flex items-center gap-2 truncate">
              <span className="font-bold text-slate-900 dark:text-[#F4F4F5]">
                {cowName(selectedObservation.cow_id)}
              </span>
              <span className="text-slate-400 dark:text-[#71717A]">•</span>
              <span className="text-slate-600 dark:text-[#A1A1AA] flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {formatDate(selectedObservation.observation_date)}
              </span>
              <span className="text-slate-400 dark:text-[#71717A]">•</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <Milk className="h-3 w-3" />
                {selectedObservation.milk_produced_liters != null
                  ? `${Number(selectedObservation.milk_produced_liters).toFixed(1)} L`
                  : t("pred.no_yield_logged", "No yield logged")}
              </span>
            </span>
          ) : (
            <span className="text-slate-400 dark:text-[#A1A1AA]">
              {t(
                "pred.pick_observation",
                "Pick an observation (Date • Cow • Current Yield)...",
              )}
            </span>
          )}
        </div>

        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400 dark:text-[#A1A1AA]">
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-emerald-600 dark:text-emerald-400" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] shadow-xl ring-1 ring-black/5 dark:ring-white/5 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Search Box Header */}
          <div className="p-2 border-b border-slate-100 dark:border-[#27272A] bg-slate-50/50 dark:bg-[#1B1D20]/60">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-slate-400 dark:text-[#A1A1AA] pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                data-testid="observation-search-input"
                aria-label={t("pred.search_placeholder", "Search by cow name or date...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("pred.search_placeholder", "Search by cow name or date...")}
                className="w-full h-9 pl-9 pr-8 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] text-slate-900 dark:text-[#F4F4F5] placeholder:text-slate-400 dark:placeholder:text-[#71717A] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 p-0.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-[#F4F4F5] transition"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Observation List (sensible max height 280-320px) */}
          <div
            ref={listRef}
            id="observation-listbox"
            role="listbox"
            aria-label={t("pred.select_observation", "Select Daily Observation")}
            className="max-h-[300px] overflow-y-auto p-1.5 space-y-1 divide-y divide-slate-100/60 dark:divide-[#27272A]/40"
          >
            {filteredObservations.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-[#F4F4F5]">
                  {t(
                    "pred.no_matching_observations",
                    "No observations match your search",
                  )}
                </p>
                <p className="text-xs text-slate-400 dark:text-[#A1A1AA] mt-1">
                  Try searching by a different cow name or date.
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="mt-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Clear search query
                  </button>
                )}
              </div>
            ) : (
              filteredObservations.map((obs, idx) => {
                const name = cowName(obs.cow_id);
                const isSelected = obs.id === selectedId;
                const isHighlighted = idx === highlightedIndex;
                const yieldFormatted =
                  obs.milk_produced_liters != null
                    ? `${Number(obs.milk_produced_liters).toFixed(1)} L`
                    : t("pred.no_yield_logged", "No yield logged");

                return (
                  <div
                    key={obs.id}
                    id={`obs-option-${obs.id}`}
                    data-testid={`obs-option-${obs.id}`}
                    data-index={idx}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(obs.id)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-left transition select-none ${
                      isSelected
                        ? "bg-emerald-50 dark:bg-emerald-500/[0.12] text-emerald-950 dark:text-emerald-200 font-medium"
                        : isHighlighted
                          ? "bg-slate-50 dark:bg-[#1B1D20] text-slate-900 dark:text-[#F4F4F5]"
                          : "text-slate-700 dark:text-[#A1A1AA] hover:bg-slate-50/80 dark:hover:bg-[#1B1D20]/70"
                    }`}
                  >
                    <div className="min-w-0 pr-3 space-y-0.5">
                      {/* Line 1: Cow Name */}
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-[#F4F4F5] truncate">
                          {name}
                        </span>
                        {isSelected && (
                          <span className="shrink-0 text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>

                      {/* Line 2: Date */}
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-[#A1A1AA]">
                        <Calendar className="h-3 w-3 text-slate-400 dark:text-[#71717A]" />
                        <span>{formatDate(obs.observation_date)}</span>
                        {obs.observation_date && (
                          <span className="text-[10px] text-slate-400 dark:text-[#71717A] ml-1">
                            ({obs.observation_date})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right side: Milk yield badge */}
                    <div className="shrink-0 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${
                          obs.milk_produced_liters != null
                            ? "bg-emerald-100/70 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                            : "bg-slate-100 dark:bg-[#27272A] text-slate-500 dark:text-[#A1A1AA]"
                        }`}
                      >
                        <Milk className="h-3 w-3" />
                        <span>{yieldFormatted}</span>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note: Showing X of Y */}
          <div className="px-3 py-1.5 border-t border-slate-100 dark:border-[#27272A] bg-slate-50/50 dark:bg-[#1B1D20]/40 flex items-center justify-between text-[11px] text-slate-400 dark:text-[#71717A]">
            <span>
              {filteredObservations.length === observations.length
                ? `${observations.length} total observations`
                : `${filteredObservations.length} of ${observations.length} matches`}
            </span>
            <span className="text-[10px] hidden sm:inline">
              ↑↓ to navigate • ↵ to select • esc to close
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
