import { Recommendation } from "@/services/recommendation";

export default function RecommendationsTable({
  data,
  cowNameById = {},
  onOpenDetails,
  onRequestComplete,
  onRequestDelete,
}: {
  data: Recommendation[];
  cowNameById?: Record<string, string>;
  onOpenDetails: (recommendation: Recommendation) => void;
  onRequestComplete: (recommendation: Recommendation) => void;
  onRequestDelete: (recommendation: Recommendation) => void;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-8 text-center text-slate-600">
        <p className="text-base font-medium">🌱 No recommendations found.</p>
        <p className="mt-1 text-xs text-slate-400">
          No advisory actions currently match your selected filters.
        </p>
      </div>
    );
  }

  function getCowDisplayName(rec: Recommendation): string {
    if (rec.cow?.name) return rec.cow.name;
    if (rec.cow_id && cowNameById[rec.cow_id]) return cowNameById[rec.cow_id];
    if (rec.cow_id) return `Cow ${rec.cow_id.slice(0, 8)}`;
    return "Herd / General";
  }

  function getCategoryIcon(cat?: string | null): string {
    if (!cat) return "💡";
    if (cat.includes("Water") || cat.includes("Heat")) return "🚰";
    if (cat.includes("Feed") || cat.includes("Nutrition")) return "🌾";
    if (cat.includes("Veterinary")) return "🩺";
    if (cat.includes("Observation")) return "👁️";
    return "💡";
  }

  function formatDate(isoString?: string | null): string {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return String(isoString);
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return String(isoString);
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
      <table className="w-full table-auto">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-4 py-3.5">Action Title</th>
            <th className="px-4 py-3.5">Category</th>
            <th className="px-4 py-3.5">Priority</th>
            <th className="px-4 py-3.5">Subject Cow</th>
            <th className="px-4 py-3.5">Created Date</th>
            <th className="px-4 py-3.5">Status</th>
            <th className="px-4 py-3.5">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y text-sm text-slate-700">
          {data.map((rec) => {
            const isHigh = rec.priority === "High" || rec.priority === "Critical";
            const isMed = rec.priority === "Medium";
            const categoryText = rec.category || "General Farm Management";
            return (
              <tr key={rec.id} className="hover:bg-slate-50">
                <td className="px-4 py-4 font-semibold text-slate-900">
                  {rec.title || "Advisory Action"}
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    <span>{getCategoryIcon(categoryText)}</span>
                    <span>{categoryText}</span>
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      isHigh
                        ? "bg-rose-100 text-rose-800"
                        : isMed
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {rec.priority || "Medium"}
                  </span>
                </td>
                <td className="px-4 py-4 font-medium text-slate-800">
                  🐄 {getCowDisplayName(rec)}
                </td>
                <td className="px-4 py-4 text-slate-500">
                  {formatDate(rec.created_at)}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      rec.completed
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-sky-100 text-sky-800"
                    }`}
                  >
                    {rec.completed ? "Completed" : "Action Required"}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenDetails(rec)}
                      className="rounded-2xl border bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Details
                    </button>
                    {!rec.completed ? (
                      <button
                        type="button"
                        onClick={() => onRequestComplete(rec)}
                        className="rounded-2xl border border-sky-600 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
                      >
                        Mark Completed
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onRequestDelete(rec)}
                      className="rounded-2xl border border-rose-200 px-3 py-1 text-xs text-rose-600 hover:bg-rose-50"
                    >
                      Delete
                    </button>
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
