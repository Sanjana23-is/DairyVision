import { Recommendation } from "@/services/recommendation";

export default function RecommendationDetailsModal({
  recommendation,
  cowNameById = {},
  open = true,
  onClose,
}: {
  recommendation: Recommendation;
  cowNameById?: Record<string, string>;
  open?: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  function getCowDisplayName(rec: Recommendation): string {
    if (rec.cow?.name) return rec.cow.name;
    if (rec.cow_id && cowNameById[rec.cow_id]) return cowNameById[rec.cow_id];
    if (rec.cow_id) return `Cow ${rec.cow_id.slice(0, 8)}`;
    return "Herd / General";
  }

  function getCategoryIcon(cat: string): string {
    if (cat.includes("Water") || cat.includes("Heat")) return "🚰";
    if (cat.includes("Feed") || cat.includes("Nutrition")) return "🌾";
    if (cat.includes("Veterinary")) return "🩺";
    if (cat.includes("Observation")) return "👁️";
    return "💡";
  }

  function formatDate(isoString: string): string {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  }

  // Construct intelligent fallback explanation if backend why_reason is not present
  function getWhyExplanation(rec: Recommendation): string {
    if (rec.why_reason && rec.why_reason.trim()) {
      return rec.why_reason;
    }
    const cat = rec.category.toLowerCase();
    const cowName = getCowDisplayName(rec);

    if (cat.includes("veterinary") || rec.title.toLowerCase().includes("veterinary")) {
      return `The cow (${cowName}) was recorded with an abnormal health condition or temperature elevation during recent monitoring. This may indicate an illness that should be diagnosed promptly.`;
    }
    if (cat.includes("heat")) {
      return `Recent weather & temperature monitoring indicates elevated heat stress risk. Heat stress can lower feed intake, reduce milk yield, and impact herd health.`;
    }
    if (cat.includes("feed") || cat.includes("nutrition")) {
      return `Milk production or feed intake measurements for ${cowName} deviated from expected baselines. Adjusting diet composition helps support yield recovery.`;
    }
    return `Automated farm monitoring identified operational or environmental metrics requiring advisory attention for ${cowName}.`;
  }

  const isHigh = recommendation.priority === "High" || recommendation.priority === "Critical";
  const isMed = recommendation.priority === "Medium";
  const cowDisplayName = getCowDisplayName(recommendation);
  const whyText = getWhyExplanation(recommendation);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-5 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{getCategoryIcon(recommendation.category)}</span>
              <h3 className="text-lg font-bold text-slate-900">
                {recommendation.title}
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Advisory Details & Contextual Signal Breakdown
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
        <div className="space-y-5 p-6">
          {/* SECTION 1: Why this recommendation? */}
          <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-sky-900">
              <span>💡</span>
              <span>Why this recommendation?</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-sky-950 font-medium">
              {whyText}
            </p>
          </div>

          {/* SECTION 2: Recommended Action */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <span>📋</span>
              <span>Recommended Action</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap font-medium">
              {recommendation.description || "No specific action text provided."}
            </p>
          </div>

          {/* SECTION 3: Context Metrics Grid */}
          <div className="grid gap-3 sm:grid-cols-2">
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
                Category
              </div>
              <div className="mt-1.5 text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <span>{getCategoryIcon(recommendation.category)}</span>
                <span>{recommendation.category}</span>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Priority Level
              </div>
              <div className="mt-1.5">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                    isHigh
                      ? "bg-rose-100 text-rose-800"
                      : isMed
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {recommendation.priority} Priority
                </span>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Status
              </div>
              <div className="mt-1.5">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                    recommendation.completed
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-sky-100 text-sky-800"
                  }`}
                >
                  {recommendation.completed ? "Completed" : "Action Required"}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Date */}
          <div className="flex items-center justify-between border-t pt-4 text-xs text-slate-400">
            <span>Evaluated & Generated: {formatDate(recommendation.created_at)}</span>
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
