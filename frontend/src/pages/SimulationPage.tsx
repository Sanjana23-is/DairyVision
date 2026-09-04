import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { fetchCows, Cow } from "@/services/cow";
import {
  runHerdSimulation,
  runCowSimulation,
  HerdWhatIfResponse,
  CowWhatIfResponse,
  SimulationInput,
  FinancialImpact,
} from "@/services/simulation";
import {
  FlaskConical,
  Thermometer,
  Droplets,
  Wheat,
  Fan,
  TrendingUp,
  TrendingDown,
  Sparkles,
  RefreshCw,
  ShieldAlert,
  User,
  Users,
  Activity,
  FileText,
  Coins,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

function FinancialImpactCard({ impact, isHerd = false, cowsCount = 0 }: { impact: FinancialImpact; isHerd?: boolean; cowsCount?: number }) {
  const isPositive = impact.decision_classification === "positive";
  const isNegative = impact.decision_classification === "negative";

  return (
    <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 via-white to-slate-50 p-6 shadow-sm space-y-4">
      {/* Header with Classification Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-sm">
            ₹
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isHerd ? "Herd Estimated Financial Impact" : "Estimated Financial Impact"}
            </h3>
            <p className="text-xs text-slate-500">
              {isHerd ? `Aggregate economic return across ${cowsCount} active cows` : "Projected economic return based on yield & feed deltas"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold border ${
              isPositive
                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                : isNegative
                ? "bg-rose-100 text-rose-800 border-rose-200"
                : "bg-amber-100 text-amber-800 border-amber-200"
            }`}
          >
            {isPositive ? "Positive Financial Impact" : isNegative ? "Negative Financial Impact" : "Near Break-Even"}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 border border-slate-200">
            {impact.currency}
          </span>
        </div>
      </div>

      {/* Big Net Impact Numbers */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`rounded-2xl border p-4 ${impact.daily_net_benefit >= 0 ? "border-emerald-200 bg-white" : "border-rose-200 bg-white"}`}>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            {isHerd ? "Herd Estimated Daily Net Impact" : "Estimated Daily Net Impact"}
          </span>
          <span className={`text-2xl font-black mt-1 block ${impact.daily_net_benefit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {impact.daily_net_benefit >= 0 ? "+" : ""}₹{impact.daily_net_benefit.toFixed(2)}/day
          </span>
        </div>

        <div className={`rounded-2xl border p-4 ${impact.monthly_net_benefit >= 0 ? "border-emerald-200 bg-white" : "border-rose-200 bg-white"}`}>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            {isHerd ? "Herd Estimated Monthly Net Impact (30d)" : "Estimated Monthly Net Impact (30d)"}
          </span>
          <span className={`text-2xl font-black mt-1 block ${impact.monthly_net_benefit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {impact.monthly_net_benefit >= 0 ? "+" : ""}₹{impact.monthly_net_benefit.toFixed(2)}/month
          </span>
        </div>
      </div>

      {/* Financial Breakdown Table */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-2 text-xs">
        <div className="flex items-center justify-between text-slate-700">
          <span>{isHerd ? "Herd Additional Milk Revenue" : "Additional Milk Revenue"} ({impact.delta_milk_liters >= 0 ? "+" : ""}{impact.delta_milk_liters} L @ ₹{impact.milk_price_per_liter}/L):</span>
          <span className={`font-bold ${impact.daily_revenue_change >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {impact.daily_revenue_change >= 0 ? "+" : ""}₹{impact.daily_revenue_change.toFixed(2)}/day
          </span>
        </div>
        <div className="flex items-center justify-between text-slate-700">
          <span>{isHerd ? "Herd Additional Feed Cost" : "Additional Feed Cost"} ({impact.delta_feed_kg >= 0 ? "+" : ""}{impact.delta_feed_kg} kg @ ₹{impact.feed_cost_per_kg}/kg):</span>
          <span className={`font-bold ${impact.daily_feed_cost_change <= 0 ? "text-emerald-700" : "text-amber-700"}`}>
            {impact.daily_feed_cost_change > 0 ? "-" : ""}₹{Math.abs(impact.daily_feed_cost_change).toFixed(2)}/day
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-2 font-bold text-slate-900 text-sm">
          <span>Net Estimated Benefit:</span>
          <span className={impact.daily_net_benefit >= 0 ? "text-emerald-700" : "text-rose-700"}>
            {impact.daily_net_benefit >= 0 ? "+" : ""}₹{impact.daily_net_benefit.toFixed(2)}/day
          </span>
        </div>

        {/* Derived Metric: Revenue per ₹1 feed cost */}
        {impact.revenue_per_feed_cost_ratio != null && (
          <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-slate-600 font-semibold text-[11.5px]">
            <span>Revenue generated per ₹1 of additional feed cost:</span>
            <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
              ₹{impact.revenue_per_feed_cost_ratio.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* WHY THIS IMPACT? Section */}
      {impact.explanation_text && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
            <Coins className="h-4 w-4 text-emerald-700" />
            Why This Impact?
          </h4>
          <p className="text-xs font-medium leading-relaxed text-emerald-950">
            {impact.explanation_text}
          </p>
        </div>
      )}

      {/* Transparent Assumptions Badge */}
      <div className="rounded-xl bg-slate-100/80 p-3 text-[11.5px] text-slate-600 flex items-center gap-2">
        <span className="font-bold text-slate-700">Transparency Note:</span>
        {impact.using_default_assumptions ? (
          <span>Using default assumptions — Milk: ₹{impact.milk_price_per_liter}/L, Feed: ₹{impact.feed_cost_per_kg}/kg. Configure farm settings for custom rates.</span>
        ) : (
          <span>Based on configured economic rates — Milk: ₹{impact.milk_price_per_liter}/L, Feed: ₹{impact.feed_cost_per_kg}/kg.</span>
        )}
      </div>
    </div>
  );
}

export default function SimulationPage() {
  const { currentFarmId } = useAuth();
  const { t } = useLanguage();
  const farmId = currentFarmId || localStorage.getItem("current_farm_id");

  // Mode Switcher state: 'cow' | 'herd'
  const [mode, setMode] = useState<"cow" | "herd">("cow");
  const [selectedCowId, setSelectedCowId] = useState<string>("");

  // Control panel slider state
  const [temperature, setTemperature] = useState<number>(28);
  const [humidity, setHumidity] = useState<number>(65);
  const [feed, setFeed] = useState<number>(24);
  const [coolingReduction, setCoolingReduction] = useState<number>(0);

  // Optional Financial Override State
  const [useCustomPrices, setUseCustomPrices] = useState<boolean>(false);
  const [overrideMilkPrice, setOverrideMilkPrice] = useState<number>(42);
  const [overrideFeedCost, setOverrideFeedCost] = useState<number>(24);

  // Fetch Cows for current farm
  const { data: cows = [] } = useQuery<Cow[]>({
    queryKey: ["cows", farmId],
    queryFn: () => fetchCows(farmId || undefined),
  });

  // Select first active cow by default when cows load
  useEffect(() => {
    if (cows.length > 0 && !selectedCowId) {
      setSelectedCowId(cows[0].id);
    }
  }, [cows, selectedCowId]);

  // Mutations
  const herdMutation = useMutation<HerdWhatIfResponse, Error, SimulationInput>({
    mutationFn: (scenarioInput) => runHerdSimulation(scenarioInput, farmId || undefined),
  });

  const cowMutation = useMutation<CowWhatIfResponse, Error, { cowId: string; scenario: SimulationInput }>({
    mutationFn: ({ cowId, scenario }) => runCowSimulation(cowId, scenario),
  });

  const handleSimulate = (overrideInput?: SimulationInput) => {
    const input: SimulationInput = overrideInput || {
      temperature_c: temperature,
      humidity_pct: humidity,
      feed_quantity_kg: feed,
      cooling_intervention_thi_reduction: coolingReduction,
      override_milk_price_per_liter: useCustomPrices ? overrideMilkPrice : undefined,
      override_feed_cost_per_kg: useCustomPrices ? overrideFeedCost : undefined,
    };

    if (mode === "cow") {
      if (selectedCowId) {
        cowMutation.mutate({ cowId: selectedCowId, scenario: input });
      }
    } else {
      herdMutation.mutate(input);
    }
  };

  // Run simulation on mode switch or cow selection change
  useEffect(() => {
    handleSimulate();
  }, [mode, selectedCowId, useCustomPrices, overrideMilkPrice, overrideFeedCost]);

  // Preset Scenario Handlers
  const applyHeatwavePreset = () => {
    setTemperature(36);
    setHumidity(75);
    setFeed(22);
    setCoolingReduction(0);
    handleSimulate({
      temperature_c: 36,
      humidity_pct: 75,
      feed_quantity_kg: 22,
      cooling_intervention_thi_reduction: 0,
      override_milk_price_per_liter: useCustomPrices ? overrideMilkPrice : undefined,
      override_feed_cost_per_kg: useCustomPrices ? overrideFeedCost : undefined,
    });
  };

  const applyCoolingPreset = () => {
    setTemperature(36);
    setHumidity(75);
    setFeed(24);
    setCoolingReduction(6);
    handleSimulate({
      temperature_c: 36,
      humidity_pct: 75,
      feed_quantity_kg: 24,
      cooling_intervention_thi_reduction: 6,
      override_milk_price_per_liter: useCustomPrices ? overrideMilkPrice : undefined,
      override_feed_cost_per_kg: useCustomPrices ? overrideFeedCost : undefined,
    });
  };

  const applyOptimizedFeedPreset = () => {
    setTemperature(26);
    setHumidity(60);
    setFeed(28);
    setCoolingReduction(0);
    handleSimulate({
      temperature_c: 26,
      humidity_pct: 60,
      feed_quantity_kg: 28,
      cooling_intervention_thi_reduction: 0,
      override_milk_price_per_liter: useCustomPrices ? overrideMilkPrice : undefined,
      override_feed_cost_per_kg: useCustomPrices ? overrideFeedCost : undefined,
    });
  };

  const resetBaseline = () => {
    setTemperature(25);
    setHumidity(60);
    setFeed(24);
    setCoolingReduction(0);
    handleSimulate({
      temperature_c: 25,
      humidity_pct: 60,
      feed_quantity_kg: 24,
      cooling_intervention_thi_reduction: 0,
      override_milk_price_per_liter: useCustomPrices ? overrideMilkPrice : undefined,
      override_feed_cost_per_kg: useCustomPrices ? overrideFeedCost : undefined,
    });
  };

  const herdResult = herdMutation.data;
  const cowResult = cowMutation.data;
  const isLoading = mode === "cow" ? cowMutation.isPending : herdMutation.isPending;
  const extrapWarning = mode === "cow" ? cowResult?.extrapolation_warning : herdResult?.extrapolation_warning;
  const activeFinImpact = mode === "cow" ? cowResult?.financial_impact : herdResult?.financial_impact;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header & Mode Switcher */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {t("sim.title", "What-If & Scenario Simulation")}
              </h1>
              <span className="flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 border border-sky-200">
                <FlaskConical className="h-3.5 w-3.5" />
                {t("sim.sandbox", "Read-Only Sandbox")}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {t("sim.subtitle", "Simulate environmental stress, feed ration adjustments, and cooling interventions with transparent financial impact.")}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center rounded-2xl bg-slate-100 p-1.5 border border-slate-200">
            <button
              onClick={() => setMode("cow")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                mode === "cow"
                  ? "bg-white text-sky-800 shadow-sm border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <User className="h-4 w-4 text-sky-600" />
              🐄 {t("sim.individual_cow", "Individual Cow")}
            </button>
            <button
              onClick={() => setMode("herd")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                mode === "herd"
                  ? "bg-white text-sky-800 shadow-sm border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Users className="h-4 w-4 text-sky-600" />
              🐄🐄 {t("sim.herd", "Herd")}
            </button>
          </div>
        </div>

        {/* API Error Alert Banner */}
        {(mode === "cow" ? cowMutation.error : herdMutation.error) && (
          <div className="flex items-center gap-3 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-rose-950 shadow-sm">
            <ShieldAlert className="h-6 w-6 shrink-0 text-rose-600" />
            <div>
              <h4 className="text-sm font-bold">Simulation Notice</h4>
              <p className="text-xs text-rose-800">
                {((mode === "cow" ? cowMutation.error : herdMutation.error) as any)?.response?.data?.detail ||
                  (mode === "cow" ? cowMutation.error : herdMutation.error)?.message}
              </p>
            </div>
          </div>
        )}

        {/* Extrapolation Safeguard Banner */}
        {extrapWarning && (
          <div className="flex items-center gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm">
            <ShieldAlert className="h-6 w-6 shrink-0 text-amber-600" />
            <div>
              <h4 className="text-sm font-bold">Extrapolation Boundary Notice</h4>
              <p className="text-xs text-amber-800">
                Simulated parameters push beyond typical historical training bounds. Predictions and financial estimates reflect trends but carry higher uncertainty.
              </p>
            </div>
          </div>
        )}

        {/* Preset Scenario Quick Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-sky-600" />
            {t("sim.quick_presets", "Quick Presets:")}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={applyHeatwavePreset}
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-800 transition hover:bg-rose-100"
            >
              ☀️ {t("sim.severe_heatwave", "Severe Heatwave (+36°C)")}
            </button>
            <button
              onClick={applyCoolingPreset}
              className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-xs font-bold text-sky-800 transition hover:bg-sky-100"
            >
              ❄️ {t("sim.active_cooling", "Active Cooling (-6 THI)")}
            </button>
            <button
              onClick={applyOptimizedFeedPreset}
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100"
            >
              🌾 {t("sim.high_energy_ration", "High-Energy Ration (+4kg)")}
            </button>
            <button
              onClick={resetBaseline}
              className="rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
            >
              🔄 {t("sim.reset_baseline", "Reset Baseline")}
            </button>
          </div>
        </div>

        {/* Main Grid: Control Panel & Results */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900">
                {t("sim.scenario_panel", "Scenario Control Panel")}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {mode === "cow"
                  ? t("sim.scenario_panel_desc", "Select an individual cow and adjust scenario parameters.")
                  : "Adjust environmental and feeding sliders for herd simulation."}
              </p>
            </div>

            {/* Individual Cow Selector */}
            {mode === "cow" && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="h-4 w-4 text-sky-600" />
                  {t("sim.select_cow", "Select Subject Cow")}
                </label>
                <select
                  value={selectedCowId}
                  onChange={(e) => setSelectedCowId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
                >
                  {cows.length === 0 ? (
                    <option value="">No cows available</option>
                  ) : (
                    cows.map((c) => (
                      <option key={c.id} value={c.id}>
                        🐄 {c.name || `Cow ${c.tag_id}`} (Tag: {c.tag || c.tag_id || "N/A"})
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {/* Temperature Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Thermometer className="h-4 w-4 text-rose-500" />
                  {t("sim.ambient_temp", "Ambient Temperature (°C)")}
                </label>
                <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">
                  {temperature}°C
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="45"
                step="1"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
              />
            </div>

            {/* Humidity Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Droplets className="h-4 w-4 text-sky-500" />
                  {t("sim.relative_humidity", "Relative Humidity (%)")}
                </label>
                <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">
                  {humidity}%
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="95"
                step="1"
                value={humidity}
                onChange={(e) => setHumidity(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
              />
            </div>

            {/* Feed Quantity Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Wheat className="h-4 w-4 text-amber-500" />
                  {t("sim.feed_ration", "Daily Feed Ration (kg/cow)")}
                </label>
                <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">
                  {feed} kg
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="40"
                step="1"
                value={feed}
                onChange={(e) => setFeed(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
            </div>

            {/* Cooling Intervention Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Fan className="h-4 w-4 text-emerald-500" />
                  {t("sim.cooling_reduction", "Cooling THI Reduction (-THI)")}
                </label>
                <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">
                  -{coolingReduction} THI
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                value={coolingReduction}
                onChange={(e) => setCoolingReduction(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
            </div>

            {/* Optional Scenario Economics Toggle & Controls */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                  <Coins className="h-4 w-4 text-emerald-600" />
                  {t("sim.override_prices", "Override Scenario Prices (₹)")}
                </label>
                <input
                  type="checkbox"
                  checked={useCustomPrices}
                  onChange={(e) => setUseCustomPrices(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
              </div>

              {useCustomPrices && (
                <div className="grid grid-cols-2 gap-3 pt-1 animate-in fade-in">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Milk Price (₹/L)
                    </label>
                    <input
                      type="number"
                      value={overrideMilkPrice}
                      onChange={(e) => setOverrideMilkPrice(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-900 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Feed Cost (₹/kg)
                    </label>
                    <input
                      type="number"
                      value={overrideFeedCost}
                      onChange={(e) => setOverrideFeedCost(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-900 focus:bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Run Simulation Action Button */}
            <button
              onClick={() => handleSimulate()}
              disabled={isLoading}
              className="w-full rounded-2xl bg-sky-700 hover:bg-sky-800 text-white font-bold py-3 text-sm transition shadow-sm flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {t("sim.simulating", "Simulating Scenario…")}
                </>
              ) : (
                <>
                  <FlaskConical className="h-4 w-4" />
                  {t("sim.recalculate", "Recalculate Scenario Impact")}
                </>
              )}
            </button>
          </div>

          {/* Results Column */}
          <div className="lg:col-span-7 space-y-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-12 text-center h-full min-h-[400px]">
                <RefreshCw className="h-8 w-8 animate-spin text-sky-600 mb-3" />
                <h4 className="text-base font-bold text-slate-800">{t("sim.calculating", "Calculating Digital Twin Scenario…")}</h4>
                <p className="text-xs text-slate-500">{t("sim.calculating_desc", "Evaluating milk yield delta, thermal stress, and financial impact.")}</p>
              </div>
            ) : mode === "cow" && cowResult ? (
              <>
                {/* Individual Cow Baseline vs Simulated Summary Card */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        🐄 {cowResult.cow_name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Tag: {cowResult.tag_id} {cowResult.breed_name ? `• Breed: ${cowResult.breed_name}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-800 border border-sky-200">
                      Single Cow Scenario
                    </span>
                  </div>

                  {/* Impact Grid */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div
                      className={`rounded-2xl border p-4 transition ${
                        cowResult.delta_milk_yield_l >= 0
                          ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
                          : "border-rose-200 bg-gradient-to-br from-rose-50 to-white"
                      }`}
                    >
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Predicted Milk Yield
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-slate-950">
                          {cowResult.simulated_milk_yield_l.toFixed(1)} L/day
                        </span>
                        <span
                          className={`text-xs font-black flex items-center ${
                            cowResult.delta_milk_yield_l >= 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {cowResult.delta_milk_yield_l >= 0 ? (
                            <TrendingUp className="h-3.5 w-3.5 mr-0.5" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5 mr-0.5" />
                          )}
                          {cowResult.delta_milk_yield_l >= 0 ? "+" : ""}
                          {cowResult.delta_milk_yield_l.toFixed(1)} L ({cowResult.percent_change.toFixed(1)}%)
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Baseline Yield: {cowResult.baseline_milk_yield_l.toFixed(1)} L/day
                      </p>
                    </div>

                    <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-sky-800">
                        Digital Twin Vitality Score
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-sky-950">
                          {cowResult.simulated_vitality_score.toFixed(0)}%
                        </span>
                        <span className="text-xs font-semibold text-sky-700">
                          Baseline: {cowResult.baseline_vitality_score.toFixed(0)}%
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-sky-700">
                        Health Status: {cowResult.simulated_health_status}
                      </p>
                    </div>
                  </div>

                  {/* THI & Environmental Comparison */}
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Activity className="h-4 w-4 text-sky-600" />
                      Thermal Stress & Risk Shift
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500 block">Baseline THI</span>
                        <strong className="text-sm font-bold text-slate-800">{cowResult.baseline_thi}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Simulated THI</span>
                        <strong className="text-sm font-bold text-slate-900">{cowResult.simulated_thi}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Farmer-Friendly Explanation Box */}
                  <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-sky-900 flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-sky-600" />
                      Why This Result Changed:
                    </h4>
                    <p className="text-xs font-medium leading-relaxed text-sky-950">
                      {cowResult.explanation_summary}
                    </p>
                  </div>
                </div>

                {/* Estimated Financial Impact Card */}
                {activeFinImpact && (
                  <FinancialImpactCard impact={activeFinImpact} isHerd={false} />
                )}

                {/* Individual Cow Recommendations */}
                {cowResult.recommendations.length > 0 && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-sky-600" />
                      Cow Scenario AI Advice
                    </h4>
                    <div className="space-y-2">
                      {cowResult.recommendations.map((rec, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-xs font-medium text-slate-800"
                        >
                          <div className="font-bold text-slate-900">{rec.title}</div>
                          <div className="mt-1 text-slate-600">{rec.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : mode === "herd" && herdResult ? (
              <>
                {/* Herd Summary Comparison Dashboard Cards */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div
                    className={`rounded-3xl border p-5 shadow-sm transition ${
                      (herdResult.total_delta_l || 0) >= 0
                        ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
                        : "border-rose-200 bg-gradient-to-br from-rose-50 to-white"
                    }`}
                  >
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Herd Milk Production Impact
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-black text-slate-950">
                        {herdResult.simulated_total_yield_l.toFixed(1)} L
                      </span>
                      <span
                        className={`text-sm font-bold flex items-center ${
                          (herdResult.total_delta_l || 0) >= 0 ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {(herdResult.total_delta_l || 0) >= 0 ? (
                          <TrendingUp className="h-4 w-4 mr-0.5" />
                        ) : (
                          <TrendingDown className="h-4 w-4 mr-0.5" />
                        )}
                        {(herdResult.total_delta_l || 0) >= 0 ? "+" : ""}
                        {herdResult.total_delta_l.toFixed(1)} L ({herdResult.total_percent_change.toFixed(1)}%)
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">
                      Baseline Herd Yield: {herdResult.baseline_total_yield_l.toFixed(1)} L/day ({herdResult.total_cows_simulated} cows)
                    </p>
                  </div>

                  <div className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
                    <div className="text-xs font-bold uppercase tracking-wider text-sky-900">
                      Herd Scope Summary
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-black text-sky-950">
                        {herdResult.total_cows_simulated} Cows
                      </span>
                      <span className="text-xs font-bold text-sky-800">
                        Simulated Active Herd
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-sky-700">
                      Farm-wide environmental & feed scenario
                    </p>
                  </div>
                </div>

                {/* Herd Estimated Financial Impact Card */}
                {activeFinImpact && (
                  <FinancialImpactCard impact={activeFinImpact} isHerd={true} cowsCount={herdResult.total_cows_simulated} />
                )}

                {/* Herd Comparisons Table */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Users className="h-4 w-4 text-sky-600" />
                    Individual Cow Scenario Breakdown
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                          <th className="pb-3">Cow Name</th>
                          <th className="pb-3">Baseline Yield</th>
                          <th className="pb-3">Simulated Yield</th>
                          <th className="pb-3">Delta (L)</th>
                          <th className="pb-3">THI Shift</th>
                          <th className="pb-3">Health Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {herdResult.cow_comparisons.map((c) => (
                          <tr key={c.cow_id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 font-bold text-slate-900">
                              {c.cow_name} <span className="text-slate-400 font-normal">({c.tag_id})</span>
                            </td>
                            <td className="py-3 text-slate-600 font-medium">{c.baseline_yield_l.toFixed(1)} L</td>
                            <td className="py-3 font-bold text-slate-900">{c.simulated_yield_l.toFixed(1)} L</td>
                            <td className={`py-3 font-bold ${c.delta_yield_l >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              {c.delta_yield_l >= 0 ? "+" : ""}{c.delta_yield_l.toFixed(1)} L ({c.percent_change.toFixed(1)}%)
                            </td>
                            <td className="py-3 text-slate-600 font-medium">
                              {c.baseline_thi} → <span className="font-bold text-slate-900">{c.simulated_thi}</span>
                            </td>
                            <td className="py-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                  c.simulated_health_status === "Critical"
                                    ? "bg-rose-100 text-rose-800"
                                    : c.simulated_health_status === "Warning"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {c.simulated_health_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Herd Recommendations */}
                {herdResult.herd_recommendations.length > 0 && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-sky-600" />
                      Herd Scenario AI Action Plan
                    </h4>
                    <div className="space-y-2">
                      {herdResult.herd_recommendations.map((rec, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-xs font-medium text-slate-800"
                        >
                          <div className="font-bold text-slate-900">{rec.title}</div>
                          <div className="mt-1 text-slate-600">{rec.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-12 text-slate-400 text-sm">
                Select parameters to run what-if simulation.
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
