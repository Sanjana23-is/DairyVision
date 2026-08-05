import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/layouts/DashboardLayout";
import { fetchCow } from "@/services/cow";

export default function CowDetailsPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const {
    data: cow,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["cow", id],
    queryFn: () => fetchCow(id as string),
    enabled: !!id,
  });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl">
        <button onClick={() => nav(-1)} className="mb-4 text-slate-600">
          Back
        </button>
        {isLoading ? (
          <div>Loading...</div>
        ) : isError ? (
          <div className="text-rose-600">
            Error: {(error as any)?.message ?? "Failed to load"}
          </div>
        ) : !cow ? (
          <div>No cow found.</div>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">{cow.name}</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="text-sm text-slate-500">Tag</div>
                <div className="font-medium">{cow.tag}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Breed</div>
                <div className="font-medium">{cow.breed}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Status</div>
                <div className="font-medium">{cow.status}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
