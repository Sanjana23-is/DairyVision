import { HealthAlert } from "@/services/healthAlert";

export default function HealthAlertDetailsModal({
  alert,
  open = true,
  onClose,
}: {
  alert: HealthAlert;
  open?: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">Health Alert Details</h3>
            <p className="text-sm text-slate-500">
              Review the health alert metadata and context.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-600"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">Cow</div>
              <div className="mt-2 text-slate-800">
                {alert.cow?.name ?? alert.cow_id}
              </div>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">
                Alert Level
              </div>
              <div className="mt-2 text-slate-800">{alert.alert_level}</div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">
                Alert Type
              </div>
              <div className="mt-2 text-slate-800">{alert.alert_type}</div>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">Resolved</div>
              <div className="mt-2 text-slate-800">
                {alert.resolved ? "Yes" : "No"}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">
                Confidence
              </div>
              <div className="mt-2 text-slate-800">
                {(alert.confidence * 100).toFixed(1)}%
              </div>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">Created</div>
              <div className="mt-2 text-slate-800">
                {new Date(alert.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-600">
              Observation
            </div>
            <div className="mt-2 text-slate-800">
              {alert.observation_id ?? "N/A"}
            </div>
          </div>

          <div className="rounded-2xl border bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-600">Prediction</div>
            <div className="mt-2 text-slate-800">
              {alert.prediction_id ?? "N/A"}
            </div>
          </div>

          <div className="rounded-2xl border bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-600">
              Description
            </div>
            <div className="mt-2 text-slate-800 whitespace-pre-wrap">
              {alert.description ?? "No additional details available."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
