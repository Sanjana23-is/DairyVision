export function PageLoadingFallback() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center font-sans select-none">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
          <svg
            className="h-6 w-6 text-emerald-400 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1" />
          </svg>
        </div>
        <p className="text-xs font-medium text-slate-400 tracking-wide animate-pulse">
          Loading view...
        </p>
      </div>
    </div>
  );
}

export default PageLoadingFallback;
