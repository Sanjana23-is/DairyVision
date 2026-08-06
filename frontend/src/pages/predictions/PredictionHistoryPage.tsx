import DashboardLayout from "@/layouts/DashboardLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPredictions,
  deletePrediction,
  type MilkPrediction,
} from "@/services/prediction";
import DeletePredictionDialog from "@/components/predictions/DeletePredictionDialog";
import PredictionHistoryTable from "@/components/predictions/PredictionHistoryTable";
import PredictionDetailsModal from "@/components/predictions/PredictionDetailsModal";

export default function PredictionHistoryPage() {
  const qc = useQueryClient();
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
    queryKey: ["predictions"],
    queryFn: fetchPredictions,
  });

  const deleteMutation = useMutation<void, any, string>({
    mutationFn: deletePrediction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["predictions"] });
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
          onClose={() => setDetailsPrediction(null)}
        />
      ) : null}

      {deleteTarget ? (
        <DeletePredictionDialog
          prediction={deleteTarget}
          open={true}
          loading={deleteMutation.isPending}
          onClose={() => setDeleteTarget(null)}
          onDelete={handleDelete}
        />
      ) : null}
    </DashboardLayout>
  );
}
