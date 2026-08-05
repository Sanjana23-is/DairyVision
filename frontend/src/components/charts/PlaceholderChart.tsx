export default function PlaceholderChart({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm h-56 flex flex-col">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-700">{title}</div>
        <div className="text-xs text-slate-400">Placeholder</div>
      </div>

      <div className="mt-4 flex-1 items-center justify-center text-center text-slate-400">
        <svg
          className="mx-auto h-28 w-28 opacity-40"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="2" y="10" width="10" height="42" rx="2" fill="#E6E9EE" />
          <rect x="16" y="20" width="10" height="32" rx="2" fill="#E6E9EE" />
          <rect x="30" y="6" width="10" height="46" rx="2" fill="#E6E9EE" />
          <rect x="44" y="28" width="10" height="24" rx="2" fill="#E6E9EE" />
        </svg>
        <div className="mt-2 text-sm">Chart will appear here</div>
      </div>
    </div>
  );
}
