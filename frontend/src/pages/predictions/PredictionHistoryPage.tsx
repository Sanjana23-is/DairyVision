import DashboardLayout from "@/layouts/DashboardLayout";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPredictions,
  deletePrediction,
  type MilkPrediction,
} from "@/services/prediction";
import { fetchCows, Cow } from "@/services/cow";
import { useAuth } from "@/context/AuthContext";
import DeletePredictionDialog from "@/components/predictions/DeletePredictionDialog";
import PredictionHistoryTable from "@/components/predictions/PredictionHistoryTable";
import PredictionDetailsModal from "@/components/predictions/PredictionDetailsModal";

import { fetchObservations } from "@/services/observation";

export default function PredictionHistoryPage() {
  const qc = useQueryClient();
  const { currentFarmId } = useAuth();
  const [detailsPrediction, setDetailsPrediction] =
    useState<MilkPrediction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MilkPrediction | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const {
    data = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["predictions", currentFarmId],
    queryFn: () => fetchPredictions(currentFarmId as string),
    enabled: !!currentFarmId,
  });

  const { data: observations = [] } = useQuery({
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

  const obsDateById = useMemo(() => {
    const map = new Map<string, string>();
    observations.forEach((o: any) => {
      if (o.id && o.observation_date) {
        map.set(o.id, o.observation_date);
      }
    });
    return map;
  }, [observations]);

  const deleteMutation = useMutation<void, any, string>({
    mutationFn: deletePrediction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["predictions", currentFarmId] });
      setToast({
        type: "success",
        message: "Prediction deleted successfully.",
      });
      setDeleteTarget(null);
    },
    onError: (err) => {
      setToast({
        type: "error",
        message: err?.message || "Unable to delete prediction.",
      });
    },
  });

  const handleDeleteConfirmation = (prediction: MilkPrediction) => {
    setDeleteTarget(prediction);
  };

  const handleDelete = (predictionId: string) => {
    deleteMutation.mutate(predictionId);
  };

  const handleCloseToast = () => setToast(null);

  const detailsCowName = detailsPrediction
    ? cowNameById.get(detailsPrediction.cow_id)
    : undefined;
  const detailsObsDate = detailsPrediction?.observation_id
    ? obsDateById.get(detailsPrediction.observation_id)
    : undefined;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl">
        <h2 className="text-2xl font-semibold">Prediction History</h2>

        {toast ? (
          <div className="mt-4 rounded-2xl border bg-white p-4 shadow-sm">
            <div
              className={`text-sm ${toast.type === "success" ? "text-sky-700" : "text-rose-700"}`}
            >
              {toast.message}
            </div>
            <button
              type="button"
              onClick={handleCloseToast}
              className="mt-3 text-xs text-slate-500 underline"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="mt-6">
          {isLoading ? (
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              Loading predictions...
            </div>
          ) : isError ? (
            <div className="rounded-2xl border bg-rose-50 p-6 text-rose-700">
              Error loading predictions. {(error as any)?.message}
            </div>
          ) : (
            <PredictionHistoryTable
              data={data}
              cowNameById={cowNameById}
              obsDateById={obsDateById}
              onOpenDetails={setDetailsPrediction}
              onRequestDelete={handleDeleteConfirmation}
              deletingId={deleteMutation.variables}
            />
          )}
        </div>
      </div>

      {detailsPrediction ? (
        <PredictionDetailsModal
          prediction={detailsPrediction}
          cowName={detailsCowName}
          observationDate={detailsObsDate}
          onClose={() => setDetailsPrediction(null)}
        />
      ) : null}


      {deleteTarget ? (
        <DeletePredictionDialog
          prediction={deleteTarget}
          cowName={cowNameById.get(deleteTarget.cow_id) ?? deleteTarget.cow_id}
          open={true}
          loading={deleteMutation.isPending}
          onClose={() => setDeleteTarget(null)}
          onDelete={handleDelete}
        />
      ) : null}
    </DashboardLayout>
  );
}
