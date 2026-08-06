import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Farm } from "@/services/farm";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  location_city: z.string().optional(),
  location_country: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function EditFarmDialog({
  open,
  onClose,
  farm,
  onSave,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  farm: Farm | null;
  onSave: (id: string, payload: Partial<FormData>) => void;
  loading?: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  if (!open || !farm) return null;

  // populate when farm changes
  React.useEffect(() => {
    reset({
      name: farm.name,
      description: farm.description ?? undefined,
      location_city: farm.location_city ?? undefined,
      location_country: farm.location_country ?? undefined,
    });
  }, [farm, reset]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <form
        onSubmit={handleSubmit((v) => onSave(farm.id, v))}
        className="w-full max-w-md rounded bg-white p-6 shadow-xl"
      >
        <h3 className="mb-4 text-lg font-semibold">Edit Farm</h3>
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

          <div>
            <label className="text-sm">Description</label>
            <textarea
              className="w-full rounded border px-2 py-1"
              {...register("description")}
            />
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
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
