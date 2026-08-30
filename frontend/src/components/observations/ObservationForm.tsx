import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Observation } from "@/services/observation";

const positiveNumberOrEmpty = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return undefined;
  const n = Number(val);
  return Number.isNaN(n) ? undefined : n;
}, z.number().min(0, "Must be at least 0").optional());

const schema = z.object({
  cow_id: z.string().min(1, "Select a cow"),
  observation_date: z.string().min(1, "Select a date"),
  milk_produced_liters: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    const n = Number(val);
    return Number.isNaN(n) ? undefined : n;
  }, z.number().min(0, "Must be at least 0")),
  feed_quantity_kg: positiveNumberOrEmpty,
  condition: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.enum(["healthy", "slightly_abnormal", "abnormal"]).optional(),
  ),
  notes: z.string().max(2000).optional(),
});

type FormData = z.infer<typeof schema>;

export default function ObservationForm({
  open,
  observation,
  cowOptions,
  onClose,
  onSave,
}: {
  open: boolean;
  observation?: Observation | null;
  cowOptions?: Array<{ id: string; name?: string }>;
  onClose: () => void;
  onSave: (payload: Partial<Observation>) => Promise<any> | any;
}) {
  const resolver = zodResolver(schema) as unknown as Resolver<FormData>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver,
    defaultValues: {
      cow_id: "",
      observation_date: new Date().toISOString().slice(0, 10),
      milk_produced_liters: undefined,
      feed_quantity_kg: undefined,
      condition: undefined,
      notes: undefined,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (observation) {
      const cond = observation.symptoms?.condition;
      reset({
        cow_id: observation.cow_id ?? "",
        observation_date:
          observation.observation_date ?? new Date().toISOString().slice(0, 10),
        milk_produced_liters: observation.milk_produced_liters ?? undefined,
        feed_quantity_kg: observation.feed_quantity_kg ?? undefined,
        condition:
          typeof cond === "string" &&
          ["healthy", "slightly_abnormal", "abnormal"].includes(cond)
            ? (cond as any)
            : undefined,
        notes: observation.notes ?? undefined,
      });
    } else {
      reset({
        cow_id: "",
        observation_date: new Date().toISOString().slice(0, 10),
        milk_produced_liters: undefined,
        feed_quantity_kg: undefined,
        condition: undefined,
        notes: undefined,
      });
    }
  }, [open, observation, reset]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!open) return null;

  async function submit(values: FormData) {
    setSaving(true);
    setSaveError(null);
    try {
      const payload: Partial<Observation> = {
        cow_id: values.cow_id,
        observation_date: values.observation_date,
        milk_produced_liters: values.milk_produced_liters,
        feed_quantity_kg: values.feed_quantity_kg,
        symptoms: values.condition ? { condition: values.condition } : undefined,
        notes: values.notes,
      } as any;

      const result = onSave(payload);
      if (result && typeof (result as Promise<any>).then === "function") {
        await result;
      }
      onClose();
    } catch (err: any) {
      setSaveError(err?.message ?? String(err ?? "Failed to save"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <form
        onSubmit={handleSubmit(submit)}
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {observation ? "Edit Observation" : "New Observation"}
            </h3>
            <p className="text-sm text-slate-500">
              Quick daily observation — under 30 seconds.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-600"
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">Cow</span>
            {cowOptions && cowOptions.length > 0 ? (
              <select
                {...register("cow_id")}
                className="h-12 w-full rounded-2xl border px-4"
              >
                <option value="">Select a cow</option>
                {cowOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name ?? c.id}
                  </option>
                ))}
              </select>
            ) : (
              <input
                {...register("cow_id")}
                placeholder="Cow ID"
                className="h-12 w-full rounded-2xl border px-4"
              />
            )}
            {errors.cow_id && (
              <div className="text-rose-600 text-xs">
                {errors.cow_id.message}
              </div>
            )}
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Date</span>
            <input
              type="date"
              {...register("observation_date")}
              className="h-12 w-full rounded-2xl border px-4"
            />
            {errors.observation_date && (
              <div className="text-rose-600 text-xs">
                {errors.observation_date.message}
              </div>
            )}
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">Total milk produced (L)</span>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              {...register("milk_produced_liters")}
              placeholder="e.g. 12.5"
              className="h-12 w-full rounded-2xl border px-4"
            />
            {errors.milk_produced_liters && (
              <div className="text-rose-600 text-xs">
                {errors.milk_produced_liters.message}
              </div>
            )}
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Total feed quantity (kg)</span>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              {...register("feed_quantity_kg")}
              placeholder="Optional"
              className="h-12 w-full rounded-2xl border px-4"
            />
            {errors.feed_quantity_kg && (
              <div className="text-rose-600 text-xs">
                {errors.feed_quantity_kg.message}
              </div>
            )}
          </label>
        </div>

        <label className="mt-4 block space-y-1">
          <span className="text-sm font-medium">Condition (optional)</span>
          <select
            {...register("condition")}
            className="h-12 w-full rounded-2xl border px-4"
          >
            <option value="">Not specified</option>
            <option value="healthy">Healthy</option>
            <option value="slightly_abnormal">Slightly Abnormal</option>
            <option value="abnormal">Abnormal</option>
          </select>
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-medium">Notes</span>
          <textarea
            {...register("notes")}
            rows={4}
            className="mt-2 w-full rounded-2xl border px-3 py-2"
            placeholder="Optional notes"
          />
          {errors.notes && (
            <div className="text-rose-600 text-xs">{errors.notes.message}</div>
          )}
        </label>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-2xl border px-4"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-12 rounded-2xl bg-sky-600 px-4 text-white"
          >
            {saving ? "Saving…" : "Save observation"}
          </button>
        </div>
        {saveError && <div className="mt-3 text-rose-600">{saveError}</div>}
      </form>
    </div>
  );
}
