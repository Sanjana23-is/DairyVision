import { useState } from "react";
import Sidebar from "@/components/sidebar/Sidebar";
import Navbar from "@/components/navbar/Navbar";
import ResponsiveTopbar from "@/components/sidebar/ResponsiveTopbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090B] text-slate-900 dark:text-[#F4F4F5] transition-colors duration-200">
      <ResponsiveTopbar onOpen={() => setIsMobileSidebarOpen(true)} />

      {isMobileSidebarOpen ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs md:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#0D0E10] p-4 shadow-xl md:hidden">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">Menu</div>
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="rounded-md bg-slate-100 dark:bg-[#151719] px-3 py-2 text-sm text-slate-700 dark:text-[#A1A1AA] hover:dark:text-[#F4F4F5]"
              >
                Close
              </button>
            </div>
            <Sidebar />
          </aside>
        </>
      ) : null}

      <div className="flex min-h-screen">
        <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-30 md:block md:w-64">
          <Sidebar />
        </aside>

        <div className="flex-1 min-h-screen md:pl-64 flex flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200 dark:border-[#27272A] bg-white/90 dark:bg-[#0D0E10]/90 backdrop-blur-md transition-colors duration-200">
            <Navbar />
          </header>

          <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
