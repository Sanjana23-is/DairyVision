import { Menu } from "lucide-react";

export default function ResponsiveTopbar({ onOpen }: { onOpen?: () => void }) {
  return (
    <div className="md:hidden border-b border-slate-100 bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onOpen} className="p-2 text-slate-700">
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-sm font-semibold text-sky-700">
            DairyVision AI
          </div>
        </div>
      </div>
    </div>
  );
}
