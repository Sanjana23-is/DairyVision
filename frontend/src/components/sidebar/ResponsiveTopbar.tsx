import { Menu } from "lucide-react";

export default function ResponsiveTopbar({ onOpen }: { onOpen?: () => void }) {
  return (
    <div className="md:hidden border-b border-slate-100 dark:border-[#27272A] bg-white dark:bg-[#0D0E10] px-4 py-3 text-slate-900 dark:text-[#F4F4F5] transition-colors duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onOpen}
            className="p-2 text-slate-700 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-[#F4F4F5]"
            aria-label="Open navigation menu"
            type="button"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-sm font-bold text-slate-900 dark:text-[#F4F4F5]">
            DairyVision <span className="text-emerald-600 dark:text-emerald-400">AI</span>
          </div>
        </div>
      </div>
    </div>
  );
}
