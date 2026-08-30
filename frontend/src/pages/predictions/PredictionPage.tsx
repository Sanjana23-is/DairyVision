import DashboardLayout from "@/layouts/DashboardLayout";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchObservations } from "@/services/observation";
import { fetchCows, Cow } from "@/services/cow";
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
    queryFn: () => fetchObservations(currentFarmId as string),
    enabled: !!currentFarmId,
  });

  const { data: cows = [] } = useQuery<Cow[], Error>({
    queryKey: ["cows", currentFarmId],
    queryFn: () => fetchCows(currentFarmId as string),
    enabled: !!currentFarmId,
  });

  const cowNameById = useMemo(() => {
    const map = new Map<string, string>();
    cows.forEach((cow) => map.set(cow.id, cow.name || cow.id));
    return map;
  }, [cows]);

  const cowName = (id: string) => cowNameById.get(id) ?? id;

  const { data: predictions = [] } = useQuery({
    queryKey: ["predictions", currentFarmId],
    queryFn: () => fetchPredictions(currentFarmId as string),
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
    mutationFn: (obsId: string) => createPredictionForObservation(obsId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["predictions", currentFarmId] });
      setLatestPrediction(data);
      setToast({
        type: "success",
        message: "Prediction generated successfully.",
      });
    },
    onError: (err) => {
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        "Unable to generate prediction.";
      const message = typeof detail === "string" ? detail : JSON.stringify(detail);
      setToast({
        type: "error",
        message,
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

  const obsMap = useMemo(() => {
    const map = new Map<string, any>();
    observations.forEach((o: any) => map.set(o.id, o));
    return map;
  }, [observations]);

  const latest = latestPrediction ?? predictions[0] ?? null;
  const latestObs = latest?.observation_id ? obsMap.get(latest.observation_id) : null;
  const latestCowId = latest?.cow_id || latestObs?.cow_id;
  const latestCowName = latestCowId ? cowName(latestCowId) : undefined;
  const latestObsDate = latestObs?.observation_date ?? undefined;

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
                        {o.observation_date} — {cowName(o.cow_id)}
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
                  <PredictionCard
                    prediction={latest}
                    cowName={latestCowName}
                    observationDate={latestObsDate}
                  />
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
