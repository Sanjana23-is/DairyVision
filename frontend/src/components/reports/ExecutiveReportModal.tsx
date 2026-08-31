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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto print:bg-white print:p-0">
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

      <div className="printable-report w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl space-y-6 text-slate-900 border border-slate-200">
        {/* Top Control Bar (Hidden during print) */}
        <div className="no-print flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-800 font-bold text-xs">
              <FileText className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold text-slate-800">Executive Farm Report Viewer</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={exportingCSV}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              {exportingCSV ? "Exporting CSV…" : "Export Observations CSV"}
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl bg-sky-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-sky-800 transition shadow-sm"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save as PDF
            </button>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Report Header */}
        <div className="border-b border-slate-200 pb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-sky-900">DairyVision AI</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200">
                Executive Farm Summary
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-950 mt-1">{farmName}</h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Timezone: {farmTimezone} • Operational Intelligence Summary
            </p>
          </div>

          <div className="text-right text-xs text-slate-600 space-y-1">
            <div className="font-bold text-slate-900">Generated On:</div>
            <div>{reportDate}</div>
            <div className="text-[11px] text-slate-600">Confidential Farm Executive Document</div>
          </div>
        </div>

        {/* Executive KPI Grid */}
        <div className="space-y-2">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
            Key Operational Performance Indicators
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Active Herd Size</span>
              <span className="text-2xl font-black text-slate-950 mt-1 block">{activeCowCount} Cows</span>
              <span className="text-[11px] text-slate-600">Registered active inventory</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Milk Produced Today</span>
              <span className="text-2xl font-black text-slate-950 mt-1 block">{actualMilkToday.toFixed(1)} L</span>
              <span className="text-[11px] text-slate-600">Total recorded daily yield</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">7-Day Average Yield</span>
              <span className="text-2xl font-black text-slate-950 mt-1 block">{avgYield7d.toFixed(1)} L/day</span>
              <span className="text-[11px] text-slate-600">Rolling 7d production average</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Active Health Alerts</span>
              <span className={`text-2xl font-black mt-1 block ${healthAlerts.length > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {healthAlerts.length} Active
              </span>
              <span className="text-[11px] text-slate-600">
                {healthAlerts.length > 0 ? "Requires monitoring" : "All checks normal"}
              </span>
            </div>
          </div>
        </div>

        {/* Weather & THI Thermal Stress Overview */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Thermometer className="h-4 w-4 text-rose-500" />
            Thermal Stress Index (THI) & Ambient Weather Status
          </h3>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block">Temperature:</span>
              <strong className="text-sm font-bold text-slate-900">{temp.toFixed(1)} °C</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Relative Humidity:</span>
              <strong className="text-sm font-bold text-slate-900">{humidity.toFixed(0)}%</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Calculated THI Index:</span>
              <strong className={`text-sm font-bold ${thi >= 79 ? "text-rose-700" : "text-emerald-700"}`}>
                {thi.toFixed(1)} {thi >= 79 ? "(Heat Stress Zone)" : "(Comfort Zone)"}
              </strong>
            </div>
          </div>
        </div>

        {/* 7-Day Milk Production & Forecast Trend Table */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            7-Day Milk Production & AI Forecast Trend
          </h3>
          {trends?.observation_trends && trends.observation_trends.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Actual Milk Produced (L)</th>
                    <th className="p-3">Avg Forecast Yield (L/cow)</th>
                    <th className="p-3">Daily Observation Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {trends.observation_trends.slice(-7).map((row, idx) => {
                    const predRow = trends.milk_yield_trends?.find((p) => p.date === row.date);
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{row.date}</td>
                        <td className="p-3 font-black text-sky-950">{row.total_milk_produced.toFixed(1)} L</td>
                        <td className="p-3 text-slate-700">
                          {predRow?.average_predicted_milk_yield
                            ? `${predRow.average_predicted_milk_yield.toFixed(1)} L`
                            : "N/A"}
                        </td>
                        <td className="p-3 text-slate-600">{row.observation_count} logs</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 p-4 text-center text-xs text-slate-500">
              No daily observation trend data available for this farm yet.
            </div>
          )}
        </div>

        {/* Active Health & Heat Stress Alerts Summary */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            Unresolved Herd Health & Thermal Stress Alerts ({healthAlerts.length})
          </h3>
          {healthAlerts.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                  <tr>
                    <th className="p-3">Alert Type</th>
                    <th className="p-3">Severity</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {healthAlerts.slice(0, 5).map((alert, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{alert.alert_type}</td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            alert.alert_level === "Critical"
                              ? "bg-rose-100 text-rose-800"
                              : alert.alert_level === "Warning"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {alert.alert_level}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700 max-w-xs truncate">{alert.description || "Health check alert"}</td>
                      <td className="p-3 font-semibold text-slate-800">{(alert.confidence * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-xs font-semibold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>0 active health alerts reported. All monitored cows passed daily health evaluation.</span>
            </div>
          )}
        </div>

        {/* AI Action Plan & Recommendations */}
        {summary?.recent_recommendations && summary.recent_recommendations.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-sky-600" />
              Active AI Operational Recommendations
            </h3>
            <div className="space-y-2">
              {summary.recent_recommendations.slice(0, 3).map((rec, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs">
                  <div className="font-bold text-slate-900">{rec.title}</div>
                  <div className="mt-0.5 text-slate-600">{rec.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Report Footer */}
        <div className="border-t border-slate-200 pt-4 flex items-center justify-between text-[11px] text-slate-600">
          <span>DairyVision AI Enterprise Operations Platform</span>
          <span>End of Executive Summary Report</span>
        </div>
      </div>
    </div>
  );
}
