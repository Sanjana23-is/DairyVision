import { useNavigate } from "react-router-dom";
import { HealthAlert } from "@/services/healthAlert";

export default function HealthAlertsTable({
  data,
  onOpenDetails,
  onOpenResolve,
}: {
  data: HealthAlert[];
  onOpenDetails: (alert: HealthAlert) => void;
  onOpenResolve: (alert: HealthAlert) => void;
}) {
  const navigate = useNavigate();

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-slate-600">
        No health alerts found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
      <table className="w-full table-auto">
        <thead className="bg-slate-50 text-left text-sm text-slate-600">
          <tr>
            <th className="px-4 py-3">Cow</th>
            <th className="px-4 py-3">Level</th>
            <th className="px-4 py-3">Confidence</th>
            <th className="px-4 py-3">Resolved</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="text-sm text-slate-700">
          {data.map((alert) => (
            <tr key={alert.id} className="border-t hover:bg-slate-50">
              <td className="px-4 py-3">{alert.cow?.name ?? alert.cow_id}</td>
              <td className="px-4 py-3">{alert.alert_level}</td>
              <td className="px-4 py-3">
                {(alert.confidence * 100).toFixed(1)}%
              </td>
              <td className="px-4 py-3">{alert.resolved ? "Yes" : "No"}</td>
              <td className="px-4 py-3">
                {new Date(alert.created_at).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenDetails(alert)}
                    className="rounded-2xl border px-3 py-1 text-sm"
                  >
                    Details
                  </button>
                  {alert.prediction_id ? (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/health-alerts?predictionId=${alert.prediction_id}`,
                        )
                      }
                      className="rounded-2xl border px-3 py-1 text-sm"
                    >
                      Prediction
                    </button>
                  ) : null}
                  {!alert.resolved ? (
                    <button
                      type="button"
                      onClick={() => onOpenResolve(alert)}
                      className="rounded-2xl border border-sky-600 px-3 py-1 text-sm text-sky-700"
                    >
                      Resolve
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
