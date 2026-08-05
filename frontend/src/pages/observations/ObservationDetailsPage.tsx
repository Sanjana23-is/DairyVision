import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/layouts/DashboardLayout";
import { fetchObservation } from "@/services/observation";

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

  const symptomList = (() => {
    if (!observation?.symptoms) return [];
    const symptoms = observation.symptoms;
    if (Array.isArray(symptoms.signs)) return symptoms.signs;
    if (typeof symptoms === "object") {
      return Object.entries(symptoms)
        .filter(([key, value]) => key !== "condition" && value === true)
        .map(([key]) => key.replace(/_/g, " "));
    }
    return [];
  })();

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
              <p className="text-sm text-slate-500">Recorded on {observation.observation_date}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Cow</div>
                <div className="font-medium text-slate-900">{observation.cow?.name ?? observation.cow_id}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Total Milk</div>
                <div className="font-medium text-slate-900">{observation.milk_produced_liters ?? "—"} L</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Total Feed</div>
                <div className="font-medium text-slate-900">{observation.feed_quantity_kg ?? "—"} kg</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Recorded by</div>
                <div className="font-medium text-slate-900">{observation.observed_by ?? "Unknown"}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-slate-500">Condition</div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                  {observation.symptoms?.condition ? observation.symptoms.condition.replace(/_/g, " ") : "Not specified"}
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-500">Symptoms</div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                  {symptomList.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-5">
                      {symptomList.map((symptom) => (
                        <li key={symptom}>{symptom}</li>
                      ))}
                    </ul>
                  ) : (
                    "None"
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-500">Notes</div>
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
