import { Recommendation } from "@/services/recommendation";

export default function RecommendationsTable({
  data,
  onOpenDetails,
  onRequestComplete,
  onRequestDelete,
}: {
  data: Recommendation[];
  onOpenDetails: (recommendation: Recommendation) => void;
  onRequestComplete: (recommendation: Recommendation) => void;
  onRequestDelete: (recommendation: Recommendation) => void;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-slate-600">
        No recommendations found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
      <table className="w-full table-auto">
        <thead className="bg-slate-50 text-left text-sm text-slate-600">
          <tr>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Cow</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="text-sm text-slate-700">
          {data.map((recommendation) => (
            <tr key={recommendation.id} className="border-t hover:bg-slate-50">
              <td className="px-4 py-3">{recommendation.title}</td>
              <td className="px-4 py-3">{recommendation.category}</td>
              <td className="px-4 py-3">{recommendation.priority}</td>
              <td className="px-4 py-3">
                {recommendation.cow?.name ?? recommendation.cow_id ?? "N/A"}
              </td>
              <td className="px-4 py-3">
                {new Date(recommendation.created_at).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                {recommendation.completed ? "Completed" : "Pending"}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenDetails(recommendation)}
                    className="rounded-2xl border px-3 py-1 text-sm"
                  >
                    Details
                  </button>
                  {!recommendation.completed ? (
                    <button
                      type="button"
                      onClick={() => onRequestComplete(recommendation)}
                      className="rounded-2xl border border-sky-600 px-3 py-1 text-sm text-sky-700"
                    >
                      Complete
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onRequestDelete(recommendation)}
                    className="rounded-2xl border border-rose-600 px-3 py-1 text-sm text-rose-700"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
