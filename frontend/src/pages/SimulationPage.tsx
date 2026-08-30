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
  Layers,
  ShieldAlert,
  User,
  Users,
  Activity,
  FileText,
} from "lucide-react";


export default function SimulationPage() {
  const { currentFarmId } = useAuth();
  const farmId = currentFarmId || localStorage.getItem("current_farm_id");

  // Mode Switcher state: 'cow' | 'herd'
  const [mode, setMode] = useState<"cow" | "herd">("cow");
  const [selectedCowId, setSelectedCowId] = useState<string>("");

  // Control panel slider state
  const [temperature, setTemperature] = useState<number>(28);
  const [humidity, setHumidity] = useState<number>(65);
  const [feed, setFeed] = useState<number>(24);
  const [coolingReduction, setCoolingReduction] = useState<number>(0);

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
  }, [mode, selectedCowId]);

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
    });
  };

  const herdResult = herdMutation.data;
  const cowResult = cowMutation.data;
  const isLoading = mode === "cow" ? cowMutation.isPending : herdMutation.isPending;
  const extrapWarning = mode === "cow" ? cowResult?.extrapolation_warning : herdResult?.extrapolation_warning;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header & Mode Switcher */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                What-If & Scenario Simulation
              </h1>
              <span className="flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 border border-sky-200">
                <FlaskConical className="h-3.5 w-3.5" />
                Read-Only Sandbox
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Simulate environmental stress, feed ration adjustments, and cooling interventions for an individual cow or the entire herd.
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
              🐄 Individual Cow
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
              🐄🐄 Herd
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
                Simulated parameters push beyond typical historical training bounds. Predictions reflect estimated trends but carry elevated uncertainty.
              </p>
            </div>
          </div>
        )}


        {/* Preset Scenario Quick Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-sky-600" />
            Quick Presets:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={applyHeatwavePreset}
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-800 transition hover:bg-rose-100"
            >
              ☀️ Severe Heatwave (+36°C)
            </button>
            <button
              onClick={applyCoolingPreset}
              className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-xs font-bold text-sky-800 transition hover:bg-sky-100"
            >
              ❄️ Active Cooling (-6 THI)
            </button>
            <button
              onClick={applyOptimizedFeedPreset}
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100"
            >
              🌾 High-Energy Ration (+4kg)
            </button>
            <button
              onClick={resetBaseline}
              className="rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
            >
              🔄 Reset Baseline
            </button>
          </div>
        </div>

        {/* Main Grid: Control Panel & Results */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900">
                Scenario Control Panel
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {mode === "cow"
                  ? "Select an individual cow and adjust scenario parameters."
                  : "Adjust environmental and feeding sliders for herd simulation."}
              </p>
            </div>

            {/* Individual Cow Selector */}
            {mode === "cow" && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="h-4 w-4 text-sky-600" />
                  Select Subject Cow
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
                  Ambient Temperature (°C)
                </label>
                <span className="text-sm font-black text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-lg">
                  {temperature}°C
                </span>
              </div>
              <input
                type="range"
                min={15}
                max={45}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full h-2 rounded-lg bg-slate-200 accent-rose-600 cursor-pointer"
              />
            </div>

            {/* Humidity Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Droplets className="h-4 w-4 text-sky-500" />
                  Relative Humidity (%)
                </label>
                <span className="text-sm font-black text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-lg">
                  {humidity}%
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={95}
                value={humidity}
                onChange={(e) => setHumidity(Number(e.target.value))}
                className="w-full h-2 rounded-lg bg-slate-200 accent-sky-600 cursor-pointer"
              />
            </div>

            {/* Feed Quantity Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Wheat className="h-4 w-4 text-amber-500" />
                  Daily Feed Quantity (kg/cow)
                </label>
                <span className="text-sm font-black text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg">
                  {feed} kg
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={40}
                value={feed}
                onChange={(e) => setFeed(Number(e.target.value))}
                className="w-full h-2 rounded-lg bg-slate-200 accent-amber-600 cursor-pointer"
              />
            </div>

            {/* Cooling Intervention Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Fan className="h-4 w-4 text-emerald-500" />
                  Active Cooling Fans / Sprinklers (- THI)
                </label>
                <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg">
                  -{coolingReduction} THI
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                value={coolingReduction}
                onChange={(e) => setCoolingReduction(Number(e.target.value))}
                className="w-full h-2 rounded-lg bg-slate-200 accent-emerald-600 cursor-pointer"
              />
            </div>

            <button
              onClick={() => handleSimulate()}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-sky-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading ? "Calculating Scenario…" : "Run What-If Simulation"}
            </button>
          </div>

          {/* Results Column */}
          <div className="lg:col-span-7 space-y-6">
            {isLoading ? (
              <div className="rounded-3xl border bg-white p-12 text-center text-slate-500 shadow-sm space-y-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 animate-pulse">
                  <FlaskConical className="h-6 w-6" />
                </div>
                <p className="text-base font-bold text-slate-800">Calculating Read-Only Scenario Impacts…</p>
                <p className="text-xs text-slate-500">Evaluating milk yield delta, thermal stress, and health risks.</p>
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
                    <p className="mt-1 text-xs text-slate-500">
                      Baseline: {herdResult.baseline_total_yield_l.toFixed(1)} L across {herdResult.total_cows_simulated} cows
                    </p>
                  </div>

                  <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
                    <div className="text-xs font-bold uppercase tracking-wider text-sky-800">
                      Herd Status Summary
                    </div>
                    <div className="mt-3 text-2xl font-black text-sky-950">
                      {herdResult.total_cows_simulated} Cows Evaluated
                    </div>
                    <p className="mt-1 text-xs text-sky-700">
                      100% read-only scenario simulation
                    </p>
                  </div>
                </div>

                {/* Herd Scenario AI Recommendations */}
                {herdResult.herd_recommendations.length > 0 && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-sky-600" />
                      Scenario AI Recommendations
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

                {/* Cow Comparisons Table */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-sky-600" />
                    Individual Cow Scenario Impact List
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                          <th className="pb-3 px-4">Cow</th>
                          <th className="pb-3 px-4">Baseline Yield</th>
                          <th className="pb-3 px-4">Simulated Yield</th>
                          <th className="pb-3 px-4">Delta</th>
                          <th className="pb-3 px-4">THI Shift</th>
                          <th className="pb-3 px-4">Simulated Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {herdResult.cow_comparisons.map((c) => {
                          const cowPositive = c.delta_yield_l >= 0;
                          return (
                            <tr key={c.cow_id} className="hover:bg-slate-50/80 transition">
                              <td className="py-3.5 px-4 font-black text-slate-900">
                                🐄 {c.cow_name}
                                <span className="block text-xs font-normal text-slate-500">
                                  Tag: {c.tag_id}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-700">
                                {c.baseline_yield_l} L
                              </td>
                              <td className="py-3.5 px-4 font-black text-slate-950">
                                {c.simulated_yield_l} L
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-flex items-center text-xs font-black ${
                                    cowPositive ? "text-emerald-700" : "text-rose-700"
                                  }`}
                                >
                                  {cowPositive ? "+" : ""}{c.delta_yield_l} L ({c.percent_change}%)
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-700">
                                {c.baseline_thi} → <strong className="text-slate-900">{c.simulated_thi}</strong>
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
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
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-3xl border bg-white p-12 text-center text-slate-500 shadow-sm space-y-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <FlaskConical className="h-6 w-6" />
                </div>
                <p className="text-base font-bold text-slate-800">Adjust Controls & Click "Run What-If Simulation"</p>
                <p className="text-xs text-slate-500">
                  Use the preset buttons or adjust temperature, humidity, and feed sliders to see read-only scenario impacts.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
