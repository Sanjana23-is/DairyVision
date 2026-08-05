import { Bell, User, MapPin } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, currentFarmName } = useAuth();

  return (
    <div className="flex items-center justify-between px-6 py-3">
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
          <MapPin className="h-4 w-4 text-slate-500" />
          <span>
            Current Farm:{" "}
            <strong className="ml-1">
              {currentFarmName ?? "Not selected"}
            </strong>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-xxs text-white">
            3
          </span>
        </button>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-sm text-slate-700">
            {user?.full_name || user?.email || "User"}
          </div>
          <div className="rounded-full bg-slate-200 p-2">
            <User className="h-5 w-5 text-slate-600" />
          </div>
        </div>
      </div>
    </div>
  );
}
