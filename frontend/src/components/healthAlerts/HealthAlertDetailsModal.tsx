import { HealthAlert } from "@/services/healthAlert";

export default function HealthAlertDetailsModal({
  alert,
  cowNameById,
  open = true,
  onClose,
}: {
  alert: HealthAlert;
  cowNameById?: Record<string, string>;
  open?: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  function getRiskDisplayName(alertItem: HealthAlert): string {
    if (alertItem.risk_display_name && alertItem.risk_display_name !== "composite") {
      return alertItem.risk_display_name;
    }
    const desc = (alertItem.description || "").toLowerCase();
    const atype = (alertItem.alert_type || "").toLowerCase();

    if (atype.includes("heat") || desc.includes("heat")) return "Heat Stress";
    if (atype.includes("temp") || atype.includes("fever") || desc.includes("fever") || desc.includes("temperature")) return "High Temperature";
    if (atype.includes("milk") || desc.includes("milk")) return "Milk Production Drop";
    return "Health Condition";
  }

  function getCategoryIcon(riskName: string): string {
    if (riskName.includes("Heat")) return "🚰";
    if (riskName.includes("Temp") || riskName.includes("Fever")) return "🤒";
    if (riskName.includes("Milk")) return "📉";
    return "🩺";
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

  const riskTitle = getRiskDisplayName(alert);
  const isCritical = alert.alert_level === "Critical";

  // Strict cow name resolution (Name -> Tag ID -> Map Lookup -> "Unknown cow"). Never UUID!
  const cowDisplayName =
    (alert.cow_name && !alert.cow_name.startsWith("Cow "))
      ? alert.cow_name
      : (alert.cow?.name || (cowNameById && alert.cow_id ? cowNameById[alert.cow_id] : null) || "Unknown cow");

  // Fallback why explanation if not supplied directly by backend response
  let rawWhyText = alert.why_explanation || (
    alert.description && !alert.description.includes("heat_score=")
      ? alert.description
      : `${cowDisplayName} was flagged because recent observations indicate elevated ${riskTitle.toLowerCase()} risk.`
  );

  // Replace any legacy raw UUID references inside text with the farmer-friendly cow display name
  let whyExplanationText = rawWhyText.replace(/Cow\s+[a-f0-9-]{8,}/gi, cowDisplayName);

  // Evidence dictionary items
  const evidenceEntries = alert.evidence ? Object.entries(alert.evidence) : [];

  // Recommended actions
  const actionList = alert.recommended_actions || [
    "Monitor cow closely during daily observations",
    "Ensure unhindered access to fresh water and feed",
    "Contact a veterinarian if symptoms or stress persist",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-5 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{getCategoryIcon(riskTitle)}</span>
              <h3 className="text-lg font-bold text-slate-900">
                {riskTitle}
              </h3>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  isCritical
                    ? "bg-rose-100 text-rose-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {alert.alert_level}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Farmer-Facing Health Risk & Evidence Summary
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-5 p-6 max-h-[80vh] overflow-y-auto">
          {/* SECTION 1: Why is this cow flagged? */}
          <div
            className={`rounded-2xl border p-5 shadow-sm ${
              isCritical
                ? "border-rose-100 bg-rose-50/60 text-rose-950"
                : "border-amber-100 bg-amber-50/60 text-amber-950"
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-900">
              <span>💡</span>
              <span>Why is this cow flagged?</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed font-medium">
              "{whyExplanationText}"
            </p>
          </div>

          {/* SECTION 2: Recent Evidence (Only existing metrics) */}
          {evidenceEntries.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-3">
                <span>📊</span>
                <span>Recent Evidence</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {evidenceEntries.map(([key, val]) => (
                  <div key={key} className="rounded-xl border bg-white p-3 shadow-2xs">
                    <div className="text-xs font-medium text-slate-500">{key}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {String(val)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* SECTION 3: Recommended Actions */}
          <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-sky-900 mb-2">
              <span>📋</span>
              <span>Recommended Actions</span>
            </div>
            <ul className="space-y-1.5 list-disc list-inside text-sm text-sky-950 font-medium">
              {actionList.map((action, idx) => (
                <li key={idx} className="leading-relaxed">
                  {action}
                </li>
              ))}
            </ul>
          </div>

          {/* SECTION 4: Context Metadata Grid */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Subject Cow
              </div>
              <div className="mt-1.5 text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <span>🐄</span>
                <span>{cowDisplayName}</span>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Observation Date
              </div>
              <div className="mt-1.5 text-sm font-semibold text-slate-800">
                {alert.observation_date || formatDate(alert.created_at)}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Risk Status
              </div>
              <div className="mt-1.5">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    alert.resolved
                      ? "bg-slate-100 text-slate-700"
                      : "bg-sky-100 text-sky-800"
                  }`}
                >
                  {alert.resolved ? "Resolved" : "Active Risk"}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Close */}
          <div className="flex items-center justify-between border-t pt-4 text-xs text-slate-400">
            <span>Evaluated & Generated by DairyVision AI</span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
