import { useEffect, useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Observation } from "@/services/observation";

// Zod schema and helpers
const positiveNumberOrEmpty = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return undefined;
  const n = Number(val);
  return Number.isNaN(n) ? undefined : n;
}, z.number().min(0, "Must be at least 0").optional());

const schema = z.object({
  cow_id: z.string().min(1, "Select a cow"),
  observation_date: z.string().min(1, "Select a date"),
  morning_milk: positiveNumberOrEmpty,
  evening_milk: positiveNumberOrEmpty,
  dry_fodder_kg: positiveNumberOrEmpty,
  green_fodder_kg: positiveNumberOrEmpty,
  concentrate_feed_kg: positiveNumberOrEmpty,
  body_weight_kg: positiveNumberOrEmpty,
  condition: z.enum(["healthy", "slightly_abnormal", "abnormal"]),
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
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver,
    defaultValues: {
      cow_id: "",
      observation_date: new Date().toISOString().slice(0, 10),
      morning_milk: undefined,
      evening_milk: undefined,
      dry_fodder_kg: undefined,
      green_fodder_kg: undefined,
      concentrate_feed_kg: undefined,
      body_weight_kg: undefined,
      condition: "healthy",
      notes: undefined,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (observation) {
      // Map observation to form fields. observation may store condition/body_weight inside `symptoms`.
      const cond =
        observation.symptoms?.condition ?? observation.symptoms?.condition;
      const bw =
        observation.symptoms?.body_weight_kg ??
        observation.symptoms?.body_weight_kg;

      reset({
        cow_id: observation.cow_id ?? "",
        observation_date:
          observation.observation_date ?? new Date().toISOString().slice(0, 10),
        // backend does not store morning_milk/evening_milk; keep form inputs empty for editing
        morning_milk: undefined,
        evening_milk: undefined,
        dry_fodder_kg: undefined,
        green_fodder_kg: undefined,
        concentrate_feed_kg: undefined,
        body_weight_kg: typeof bw === "number" ? bw : undefined,
        condition:
          typeof cond === "string" &&
          ["healthy", "slightly_abnormal", "abnormal"].includes(cond)
            ? (cond as any)
            : "healthy",
        notes: observation.notes ?? undefined,
      });
    } else {
      reset({
        cow_id: "",
        observation_date: new Date().toISOString().slice(0, 10),
        morning_milk: undefined,
        evening_milk: undefined,
        dry_fodder_kg: undefined,
        green_fodder_kg: undefined,
        concentrate_feed_kg: undefined,
        body_weight_kg: undefined,
        condition: "healthy",
        notes: undefined,
      });
    }
  }, [open, observation, reset]);

  const watched = watch([
    "morning_milk",
    "evening_milk",
    "dry_fodder_kg",
    "green_fodder_kg",
    "concentrate_feed_kg",
  ]);

  const totalMilk = useMemo(() => {
    const morning = watched[0];
    const evening = watched[1];
    if (morning === undefined && evening === undefined) {
      return undefined;
    }
    const m = Number(morning ?? 0);
    const e = Number(evening ?? 0);
    return (isFinite(m) ? m : 0) + (isFinite(e) ? e : 0);
  }, [watched]);

  const totalFeed = useMemo(() => {
    const dry = watched[2];
    const green = watched[3];
    const concentrate = watched[4];
    if (dry === undefined && green === undefined && concentrate === undefined) {
      return undefined;
    }
    const d = Number(dry ?? 0);
    const g = Number(green ?? 0);
    const c = Number(concentrate ?? 0);
    return (
      (isFinite(d) ? d : 0) + (isFinite(g) ? g : 0) + (isFinite(c) ? c : 0)
    );
  }, [watched]);

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
        // include summary fields the backend expects
        milk_produced_liters: totalMilk || undefined,
        dry_fodder_kg: values.dry_fodder_kg,
        green_fodder_kg: values.green_fodder_kg,
        concentrate_feed_kg: values.concentrate_feed_kg,
        feed_quantity_kg: totalFeed || undefined,
        symptoms: {
          condition: values.condition,
          body_weight_kg: values.body_weight_kg ?? undefined,
        },
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
        className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {observation ? "Edit Observation" : "New Observation"}
            </h3>
            <p className="text-sm text-slate-500">
              Minimal, touch-friendly observation form.
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

        <div className="mt-6 rounded-2xl border bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Milk</p>
              <p className="text-xs text-slate-500">
                Morning & evening — total computed
              </p>
            </div>
            <div className="text-sm font-semibold">
              Total: {totalMilk !== undefined ? totalMilk.toFixed(1) : "—"} L
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              {...register("morning_milk")}
              placeholder="Morning (L)"
              className="h-12 rounded-2xl border px-3"
            />
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              {...register("evening_milk")}
              placeholder="Evening (L)"
              className="h-12 rounded-2xl border px-3"
            />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Feed</p>
              <p className="text-xs text-slate-500">
                Dry, green, concentrate — total computed
              </p>
            </div>
            <div className="text-sm font-semibold">
              Total: {totalFeed !== undefined ? totalFeed.toFixed(1) : "—"} kg
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              {...register("dry_fodder_kg")}
              placeholder="Dry (kg)"
              className="h-12 rounded-2xl border px-3"
            />
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              {...register("green_fodder_kg")}
              placeholder="Green (kg)"
              className="h-12 rounded-2xl border px-3"
            />
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              {...register("concentrate_feed_kg")}
              placeholder="Concentrate (kg)"
              className="h-12 rounded-2xl border px-3"
            />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <label className="space-y-1">
              <span className="text-sm font-medium">Observed condition</span>
              <select
                {...register("condition")}
                className="h-12 w-full rounded-2xl border px-3"
              >
                <option value="healthy">Healthy</option>
                <option value="slightly_abnormal">Slightly Abnormal</option>
                <option value="abnormal">Abnormal</option>
              </select>
            </label>

            <div className="rounded-2xl bg-white p-3 text-sm text-slate-700">
              <div className="font-semibold text-xs uppercase tracking-wide text-slate-500">
                Weather
              </div>
              <div className="mt-2">
                Weather will be attached automatically.
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              {...register("body_weight_kg")}
              placeholder="Body weight (kg)"
              className="h-12 rounded-2xl border px-3"
            />
          </div>
        </div>

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
