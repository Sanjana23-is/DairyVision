import Sidebar from "@/components/sidebar/Sidebar";
import Navbar from "@/components/navbar/Navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <aside className="hidden md:block">
          <Sidebar />
        </aside>

        <div className="flex-1 min-h-screen">
          <header className="sticky top-0 z-30 bg-white shadow-sm">
            <Navbar />
          </header>

          <main className="p-6 md:p-8 lg:p-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
