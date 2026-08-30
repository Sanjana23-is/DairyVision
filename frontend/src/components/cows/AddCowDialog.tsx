import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { fetchBreeds } from "@/services/breed";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  tag: z.string().min(1, "Tag is required"),
  breed: z.string().optional(),
  status: z.enum(["active", "dry", "sick", "deceased", "sold"], {
    message: "Status is required",
  }),
  age_years: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().min(0, "Years must be 0 or greater").optional(),
  ),
  age_months_part: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().min(0, "Months must be between 0 and 11").max(11, "Months must be between 0 and 11").optional(),
  ),
  weight_kg: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().positive("Weight must be greater than 0").optional(),
  ),
});
type FormData = z.infer<typeof schema>;

export default function AddCowDialog({
  open,
  onClose,
  onCreate,
  isSubmitting,
  submitError,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: Record<string, any>) => void;
  isSubmitting?: boolean;
  submitError?: string | null;
}) {
  const resolver = zodResolver(schema) as unknown as Resolver<FormData>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver });

  const { data: breeds = [] } = useQuery({
    queryKey: ["breeds"],
    queryFn: fetchBreeds,
    enabled: open,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <form
        onSubmit={handleSubmit((v) => {
          const yrs = v.age_years ?? 0;
          const mos = v.age_months_part ?? 0;
          const totalAgeMonths = (v.age_years !== undefined || v.age_months_part !== undefined)
            ? yrs * 12 + mos
            : undefined;

          onCreate({
            name: v.name,
            tag: v.tag,
            breed: v.breed,
            status: v.status,
            weight_kg: v.weight_kg,
            age_months: totalAgeMonths,
          });
        })}
        className="w-full max-w-md rounded bg-white p-6 shadow-xl"
      >
        <h3 className="mb-4 text-lg font-semibold">Add Cow</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-700">Name</label>
            <input
              className="w-full rounded border px-2 py-1 text-sm"
              {...register("name")}
            />
            {errors.name && (
              <div className="text-rose-600 text-xs">
                {String(errors.name.message)}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Tag</label>
            <input
              className="w-full rounded border px-2 py-1 text-sm"
              {...register("tag")}
            />
            {errors.tag && (
              <div className="text-rose-600 text-xs">
                {String(errors.tag.message)}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Age</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  type="number"
                  min="0"
                  placeholder="Years (e.g. 4)"
                  className="w-full rounded border px-2 py-1 text-sm"
                  {...register("age_years")}
                />
                {errors.age_years && (
                  <div className="text-rose-600 text-xs">
                    {String(errors.age_years.message)}
                  </div>
                )}
              </div>
              <div>
                <input
                  type="number"
                  min="0"
                  max="11"
                  placeholder="Months (0–11)"
                  className="w-full rounded border px-2 py-1 text-sm"
                  {...register("age_months_part")}
                />
                {errors.age_months_part && (
                  <div className="text-rose-600 text-xs">
                    {String(errors.age_months_part.message)}
                  </div>
                )}
              </div>
            </div>
            <div className="text-xs text-slate-400 mt-1">Approximate age is okay.</div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Weight (kg)</label>
            <input
              type="number"
              step="any"
              placeholder="e.g. 500"
              className="w-full rounded border px-2 py-1 text-sm"
              {...register("weight_kg")}
            />
            {errors.weight_kg && (
              <div className="text-rose-600 text-xs">
                {String(errors.weight_kg.message)}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Breed</label>
            <select
              className="w-full rounded border px-2 py-1 text-sm"
              {...register("breed")}
            >
              <option value="">Select breed</option>
              {breeds.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.canonical_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Status</label>
            <select
              className="w-full rounded border px-2 py-1 text-sm"
              {...register("status")}
            >
              <option value="">Select status</option>
              <option value="active">Active</option>
              <option value="dry">Dry</option>
              <option value="sick">Sick</option>
              <option value="deceased">Deceased</option>
              <option value="sold">Sold</option>
            </select>
            {errors.status && (
              <div className="text-rose-600 text-xs">
                {String(errors.status.message)}
              </div>
            )}
          </div>

          {submitError && (
            <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {submitError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border px-3 py-1"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-sky-600 px-3 py-1 text-white disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
