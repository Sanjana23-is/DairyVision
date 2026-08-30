import DashboardLayout from "@/layouts/DashboardLayout";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPredictions, type MilkPrediction } from "@/services/prediction";
import { fetchExplainabilityByPrediction } from "@/services/explainability";
import FeatureImportanceChart from "@/components/explainability/FeatureImportanceChart";
import TopContributorsCard from "@/components/explainability/TopContributorsCard";
import { useAuth } from "@/context/AuthContext";

export default function ExplainabilityPage() {
  const [search] = useSearchParams();
  const queryPredId = search.get("predictionId");
  const { currentFarmId } = useAuth();

  const { data: predictions = [] } = useQuery<MilkPrediction[], Error>({
    queryKey: ["predictions", currentFarmId],
    queryFn: () => fetchPredictions(currentFarmId as string),
    enabled: !!currentFarmId,
  });

  const predictionId = queryPredId ?? predictions[0]?.id ?? null;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["explainability", predictionId],
    queryFn: () => fetchExplainabilityByPrediction(predictionId as string),
    enabled: !!predictionId,
  });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl">
        <h2 className="text-2xl font-semibold">SHAP Explainability</h2>

        <div className="mt-6">
          {!predictionId ? (
            <div className="rounded-2xl border bg-white p-6 text-slate-600">
              No prediction selected.
            </div>
          ) : isLoading ? (
            <div className="rounded-2xl border bg-white p-6 text-slate-600">
              Loading explainability...
            </div>
          ) : isError ? (
            <div className="rounded-2xl border bg-rose-50 p-6 text-rose-700">
              Error: {(error as any)?.message ?? "Unknown"}
            </div>
          ) : !data || (data.features || []).length === 0 ? (
            <div className="rounded-2xl border bg-white p-6 text-slate-600">
              Explainability data is empty.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <FeatureImportanceChart features={data.features} />
              </div>
              <div className="space-y-4">
                <TopContributorsCard
                  title="Top Positive Contributors"
                  items={data.top_positive ?? []}
                />
                <TopContributorsCard
                  title="Top Negative Contributors"
                  items={data.top_negative ?? []}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
