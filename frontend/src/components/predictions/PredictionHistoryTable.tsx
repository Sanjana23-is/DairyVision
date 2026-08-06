import { useNavigate } from "react-router-dom";
import { MilkPrediction } from "@/services/prediction";

export default function PredictionHistoryTable({
  data,
  onOpenDetails,
  onRequestDelete,
  deletingId,
}: {
  data: MilkPrediction[];
  onOpenDetails: (prediction: MilkPrediction) => void;
  onRequestDelete: (prediction: MilkPrediction) => void;
  deletingId?: string;
}) {
  const navigate = useNavigate();

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
            <th className="px-4 py-3">Observation</th>
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
              <td className="px-4 py-3">{p.observation_id ?? "—"}</td>
              <td className="px-4 py-3">{p.cow?.name ?? p.cow_id ?? "—"}</td>
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
