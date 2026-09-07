export default function PredictionListSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-3xl border bg-white p-6 shadow-sm"
        >
          <div className="h-6 w-1/3 rounded-full bg-slate-200" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="h-4 rounded-full bg-slate-200" />
            <div className="h-4 rounded-full bg-slate-200" />
          </div>
          <div className="mt-4 h-4 rounded-full bg-slate-200" />
        </div>
      ))}
    </div>
  );
}
