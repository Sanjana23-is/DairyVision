import { useNavigate } from "react-router-dom";
import { MilkPrediction } from "@/services/prediction";

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

export default function PredictionHistoryTable({
  data,
  cowNameById,
  obsDateById,
  onOpenDetails,
  onRequestDelete,
  deletingId,
}: {
  data: MilkPrediction[];
  cowNameById?: Map<string, string>;
  obsDateById?: Map<string, string>;
  onOpenDetails: (prediction: MilkPrediction) => void;
  onRequestDelete: (prediction: MilkPrediction) => void;
  deletingId?: string;
}) {
  const navigate = useNavigate();
  const cowName = (id?: string) =>
    id ? (cowNameById?.get(id) ?? id) : "—";

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-slate-600">
        No predictions yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
      <table className="w-full table-auto">
        <thead className="bg-slate-50 text-left text-sm text-slate-600">
          <tr>
            <th className="px-4 py-3">Observation Date</th>
            <th className="px-4 py-3">Cow</th>
            <th className="px-4 py-3">Yield</th>
            <th className="px-4 py-3">Confidence</th>
            <th className="px-4 py-3">Prediction Time</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="text-sm text-slate-700">
          {data.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="px-4 py-3">
                {formatDate(p.observation_id ? obsDateById?.get(p.observation_id) : undefined)}
              </td>
              <td className="px-4 py-3">{cowName(p.cow_id)}</td>

              <td className="px-4 py-3">
                {p.predicted_milk_yield.toFixed(2)} L
              </td>
              <td className="px-4 py-3">
                {p.confidence_score != null
                  ? `${(p.confidence_score * 100).toFixed(1)}%`
                  : "N/A"}
              </td>
              <td className="px-4 py-3">
                {new Date(p.prediction_timestamp).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenDetails(p)}
                    className="rounded-2xl border px-3 py-1 text-sm"
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/explainability?predictionId=${p.id}`)
                    }
                    className="rounded-2xl border px-3 py-1 text-sm"
                  >
                    Explainability
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/health-alerts?predictionId=${p.id}`)
                    }
                    className="rounded-2xl border px-3 py-1 text-sm"
                  >
                    Health Alert
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequestDelete(p)}
                    className="rounded-2xl border border-rose-500 px-3 py-1 text-sm text-rose-700"
                    disabled={deletingId === p.id}
                  >
                    {deletingId === p.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
