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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <ResponsiveTopbar onOpen={() => setIsMobileSidebarOpen(true)} />

      {isMobileSidebarOpen ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 bg-white p-4 shadow-xl md:hidden">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-semibold text-sky-700">Menu</div>
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700"
              >
                Close
              </button>
            </div>
            <Sidebar />
          </aside>
        </>
      ) : null}

      <div className="flex">
        <aside className="hidden md:block">
          <Sidebar />
        </aside>

        <div className="flex-1 min-h-screen">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
            <Navbar />
          </header>

          <main className="p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
