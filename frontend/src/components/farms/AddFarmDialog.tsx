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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <form
        onSubmit={handleSubmit((v) => onCreate(v))}
        className="w-full max-w-md rounded bg-white p-6 shadow-xl"
      >
        <h3 className="mb-4 text-lg font-semibold">Create Farm</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm">Name</label>
            <input
              className="w-full rounded border px-2 py-1"
              {...register("name")}
            />
            {errors.name && (
              <div className="text-rose-600 text-xs">
                {String(errors.name.message)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm">City</label>
              <input
                className="w-full rounded border px-2 py-1"
                {...register("location_city")}
              />
            </div>

            <div>
              <label className="text-sm">Country</label>
              <input
                className="w-full rounded border px-2 py-1"
                {...register("location_country")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm">Latitude (optional)</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 12.9716"
                className="w-full rounded border px-2 py-1"
                {...register("latitude")}
              />
              {errors.latitude && (
                <div className="text-rose-600 text-xs">
                  {String(errors.latitude.message)}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm">Longitude (optional)</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 77.5946"
                className="w-full rounded border px-2 py-1"
                {...register("longitude")}
              />
              {errors.longitude && (
                <div className="text-rose-600 text-xs">
                  {String(errors.longitude.message)}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm">Description</label>
            <textarea
              className="w-full rounded border px-2 py-1"
              {...register("description")}
            />
          </div>


          {error && <div className="text-rose-600 text-sm mt-1">{error}</div>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border px-3 py-1"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-sky-600 px-3 py-1 text-white"
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
