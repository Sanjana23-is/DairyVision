import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/layouts/DashboardLayout";
import { fetchObservation } from "@/services/observation";
import { fetchCow } from "@/services/cow";

export default function ObservationDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    data: observation,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["observation", id],
    queryFn: () => fetchObservation(id as string),
    enabled: !!id,
  });

  const { data: cow } = useQuery({
    queryKey: ["cow", observation?.cow_id],
    queryFn: () => fetchCow(observation!.cow_id),
    enabled: !!observation?.cow_id,
  });

  return (
    <DashboardLayout>

      <div className="mx-auto max-w-4xl">
        <button onClick={() => navigate(-1)} className="mb-4 text-slate-600">
          Back
        </button>

        {isLoading ? (
          <div>Loading observation...</div>
        ) : isError ? (
          <div className="text-rose-600">
            Error: {(error as any)?.message ?? "Failed to load observation"}
          </div>
        ) : !observation ? (
          <div>No observation found.</div>
        ) : (
          <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-xl font-semibold">Observation Details</h2>
              <p className="text-sm text-slate-500">
                Recorded on {observation.observation_date}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Cow</div>
                <div className="font-medium text-slate-900">
                  {cow?.name ?? observation.cow_id}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Total Milk</div>
                <div className="font-medium text-slate-900">
                  {observation.milk_produced_liters ?? "—"} L
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Total Feed</div>
                <div className="font-medium text-slate-900">
                  {observation.feed_quantity_kg ?? "—"} kg
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Recorded by</div>
                <div className="font-medium text-slate-900">
                  {observation.observed_by ?? "Unknown"}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-slate-700 mb-2">Health Information</div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-500 font-medium">Condition</div>
                    <div className="mt-1 font-semibold capitalize text-slate-800">
                      {observation.health_condition || observation.symptoms?.condition || "Normal"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-500 font-medium">Body Temperature</div>
                    <div className="mt-1 font-semibold text-slate-800">
                      {observation.body_temperature_c != null ? `${observation.body_temperature_c} °C` : "—"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-500 font-medium">Body Condition (BCS)</div>
                    <div className="mt-1 font-semibold text-slate-800">
                      {observation.body_condition_score != null ? `${observation.body_condition_score} / 5.0` : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {observation.health_notes ? (
                <div>
                  <div className="text-sm text-slate-500">Health Notes</div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                    {observation.health_notes}
                  </div>
                </div>
              ) : null}

              <div>
                <div className="text-sm text-slate-500">General Notes</div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                  {observation.notes ?? "No additional notes."}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
