import DashboardLayout from "@/layouts/DashboardLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchObservations } from "@/services/observation";
import {
  createPredictionForObservation,
  fetchPredictions,
  type MilkPrediction,
} from "@/services/prediction";
import { useAuth } from "@/context/AuthContext";
import PredictionCard from "@/components/predictions/PredictionCard";
import PredictionListSkeleton from "@/components/predictions/PredictionListSkeleton";

export default function PredictionPage() {
  const qc = useQueryClient();
  const { currentFarmId } = useAuth();
  const {
    data: observations = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["observations", currentFarmId],
    queryFn: fetchObservations,
    enabled: !!currentFarmId,
  });

  const { data: predictions = [] } = useQuery({
    queryKey: ["predictions"],
    queryFn: fetchPredictions,
    enabled: !!currentFarmId,
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [latestPrediction, setLatestPrediction] =
    useState<MilkPrediction | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const mutation = useMutation<MilkPrediction, any, string>({
    mutationFn: (obsId: string) =>
      createPredictionForObservation(obsId, {
        farm_id: currentFarmId ?? undefined,
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["predictions"] });
      setLatestPrediction(data);
      setToast({
        type: "success",
        message: "Prediction generated successfully.",
      });
    },
    onError: (err) => {
      setToast({
        type: "error",
        message: err?.message || "Unable to generate prediction.",
      });
    },
  });

  const generate = (obsId: string) => {
    if (!currentFarmId) {
      setToast({
        type: "error",
        message: "Select a farm before generating predictions.",
      });
      return;
    }

    mutation.mutate(obsId);
  };

  const clearToast = () => setToast(null);

  const latest = latestPrediction ?? predictions[0] ?? null;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl">
        <h2 className="text-2xl font-semibold">Milk Prediction</h2>

        {toast ? (
          <div className="mt-4 rounded-2xl border bg-white p-4 shadow-sm">
            <div
              className={`text-sm ${toast.type === "success" ? "text-sky-700" : "text-rose-700"}`}
            >
              {toast.message}
            </div>
            <button
              type="button"
              onClick={clearToast}
              className="mt-3 text-xs text-slate-500 underline"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="text-sm font-medium text-slate-700">
                Select observation
              </div>
              {isLoading ? (
                <PredictionListSkeleton />
              ) : isError ? (
                <div className="mt-3 text-sm text-rose-600">
                  Error loading observations
                </div>
              ) : observations.length === 0 ? (
                <div className="mt-3 text-sm text-slate-500">
                  No observations available.
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <select
                    className="w-full rounded-2xl border p-3"
                    value={selected ?? ""}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    <option value="">Pick an observation</option>
                    {observations.map((o: any) => (
                      <option key={o.id} value={o.id}>
                        {o.observation_date} — {o.cow?.name ?? o.cow_id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  disabled={!selected || mutation.isPending}
                  onClick={() => selected && generate(selected)}
                  className="h-12 rounded-2xl bg-sky-600 px-4 text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {mutation.isPending ? "Generating…" : "Generate Prediction"}
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="text-sm font-medium text-slate-700">
                Latest Prediction
              </div>
              <div className="mt-3">
                {latest ? (
                  <PredictionCard prediction={latest} />
                ) : (
                  <div className="text-sm text-slate-500">
                    No prediction generated yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
