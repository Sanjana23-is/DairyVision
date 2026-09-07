import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
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
  const resolver = zodResolver(schema) as unknown as Resolver<FormData>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver });


  useEffect(() => {
    if (open) {
      reset({
        name: "",
        description: "",
        location_city: "",
        location_country: "",
        latitude: undefined,
        longitude: undefined,
      });
    }
  }, [open, reset]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 px-4 backdrop-blur-xs">
      <form
        onSubmit={handleSubmit((v) => onCreate(v))}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#151719] border border-slate-200 dark:border-[#27272A] p-6 shadow-xl space-y-4"
      >
        <h3 className="text-lg font-bold text-slate-900 dark:text-[#F4F4F5]">Create Farm</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-[#F4F4F5]">Name</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-xs text-slate-900 dark:text-[#F4F4F5] focus:border-emerald-600 focus:outline-none"
              {...register("name")}
            />
            {errors.name && (
              <div className="text-rose-600 dark:text-rose-400 text-xs mt-0.5">
                {String(errors.name.message)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-[#F4F4F5]">City</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-xs text-slate-900 dark:text-[#F4F4F5] focus:border-emerald-600 focus:outline-none"
                {...register("location_city")}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-[#F4F4F5]">Country</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-xs text-slate-900 dark:text-[#F4F4F5] focus:border-emerald-600 focus:outline-none"
                {...register("location_country")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-[#F4F4F5]">Latitude (optional)</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 12.9716"
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-xs text-slate-900 dark:text-[#F4F4F5] focus:border-emerald-600 focus:outline-none"
                {...register("latitude")}
              />
              {errors.latitude && (
                <div className="text-rose-600 dark:text-rose-400 text-xs mt-0.5">
                  {String(errors.latitude.message)}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-[#F4F4F5]">Longitude (optional)</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 77.5946"
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-xs text-slate-900 dark:text-[#F4F4F5] focus:border-emerald-600 focus:outline-none"
                {...register("longitude")}
              />
              {errors.longitude && (
                <div className="text-rose-600 dark:text-rose-400 text-xs mt-0.5">
                  {String(errors.longitude.message)}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-[#F4F4F5]">Description</label>
            <textarea
              rows={2}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-xs text-slate-900 dark:text-[#F4F4F5] focus:border-emerald-600 focus:outline-none resize-none"
              {...register("description")}
            />
          </div>

          {error && <div className="text-rose-600 dark:text-rose-400 text-xs mt-1">{error}</div>}

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
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
