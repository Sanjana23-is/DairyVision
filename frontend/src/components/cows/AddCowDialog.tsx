import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  name: z.string().min(1),
  tag: z.string().optional(),
  breed: z.string().optional(),
  status: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function AddCowDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: Partial<FormData>) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

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
          </div>
          <div>
            <label className="text-sm">Breed</label>
            <input
              className="w-full rounded border px-2 py-1"
              {...register("breed")}
            />
          </div>
          <div>
            <label className="text-sm">Status</label>
            <select
              className="w-full rounded border px-2 py-1"
              {...register("status")}
            >
              <option value="">Select status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border px-3 py-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-sky-600 px-3 py-1 text-white"
            >
              Create
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
