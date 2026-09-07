import { useState, useMemo } from "react";
import {
  Printer,
  FileSpreadsheet,
  X,
  FileText,
  Thermometer,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { DashboardSummary, DashboardTrends } from "@/services/dashboard";
import { HealthAlert } from "@/services/healthAlert";
import { fetchObservations, Observation } from "@/services/observation";
import { useLanguage } from "@/context/LanguageContext";
import { getSeverityLabel } from "@/lib/i18n-helpers";

function escapeCSVValue(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export default function ExecutiveReportModal({
  open,
  farmId,
  summary,
  trends,
  healthAlerts = [],
  onClose,
}: {
  open: boolean;
  farmId: string;
  summary?: DashboardSummary;
  trends?: DashboardTrends;
  healthAlerts?: HealthAlert[];
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [exportingCSV, setExportingCSV] = useState(false);

  if (!open) return null;

  const farmName = summary?.farm?.name || "Dairy Farm";
  const farmTimezone = summary?.farm?.timezone || "UTC";
  const reportDate = new Date().toLocaleString(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  });

  const activeCowCount = summary?.active_cow_count ?? summary?.total_cow_count ?? 0;

  // Actual Milk Today
  const actualMilkToday = summary?.total_milk_produced ?? (trends?.observation_trends?.slice(-1)[0]?.total_milk_produced ?? 0);

  // 7-day Average Yield
  const avgYield7d = useMemo(() => {
    if (!trends?.observation_trends || trends.observation_trends.length === 0) return 0;
    const sum = trends.observation_trends.reduce((acc, curr) => acc + (curr.total_milk_produced || 0), 0);
    return sum / trends.observation_trends.length;
  }, [trends]);

  // Weather THI
  const temp = summary?.todays_weather?.temperature ?? 26.0;
  const humidity = summary?.todays_weather?.humidity ?? 60.0;
  const thi = summary?.todays_weather?.thi ?? (1.8 * temp + 32.0 - (0.55 - 0.0055 * humidity) * (1.8 * temp - 26.0));

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = async () => {
    setExportingCSV(true);
    try {
      const observations: Observation[] = await fetchObservations(farmId);

      const headers = [
        "observation_date",
        "cow_id",
        "milk_produced_liters",
        "feed_quantity_kg",
        "body_condition_score",
        "body_temperature_c",
        "health_condition",
        "notes",
      ];

      const csvRows = [headers.join(",")];

      observations.forEach((obs) => {
        const row = [
          escapeCSVValue(obs.observation_date),
          escapeCSVValue(obs.cow_id),
          escapeCSVValue(obs.milk_produced_liters ?? ""),
          escapeCSVValue(obs.feed_quantity_kg ?? ""),
          escapeCSVValue(obs.body_condition_score ?? ""),
          escapeCSVValue(obs.body_temperature_c ?? ""),
          escapeCSVValue(obs.health_condition ?? "normal"),
          escapeCSVValue(obs.notes || obs.health_notes || ""),
        ];
        csvRows.push(row.join(","));
      });

      const csvBlob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(csvBlob);
      const link = document.createElement("a");
      link.href = url;
      const todayStr = new Date().toISOString().slice(0, 10);
      link.setAttribute("download", `dairyvision_observations_${todayStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to export observations CSV:", err);
    } finally {
      setExportingCSV(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 px-4 py-6 overflow-y-auto print:bg-white print:p-0 backdrop-blur-xs">
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          nav, sidebar, header, .no-print {
            display: none !important;
          }
          .printable-report {
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>

      <div className="printable-report w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#151719] p-8 shadow-2xl space-y-6 text-slate-900 dark:text-[#F4F4F5] border border-slate-200 dark:border-[#27272A]">
        {/* Top Control Bar (Hidden during print) */}
        <div className="no-print flex items-center justify-between border-b border-slate-100 dark:border-[#27272A] pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 font-bold text-xs border border-sky-200 dark:border-sky-800/60">
              <FileText className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold text-slate-800 dark:text-[#F4F4F5]">{t("reports.executive_title")}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={exportingCSV}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              {exportingCSV ? t("reports.exporting_csv") : t("reports.export_csv")}
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl bg-sky-700 hover:bg-sky-800 px-3.5 py-1.5 text-xs font-bold text-white transition shadow-sm"
            >
              <Printer className="h-3.5 w-3.5" />
              {t("reports.print_pdf")}
            </button>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1B1D20] hover:text-slate-700 dark:hover:text-[#F4F4F5]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Report Header */}
        <div className="border-b border-slate-200 dark:border-[#27272A] pb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-sky-900 dark:text-sky-300">DairyVision AI</span>
              <span className="rounded-full bg-slate-100 dark:bg-[#1B1D20] px-2.5 py-0.5 text-[11px] font-bold text-slate-700 dark:text-[#A1A1AA] border border-slate-200 dark:border-[#27272A]">
                {t("reports.summary_title")}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-950 dark:text-[#F4F4F5] mt-1">{farmName}</h1>
            <p className="text-xs text-slate-600 dark:text-[#A1A1AA] mt-0.5">
              Timezone: {farmTimezone} • Operational Intelligence Summary
            </p>
          </div>

          <div className="text-right text-xs text-slate-600 dark:text-[#A1A1AA] space-y-1">
            <div className="font-bold text-slate-900 dark:text-[#F4F4F5]">Generated On:</div>
            <div>{reportDate}</div>
            <div className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">Confidential Farm Executive Document</div>
          </div>
        </div>

        {/* Executive KPI Grid */}
        <div className="space-y-2">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-[#A1A1AA]">
            {t("reports.kpis_title")}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-slate-50/60 dark:bg-[#1B1D20] p-4">
              <span className="text-[11px] font-bold text-slate-600 dark:text-[#A1A1AA] uppercase tracking-wider block">{t("reports.active_herd_size")}</span>
              <span className="text-2xl font-black text-slate-950 dark:text-[#F4F4F5] mt-1 block">{activeCowCount} {t("nav.cows")}</span>
              <span className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">{t("cows.tracked_in_herd")}</span>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-slate-50/60 dark:bg-[#1B1D20] p-4">
              <span className="text-[11px] font-bold text-slate-600 dark:text-[#A1A1AA] uppercase tracking-wider block">{t("reports.milk_today")}</span>
              <span className="text-2xl font-black text-slate-950 dark:text-[#F4F4F5] mt-1 block">{actualMilkToday.toFixed(1)} L</span>
              <span className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">{t("dashboard.total_milk_produced")}</span>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-slate-50/60 dark:bg-[#1B1D20] p-4">
              <span className="text-[11px] font-bold text-slate-600 dark:text-[#A1A1AA] uppercase tracking-wider block">{t("reports.avg_yield_7d")}</span>
              <span className="text-2xl font-black text-slate-950 dark:text-[#F4F4F5] mt-1 block">{avgYield7d.toFixed(1)} L/day</span>
              <span className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">{t("reports.avg_yield")}</span>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-slate-50/60 dark:bg-[#1B1D20] p-4">
              <span className="text-[11px] font-bold text-slate-600 dark:text-[#A1A1AA] uppercase tracking-wider block">{t("reports.health_alerts")}</span>
              <span className={`text-2xl font-black mt-1 block ${healthAlerts.length > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                {healthAlerts.length} {t("health.active_alerts")}
              </span>
              <span className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">
                {healthAlerts.length > 0 ? t("alerts.requires_monitoring") : t("alerts.all_clear")}
              </span>
            </div>
          </div>
        </div>

        {/* Weather & THI Thermal Stress Overview */}
        <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-slate-50/70 dark:bg-[#1B1D20] p-4 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#F4F4F5] flex items-center gap-1.5">
            <Thermometer className="h-4 w-4 text-rose-500 dark:text-rose-400" />
            {t("reports.thermal_stress_title")}
          </h3>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-500 dark:text-[#A1A1AA] block">{t("observations.temperature")}:</span>
              <strong className="text-sm font-bold text-slate-900 dark:text-[#F4F4F5]">{temp.toFixed(1)} °C</strong>
            </div>
            <div>
              <span className="text-slate-500 dark:text-[#A1A1AA] block">{t("observations.humidity")}:</span>
              <strong className="text-sm font-bold text-slate-900 dark:text-[#F4F4F5]">{humidity.toFixed(0)}%</strong>
            </div>
            <div>
              <span className="text-slate-500 dark:text-[#A1A1AA] block">{t("observations.thi")}:</span>
              <strong className={`text-sm font-bold ${thi >= 79 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                {thi.toFixed(1)} {thi >= 79 ? `(${t("observations.heat_stress")})` : `(${t("observations.normal")})`}
              </strong>
            </div>
          </div>
        </div>

        {/* 7-Day Milk Production & Forecast Trend Table */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#F4F4F5]">
            {t("reports.seven_day_trend_title")}
          </h3>
          {trends?.observation_trends && trends.observation_trends.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-[#27272A]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-[#1B1D20] border-b border-slate-200 dark:border-[#27272A] text-slate-700 dark:text-[#A1A1AA] font-bold">
                  <tr>
                    <th className="p-3">{t("table.date")}</th>
                    <th className="p-3">{t("reports.milk_today")} (L)</th>
                    <th className="p-3">{t("predictions.predicted_yield")} (L/cow)</th>
                    <th className="p-3">{t("observations.observation_count")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#27272A] font-medium">
                  {trends.observation_trends.slice(-7).map((row, idx) => {
                    const predRow = trends.milk_yield_trends?.find((p) => p.date === row.date);
                    return (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-[#1B1D20]/80">
                        <td className="p-3 font-bold text-slate-900 dark:text-[#F4F4F5]">{row.date}</td>
                        <td className="p-3 font-black text-sky-950 dark:text-emerald-400">{row.total_milk_produced.toFixed(1)} L</td>
                        <td className="p-3 text-slate-700 dark:text-[#F4F4F5]">
                          {predRow?.average_predicted_milk_yield
                            ? `${predRow.average_predicted_milk_yield.toFixed(1)} L`
                            : "N/A"}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-[#A1A1AA]">{row.observation_count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] p-4 text-center text-xs text-slate-500 dark:text-[#A1A1AA]">
              {t("observations.no_data")}
            </div>
          )}
        </div>

        {/* Active Health & Heat Stress Alerts Summary */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#F4F4F5] flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            {t("reports.active_alerts_title")} ({healthAlerts.length})
          </h3>
          {healthAlerts.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-[#27272A]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-[#1B1D20] border-b border-slate-200 dark:border-[#27272A] text-slate-700 dark:text-[#A1A1AA] font-bold">
                  <tr>
                    <th className="p-3">{t("health.condition")}</th>
                    <th className="p-3">{t("health.severity")}</th>
                    <th className="p-3">{t("table.description")}</th>
                    <th className="p-3">{t("health.confidence")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#27272A] font-medium">
                  {healthAlerts.slice(0, 5).map((alert, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-[#1B1D20]/80">
                      <td className="p-3 font-bold text-slate-900 dark:text-[#F4F4F5]">{alert.alert_type}</td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            alert.alert_level === "Critical"
                              ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60"
                              : alert.alert_level === "Warning"
                              ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                              : "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20"
                          }`}
                        >
                          {getSeverityLabel(alert.alert_level, t)}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700 dark:text-[#F4F4F5] max-w-xs truncate">{alert.description || t("health.active_alerts")}</td>
                      <td className="p-3 font-semibold text-slate-800 dark:text-[#F4F4F5]">{(alert.confidence * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>{t("alerts.all_clear")}</span>
            </div>
          )}
        </div>

        {/* AI Action Plan & Recommendations */}
        {summary?.recent_recommendations && summary.recent_recommendations.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#F4F4F5] flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              {t("reports.ai_action_plan")}
            </h3>
            <div className="space-y-2">
              {summary.recent_recommendations.slice(0, 3).map((rec, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-slate-50/60 dark:bg-[#1B1D20] p-3.5 text-xs">
                  <div className="font-bold text-slate-900 dark:text-[#F4F4F5]">{rec.title}</div>
                  <div className="mt-0.5 text-slate-600 dark:text-[#A1A1AA]">{rec.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Report Footer */}
        <div className="border-t border-slate-200 dark:border-[#27272A] pt-4 flex items-center justify-between text-[11px] text-slate-600 dark:text-[#A1A1AA]">
          <span>DairyVision AI Enterprise Operations Platform</span>
          <span>{t("reports.end_of_report")}</span>
        </div>
      </div>
    </div>
  );
}
