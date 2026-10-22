import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { getFarmerDisplayName } from "@/utils/userUtils";
import FarmLocationPicker, {
  FarmLocationData,
} from "./FarmLocationPicker";

const schema = z.object({
  name: z.string().min(1, "Farm name is required"),
  farmer_name: z.string().min(1, "Farmer name is required").optional(),
  description: z.string().optional(),
  location_city: z.string().optional(),
  location_country: z.string().optional(),
  latitude: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().min(-90, "Latitude must be >= -90").max(90, "Latitude must be <= 90").optional(),
  ),
  longitude: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().min(-180, "Longitude must be >= -180").max(180, "Longitude must be <= 180").optional(),
  ),
});
type FormData = z.infer<typeof schema>;

const initialLocationData: FarmLocationData = {
  country: "India",
  state: "",
  district: "",
  taluk: "",
  village: "",
  location_city: "",
  latitude: undefined,
  longitude: undefined,
};

export default function AddFarmDialog({
  open,
  onClose,
  onCreate,
  loading,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: FormData) => void;
  loading?: boolean;
  error?: string;
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const resolver = zodResolver(schema) as unknown as Resolver<FormData>;

  const [locationData, setLocationData] =
    useState<FarmLocationData>(initialLocationData);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver });

  useEffect(() => {
    if (open) {
      const defaultFarmerName = getFarmerDisplayName(user);
      reset({
        name: "",
        farmer_name: defaultFarmerName !== "Farmer" ? defaultFarmerName : "",
        description: "",
        location_city: "",
        location_country: "India",
        latitude: undefined,
        longitude: undefined,
      });
      setLocationData(initialLocationData);
    }
  }, [open, reset, user]);

  const handleLocationChange = (newData: FarmLocationData) => {
    setLocationData(newData);
    setValue("location_city", newData.location_city || undefined);
    setValue("location_country", "India");
    setValue("latitude", newData.latitude);
    setValue("longitude", newData.longitude);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 px-4 backdrop-blur-xs">
      <form
        onSubmit={handleSubmit((v) => onCreate(v))}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#151719] border border-slate-200 dark:border-[#27272A] p-6 shadow-xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272A] pb-3">
          <h3 className="text-lg font-bold text-slate-900 dark:text-[#F4F4F5]">
            {t("farm.modal_create_title", "Create Farm")}
          </h3>
          <span className="text-xs text-slate-500 dark:text-[#A1A1AA]">
            DairyVision AI
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-[#F4F4F5]">
              {t("farm.farmer_name", "Farmer's Full Name")} <span className="text-rose-500">*</span>
            </label>
            <input
              placeholder="e.g. Ramesh Patel"
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-xs text-slate-900 dark:text-[#F4F4F5] focus:border-emerald-600 focus:outline-none"
              {...register("farmer_name")}
            />
            {errors.farmer_name && (
              <div className="text-rose-600 dark:text-rose-400 text-xs mt-0.5">
                {String(errors.farmer_name.message)}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-[#F4F4F5]">
              {t("farm.field_name", "Farm Name")} <span className="text-rose-500">*</span>
            </label>
            <input
              placeholder="e.g. Kaveri Dairy Farm"
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-xs text-slate-900 dark:text-[#F4F4F5] focus:border-emerald-600 focus:outline-none"
              {...register("name")}
            />
            {errors.name && (
              <div className="text-rose-600 dark:text-rose-400 text-xs mt-0.5">
                {String(errors.name.message)}
              </div>
            )}
          </div>

          {/* Indian Farm Location Hierarchy & Geolocation */}
          <FarmLocationPicker
            value={locationData}
            onChange={handleLocationChange}
            error={errors.latitude?.message || errors.longitude?.message}
          />

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-[#F4F4F5]">
              {t("farm.description", "Description")}
            </label>
            <textarea
              rows={2}
              placeholder="e.g. 25 Holstein-Friesian herd with automated milking..."
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-xs text-slate-900 dark:text-[#F4F4F5] focus:border-emerald-600 focus:outline-none resize-none"
              {...register("description")}
            />
          </div>

          {error && (
            <div className="text-rose-600 dark:text-rose-400 text-xs mt-1">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#27272A]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-4 py-2 text-xs font-semibold text-slate-700 dark:text-[#F4F4F5] hover:bg-slate-50 dark:hover:bg-[#151719]"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Farm"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
