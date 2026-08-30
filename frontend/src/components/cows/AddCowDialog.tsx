import { useForm } from "react-hook-form";
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
  onCreate: (payload: Partial<FormData>) => void;
  isSubmitting?: boolean;
  submitError?: string | null;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const { data: breeds = [] } = useQuery({
    queryKey: ["breeds"],
    queryFn: fetchBreeds,
    enabled: open,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <form
        onSubmit={handleSubmit((v) => onCreate(v))}
        className="w-full max-w-md rounded bg-white p-6 shadow-xl"
      >
        <h3 className="mb-4 text-lg font-semibold">Add Cow</h3>
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
          <div>
            <label className="text-sm">Tag</label>
            <input
              className="w-full rounded border px-2 py-1"
              {...register("tag")}
            />
            {errors.tag && (
              <div className="text-rose-600 text-xs">
                {String(errors.tag.message)}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm">Breed</label>
            <select
              className="w-full rounded border px-2 py-1"
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
            <label className="text-sm">Status</label>
            <select
              className="w-full rounded border px-2 py-1"
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
