import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import {
  fetchSireRankings,
  fetchHerdGeneticsSummary,
  SireRankingResponse,
  HerdGeneticsSummary,
  CowGeneticProfile,
} from "@/services/genetics";
import {
  Dna,
  Award,
  TrendingUp,
  ShieldCheck,
  HelpCircle,
  X,
  ChevronRight,
  Sparkles,
  GitBranch,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function GeneticsPage() {
  const { currentFarmId } = useAuth();
  const { t } = useLanguage();
  const farmId = currentFarmId || localStorage.getItem("current_farm_id");
  const [activeTab, setActiveTab] = useState<"sires" | "cows">("sires");
  const [selectedCow, setSelectedCow] = useState<CowGeneticProfile | null>(null);

  const { data: sireData, isLoading: isSiresLoading } = useQuery<SireRankingResponse>({
    queryKey: ["sireRankings"],
    queryFn: () => fetchSireRankings(),
  });

  const { data: herdData, isLoading: isHerdLoading } = useQuery<HerdGeneticsSummary>({
    queryKey: ["herdGenetics", farmId],
    queryFn: () => fetchHerdGeneticsSummary(farmId || undefined),
  });

  const sires = sireData?.sires || [];
  const cowProfiles = herdData?.cow_profiles || [];
  const topSireLine = herdData?.top_genetic_sire_lines[0]?.sire_name || "N/A";
  const pedigreePct = herdData?.total_cows
    ? Math.round((herdData.cows_with_pedigree_count / herdData.total_cows) * 100)
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {t("genetics.title", "Genetics & Breeding Potential")}
              </h1>
              <span className="flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
                <Dna className="h-3.5 w-3.5" />
                Lineage AI
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {t("genetics.subtitle", "Sire rankings, herd genetic merit evaluations, pedigree lineage, and breeding potential insights.")}
            </p>
          </div>
        </div>

        {/* Overview KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-5 shadow-sm">
            <div className="text-xs font-bold text-purple-800 uppercase tracking-wider flex items-center justify-between">
              <span>{t("genetics.herd_index", "Herd Genetic Index")}</span>
              <Award className="h-4 w-4 text-purple-600" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-purple-950">
                {isHerdLoading ? "…" : `${herdData?.average_herd_genetic_score.toFixed(0)} / 100`}
              </span>
            </div>
            <p className="mt-1 text-xs text-purple-700">
              Combined genetic merit rating
            </p>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
            <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
              <span>{t("genetics.pedigree_coverage", "Pedigree Coverage")}</span>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-950">
                {isHerdLoading ? "…" : `${pedigreePct}%`}
              </span>
              <span className="text-xs font-semibold text-emerald-700">
                ({herdData?.cows_with_pedigree_count} of {herdData?.total_cows} cows)
              </span>
            </div>
            <p className="mt-1 text-xs text-emerald-700">
              Verified sire pedigree lineage
            </p>
          </div>

          <div className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
            <div className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center justify-between">
              <span>{t("genetics.top_sire", "Top Sire Line")}</span>
              <Sparkles className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-3 text-xl font-black text-amber-950 truncate">
              {isHerdLoading ? "…" : topSireLine}
            </div>
            <p className="mt-1 text-xs text-amber-700">
              Dominant proven sire in herd
            </p>
          </div>

          <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
            <div className="text-xs font-bold text-sky-800 uppercase tracking-wider flex items-center justify-between">
              <span>{t("genetics.sires_evaluated", "Sires Evaluated")}</span>
              <TrendingUp className="h-4 w-4 text-sky-600" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-sky-950">
                {isSiresLoading ? "…" : sireData?.total_sires_evaluated}
              </span>
              <span className="text-xs font-semibold text-sky-700">Canonical Bulls</span>
            </div>
            <p className="mt-1 text-xs text-sky-700">
              Avg Yield Benchmark: {sireData?.average_sire_total_yield_kg.toLocaleString()} kg
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("sires")}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition ${
              activeTab === "sires"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t("genetics.sire_leaderboard", "Sire Leaderboard & Performance")} ({sires.length})
          </button>
          <button
            onClick={() => setActiveTab("cows")}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition ${
              activeTab === "cows"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t("genetics.cow_profiles", "Herd Cow Genetic Profiles")} ({cowProfiles.length})
          </button>
        </div>

        {/* Tab 1: Sire Leaderboard Table */}
        {activeTab === "sires" && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Award className="h-4 w-4 text-purple-600" />
                  {t("genetics.canonical_leaderboard", "Canonical Sire Merit Leaderboard")}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t("genetics.leaderboard_desc", "Ranks superior dairy bulls based on 305-day lactation yield ratings and genetic merit index.")}
                </p>
              </div>
            </div>

            {isSiresLoading ? (
              <div className="p-8 text-center text-sm font-semibold text-slate-500">
                Loading sire performance evaluations…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 px-4">{t("genetics.col_rank", "Rank")}</th>
                      <th className="pb-3 px-4">{t("genetics.col_sire_name", "Sire Name")}</th>
                      <th className="pb-3 px-4">{t("genetics.col_code", "Code")}</th>
                      <th className="pb-3 px-4">{t("genetics.col_peak_yield", "Peak Yield")}</th>
                      <th className="pb-3 px-4">{t("genetics.col_lactation_length", "Lactation Length")}</th>
                      <th className="pb-3 px-4">{t("genetics.col_305_yield", "305-Day Yield Rating")}</th>
                      <th className="pb-3 px-4">{t("genetics.col_genetic_merit", "Genetic Merit Rating")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {sires.map((sire) => (
                      <tr key={sire.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-black">
                          {sire.rank === 1 ? (
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 text-amber-800 text-xs font-black">
                              🥇 1
                            </span>
                          ) : sire.rank === 2 ? (
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-200 text-slate-700 text-xs font-black">
                              🥈 2
                            </span>
                          ) : sire.rank === 3 ? (
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-800/10 text-amber-900 text-xs font-black">
                              🥉 3
                            </span>
                          ) : (
                            <span className="text-slate-500 font-bold ml-2">#{sire.rank}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-black text-slate-900">
                          {sire.name}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-600">
                          <code className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs">
                            {sire.sire_code}
                          </code>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {sire.peak_yield_kg != null ? `${sire.peak_yield_kg} kg/day` : "N/A"}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {sire.lactation_length_days != null ? `${sire.lactation_length_days} days` : "N/A"}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700">
                          {sire.total_milk_yield_kg != null ? `${sire.total_milk_yield_kg.toLocaleString()} kg` : "N/A"}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-purple-900 text-xs">
                              {sire.genetic_merit_score.toFixed(1)}
                            </span>
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full bg-purple-600 rounded-full"
                                style={{ width: `${Math.min(100, sire.genetic_merit_score)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Herd Cow Genetic Profiles */}
        {activeTab === "cows" && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Dna className="h-4 w-4 text-purple-600" />
                  Individual Cow Genetic Profiles & Lineage
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select a cow to view her pedigree tree, actual vs genetic yield potential, and breeding insights.
                </p>
              </div>
            </div>

            {isHerdLoading ? (
              <div className="p-8 text-center text-sm font-semibold text-slate-500">
                Loading herd cow genetic profiles…
              </div>
            ) : cowProfiles.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No active cows registered in farm.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 px-4">Cow</th>
                      <th className="pb-3 px-4">Breed</th>
                      <th className="pb-3 px-4">Sire Lineage</th>
                      <th className="pb-3 px-4">Pedigree Status</th>
                      <th className="pb-3 px-4">Est. Yield Potential</th>
                      <th className="pb-3 px-4">Actual Daily Yield</th>
                      <th className="pb-3 px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {cowProfiles.map((cow) => (
                      <tr key={cow.cow_id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-black text-slate-900">
                          🐄 {cow.cow_name}
                          <span className="block text-xs font-normal text-slate-500">
                            Tag: {cow.tag_id}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {cow.breed_name || "Unknown"}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          {cow.sire_name ? (
                            <span>{cow.sire_name} <span className="text-xs text-slate-500">({cow.sire_code})</span></span>
                          ) : (
                            <span className="text-slate-400 font-normal italic">Unrecorded Sire</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {cow.pedigree_status === "Verified Sire Pedigree" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                              <ShieldCheck className="h-3 w-3" />
                              Verified Pedigree
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                              <HelpCircle className="h-3 w-3" />
                              Breed Baseline
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-purple-900">
                          {cow.estimated_genetic_potential_l.toFixed(1)} L/day
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {cow.actual_avg_daily_yield_l != null ? `${cow.actual_avg_daily_yield_l} L/day` : "N/A"}
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => setSelectedCow(cow)}
                            className="inline-flex items-center gap-1 rounded-xl bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 transition hover:bg-purple-100"
                          >
                            Inspect Profile
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Cow Pedigree & Genetic Profile Modal */}
        {selectedCow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl space-y-6">
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-slate-900">
                      Genetic Profile — {selectedCow.cow_name}
                    </h3>
                    <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800">
                      Tag: {selectedCow.tag_id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Breed: {selectedCow.breed_name || "Unknown Breed"}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedCow(null)}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Pedigree Safeguard Badge */}
              <div
                className={`rounded-2xl p-4 border flex items-center justify-between ${
                  selectedCow.pedigree_status === "Verified Sire Pedigree"
                    ? "border-emerald-200 bg-emerald-50/70 text-emerald-950"
                    : "border-slate-200 bg-slate-50 text-slate-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold ${
                      selectedCow.pedigree_status === "Verified Sire Pedigree"
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-400 text-white"
                    }`}
                  >
                    {selectedCow.pedigree_status === "Verified Sire Pedigree" ? (
                      <ShieldCheck className="h-5 w-5" />
                    ) : (
                      <HelpCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">{selectedCow.pedigree_status}</h4>
                    <p className="text-xs opacity-80">
                      Confidence Level: <strong>{selectedCow.pedigree_confidence}</strong>
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs uppercase font-bold text-slate-500">Merit Rating</span>
                  <div className="text-xl font-black text-purple-900">
                    {selectedCow.genetic_merit_rating.toFixed(0)} / 100
                  </div>
                </div>
              </div>

              {/* Pedigree Tree Visualizer */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <GitBranch className="h-4 w-4 text-purple-600" />
                  Pedigree Tree Lineage
                </h4>
                <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  {/* Sire Card */}
                  <div className="rounded-xl border border-purple-200 bg-white p-3 shadow-2xs">
                    <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">
                      Sire (Father)
                    </span>
                    <div className="mt-1 font-black text-slate-900 text-sm">
                      {selectedCow.sire_name || "Unrecorded Sire"}
                    </div>
                    {selectedCow.sire_code && (
                      <span className="text-xs text-slate-500 font-semibold">
                        Code: {selectedCow.sire_code}
                      </span>
                    )}
                  </div>

                  {/* Dam Card */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Dam (Mother)
                    </span>
                    <div className="mt-1 font-black text-slate-900 text-sm">
                      {selectedCow.dam_name || "Unrecorded Dam"}
                    </div>
                    <span className="text-xs text-slate-400">Dam Line</span>
                  </div>
                </div>
              </div>

              {/* Yield Potential Benchmark */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4">
                  <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">
                    Genetic Yield Potential
                  </span>
                  <div className="mt-1 text-2xl font-black text-purple-950">
                    {selectedCow.estimated_genetic_potential_l.toFixed(1)} L/day
                  </div>
                  <p className="mt-0.5 text-xs text-purple-700">
                    Based on sire performance rating
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Actual Average Yield
                  </span>
                  <div className="mt-1 text-2xl font-black text-slate-900">
                    {selectedCow.actual_avg_daily_yield_l != null
                      ? `${selectedCow.actual_avg_daily_yield_l} L/day`
                      : "No Obs Recorded"}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Recorded observation average
                  </p>
                </div>
              </div>

              {/* Actionable Farmer Breeding Insights */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Actionable Breeding Insights
                </h4>
                <ul className="space-y-2">
                  {selectedCow.breeding_insights.map((insight, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs font-medium text-slate-800"
                    >
                      <Sparkles className="h-4 w-4 shrink-0 text-purple-600 mt-0.5" />
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button
                  onClick={() => setSelectedCow(null)}
                  className="rounded-2xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-950"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
