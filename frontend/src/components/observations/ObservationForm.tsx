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
  health_condition: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? "normal" : val),
    z.enum([
      "normal",
      "fever",
      "mastitis",
      "lameness",
      "respiratory",
      "digestive",
      "other",
    ]),
  ),
  body_temperature_c: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    const n = Number(val);
    return Number.isNaN(n) ? undefined : n;
  }, z.number().positive("Body temperature must be positive").optional()),
  body_condition_score: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    const n = Number(val);
    return Number.isNaN(n) ? undefined : n;
  }, z.number().min(1.0, "BCS must be between 1.0 and 5.0").max(5.0, "BCS must be between 1.0 and 5.0").optional()),
  health_notes: z.string().max(2000).optional(),
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
      health_condition: "normal",
      body_temperature_c: undefined,
      body_condition_score: undefined,
      health_notes: undefined,
      notes: undefined,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (observation) {
      const cond = observation.health_condition || observation.symptoms?.condition;
      const validConds = [
        "normal",
        "fever",
        "mastitis",
        "lameness",
        "respiratory",
        "digestive",
        "other",
      ];
      reset({
        cow_id: observation.cow_id ?? "",
        observation_date:
          observation.observation_date ?? new Date().toISOString().slice(0, 10),
        milk_produced_liters: observation.milk_produced_liters ?? undefined,
        feed_quantity_kg: observation.feed_quantity_kg ?? undefined,
        health_condition:
          typeof cond === "string" && validConds.includes(cond.toLowerCase())
            ? (cond.toLowerCase() as any)
            : "normal",
        body_temperature_c: observation.body_temperature_c ?? undefined,
        body_condition_score: observation.body_condition_score ?? undefined,
        health_notes: observation.health_notes ?? undefined,
        notes: observation.notes ?? undefined,
      });
    } else {
      reset({
        cow_id: "",
        observation_date: new Date().toISOString().slice(0, 10),
        milk_produced_liters: undefined,
        feed_quantity_kg: undefined,
        health_condition: "normal",
        body_temperature_c: undefined,
        body_condition_score: undefined,
        health_notes: undefined,
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
        health_condition: values.health_condition || "normal",
        body_temperature_c: values.body_temperature_c,
        body_condition_score: values.body_condition_score,
        health_notes: values.health_notes,
        symptoms: { condition: values.health_condition || "normal" },
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
        className="w-full max-w-lg overflow-y-auto max-h-[90vh] rounded-3xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {observation ? "Edit Observation" : "New Observation"}
            </h3>
            <p className="text-sm text-slate-500">
              Daily observation & health check.
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

        {/* Structured Health Information Section */}
        <div className="mt-6 rounded-2xl border bg-slate-50 p-4 space-y-4">
          <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <span>🩺 Health Information</span>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Health Condition</span>
            <select
              {...register("health_condition")}
              className="h-12 w-full rounded-2xl border bg-white px-4 text-sm"
            >
              <option value="normal">Normal (Healthy)</option>
              <option value="fever">Fever / High Temp</option>
              <option value="mastitis">Mastitis / Udder Issue</option>
              <option value="lameness">Lameness / Leg Issue</option>
              <option value="respiratory">Respiratory / Coughing</option>
              <option value="digestive">Digestive / Bloat</option>
              <option value="other">Other Issue</option>
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Body Temperature (°C)</span>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                {...register("body_temperature_c")}
                placeholder="Optional (e.g. 38.5)"
                className="h-12 w-full rounded-2xl border bg-white px-4 text-sm"
              />
              <p className="text-xs text-slate-500">Leave blank if not measured.</p>
              {errors.body_temperature_c && (
                <div className="text-rose-600 text-xs">{errors.body_temperature_c.message}</div>
              )}
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Body Condition Score (BCS)</span>
              <input
                type="number"
                step="0.1"
                min="1.0"
                max="5.0"
                inputMode="decimal"
                {...register("body_condition_score")}
                placeholder="Optional (1.0 - 5.0)"
                className="h-12 w-full rounded-2xl border bg-white px-4 text-sm"
              />
              <p className="text-xs text-slate-500">1.0 (Thin) to 5.0 (Fat). Leave blank if not measured.</p>
              {errors.body_condition_score && (
                <div className="text-rose-600 text-xs">{errors.body_condition_score.message}</div>
              )}
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Health Notes</span>
            <input
              {...register("health_notes")}
              placeholder="Optional health details or observations"
              className="h-12 w-full rounded-2xl border bg-white px-4 text-sm"
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-medium">General Notes</span>
          <textarea
            {...register("notes")}
            rows={3}
            className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm"
            placeholder="Optional general notes"
          />
          {errors.notes && (
            <div className="text-rose-600 text-xs">{errors.notes.message}</div>
          )}
        </label>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-2xl border px-4 text-sm"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-12 rounded-2xl bg-sky-600 px-4 text-white text-sm"
          >
            {saving ? "Saving…" : "Save observation"}
          </button>
        </div>
        {saveError && <div className="mt-3 text-rose-600 text-sm">{saveError}</div>}
      </form>
    </div>
  );
}

