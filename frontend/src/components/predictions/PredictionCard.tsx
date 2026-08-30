import { MilkPrediction } from "@/services/prediction";

export default function PredictionCard({
  prediction,
}: {
  prediction: MilkPrediction;
}) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="text-sm text-slate-500">Predicted Milk Yield</div>
      <div className="mt-3 flex items-baseline gap-3">
        <div className="text-4xl font-bold text-sky-600">
          {prediction.predicted_milk_yield.toFixed(2)}
        </div>
        <div className="text-sm text-slate-500">L/day</div>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-slate-600">
        <div>Observation: {prediction.observation_id ?? "—"}</div>
        <div>
          Confidence:{" "}
          {prediction.confidence_score != null
            ? `${(prediction.confidence_score * 100).toFixed(1)}%`
            : "N/A"}
        </div>
        <div>Model: {prediction.model_version}</div>
        <div>
          Predicted at:{" "}
          {new Date(prediction.prediction_timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
