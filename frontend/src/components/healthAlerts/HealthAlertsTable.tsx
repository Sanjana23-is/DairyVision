import { useNavigate } from "react-router-dom";
import { HealthAlert } from "@/services/healthAlert";

export default function HealthAlertsTable({
  data,
  cowNameById = {},
  onOpenDetails,
  onOpenResolve,
}: {
  data: HealthAlert[];
  cowNameById?: Record<string, string>;
  onOpenDetails: (alert: HealthAlert) => void;
  onOpenResolve: (alert: HealthAlert) => void;
}) {
  const navigate = useNavigate();

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] p-8 text-center text-slate-600 dark:text-[#A1A1AA] shadow-sm">
        <p className="text-base font-medium">🌱 All cows look healthy!</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-[#A1A1AA]/80">
          No health issues have been detected from your recent observations.
        </p>
      </div>
    );
  }

  function getCowDisplayName(alert: HealthAlert): string {
    if (alert.cow_name && !alert.cow_name.startsWith("Cow ")) return alert.cow_name;
    if (alert.cow?.name) return alert.cow.name;
    if (cowNameById[alert.cow_id]) return cowNameById[alert.cow_id];
    return "Unknown cow";
  }


  function formatDate(isoString: string): string {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  }

  function getRiskTitle(alert: HealthAlert): string {
    const atype = (alert.alert_type || "").toLowerCase();
    const desc = (alert.description || "").toLowerCase();
    if (atype.includes("heat") || desc.includes("heat")) return "Heat Stress";
    if (atype.includes("milk") || desc.includes("milk")) return "Milk Drop";
    if (atype.includes("temp") || atype.includes("fever") || desc.includes("fever") || desc.includes("temperature")) return "High Temperature";
    if (atype === "health_condition" || desc.includes("condition") || desc.includes("symptom")) return "Health Condition";
    return "Health Condition";
  }


  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] shadow-sm">
      <table className="w-full table-auto">
        <thead className="bg-slate-50 dark:bg-[#1B1D20] text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#A1A1AA]">
          <tr>
            <th className="px-4 py-3.5">Cow</th>
            <th className="px-4 py-3.5">Risk</th>
            <th className="px-4 py-3.5">Severity</th>
            <th className="px-4 py-3.5">Date</th>
            <th className="px-4 py-3.5">Status</th>
            <th className="px-4 py-3.5">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-[#27272A] text-sm text-slate-700 dark:text-[#A1A1AA]">
          {data.map((alert) => {
            const isCritical = alert.alert_level === "Critical";
            const isWarning = alert.alert_level === "Warning";
            return (
              <tr key={alert.id} className="hover:bg-slate-50 dark:hover:bg-[#1B1D20]/50">
                <td className="px-4 py-4 font-semibold text-slate-900 dark:text-[#F4F4F5]">
                  {getCowDisplayName(alert)}
                </td>
                <td className="px-4 py-4">{getRiskTitle(alert)}</td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      isCritical
                        ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                        : isWarning
                        ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                        : "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                    }`}
                  >
                    {alert.alert_level}
                  </span>
                </td>
                <td className="px-4 py-4 text-slate-500 dark:text-[#A1A1AA]">
                  {formatDate(alert.created_at)}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      alert.resolved
                        ? "bg-slate-100 dark:bg-[#1B1D20] text-slate-600 dark:text-[#A1A1AA]"
                        : "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300"
                    }`}
                  >
                    {alert.resolved ? "Resolved" : "Active"}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenDetails(alert)}
                      className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-1 text-xs text-slate-700 dark:text-[#F4F4F5] hover:bg-slate-50 dark:hover:bg-[#151719]"
                    >
                      Details
                    </button>
                    {alert.prediction_id ? (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/predictions?predictionId=${alert.prediction_id}`,
                          )
                        }
                        className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-1 text-xs text-slate-700 dark:text-[#F4F4F5] hover:bg-slate-50 dark:hover:bg-[#151719]"
                      >
                        Prediction
                      </button>
                    ) : null}
                    {!alert.resolved ? (
                      <button
                        type="button"
                        onClick={() => onOpenResolve(alert)}
                        className="rounded-2xl border border-sky-600 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40 px-3 py-1 text-xs font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50"
                      >
                        Resolve
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

