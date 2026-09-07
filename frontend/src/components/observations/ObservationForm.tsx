import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Observation } from "@/services/observation";
import { useLanguage } from "@/context/LanguageContext";
import { getConditionLabel } from "@/lib/i18n-helpers";

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
  const { t } = useLanguage();
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
        className="w-full max-w-lg overflow-y-auto max-h-[90vh] rounded-3xl bg-white dark:bg-[#151719] border border-slate-200 dark:border-[#27272A] p-6 shadow-xl text-slate-900 dark:text-[#F4F4F5]"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-[#F4F4F5]">
              {observation ? t("cows.edit_cow", "Edit Observation") : t("obs.add_observation", "New Observation")}
            </h3>
            <p className="text-sm text-slate-500 dark:text-[#A1A1AA]">
              {t("obs.subtitle", "Daily observation & health check.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-[#F4F4F5]"
          >
            {t("common.close", "Close")}
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">{t("obs.cow", "Cow")}</span>
            {cowOptions && cowOptions.length > 0 ? (
              <select
                {...register("cow_id")}
                className="h-12 w-full rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-4 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="" className="dark:bg-[#1B1D20]">{t("obs.select_cow", "Select Cow")}</option>
                {cowOptions.map((c) => (
                  <option key={c.id} value={c.id} className="dark:bg-[#1B1D20]">
                    {c.name ?? c.id}
                  </option>
                ))}
              </select>
            ) : (
              <input
                {...register("cow_id")}
                placeholder={t("cows.cow_tag_id", "Cow ID")}
                className="h-12 w-full rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-4 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            )}
            {errors.cow_id && (
              <div className="text-rose-600 text-xs">
                {errors.cow_id.message}
              </div>
            )}
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">{t("obs.date", "Date")}</span>
            <input
              type="date"
              {...register("observation_date")}
              className="h-12 w-full rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-4 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
            <span className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">{t("obs.milk_yield_l", "Milk Yield (L)")}</span>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              {...register("milk_produced_liters")}
              placeholder="12.5"
              className="h-12 w-full rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-4 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {errors.milk_produced_liters && (
              <div className="text-rose-600 text-xs">
                {errors.milk_produced_liters.message}
              </div>
            )}
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">{t("obs.feed_kg", "Feed (kg)")}</span>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              {...register("feed_quantity_kg")}
              placeholder={t("common.optional", "Optional")}
              className="h-12 w-full rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-4 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {errors.feed_quantity_kg && (
              <div className="text-rose-600 text-xs">
                {errors.feed_quantity_kg.message}
              </div>
            )}
          </label>
        </div>

        {/* Structured Health Information Section */}
        <div className="mt-6 rounded-2xl border border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#1B1D20] p-4 space-y-4">
          <div className="text-sm font-semibold text-slate-800 dark:text-[#F4F4F5] flex items-center gap-2">
            <span>🩺 {t("nav.health_alerts", "Health Information")}</span>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">{t("obs.health_condition", "Health Condition")}</span>
            <select
              {...register("health_condition")}
              className="h-12 w-full rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] px-4 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="normal" className="dark:bg-[#151719]">{getConditionLabel("normal", t)}</option>
              <option value="fever" className="dark:bg-[#151719]">{getConditionLabel("fever", t)}</option>
              <option value="mastitis" className="dark:bg-[#151719]">{getConditionLabel("mastitis", t)}</option>
              <option value="lameness" className="dark:bg-[#151719]">{getConditionLabel("lameness", t)}</option>
              <option value="digestive" className="dark:bg-[#151719]">{getConditionLabel("digestive", t)}</option>
              <option value="off_feed" className="dark:bg-[#151719]">{getConditionLabel("off_feed", t)}</option>
              <option value="other" className="dark:bg-[#151719]">{t("breeds.other", "Other Issue")}</option>
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">{t("obs.temperature", "Body Temperature (°C)")}</span>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                {...register("body_temperature_c")}
                placeholder="38.5"
                className="h-12 w-full rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] px-4 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-xs text-slate-500 dark:text-[#A1A1AA]">{t("common.optional", "Optional")}</p>
              {errors.body_temperature_c && (
                <div className="text-rose-600 text-xs">{errors.body_temperature_c.message}</div>
              )}
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">{t("obs.bcs", "Body Condition Score (BCS)")}</span>
              <input
                type="number"
                step="0.1"
                min="1.0"
                max="5.0"
                inputMode="decimal"
                {...register("body_condition_score")}
                placeholder="3.0"
                className="h-12 w-full rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] px-4 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-xs text-slate-500 dark:text-[#A1A1AA]">{t("obs.bcs_hint", "1.0 (Thin) to 5.0 (Fat).")}</p>
              {errors.body_condition_score && (
                <div className="text-rose-600 text-xs">{errors.body_condition_score.message}</div>
              )}
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">{t("common.notes", "Health Notes")}</span>
            <input
              {...register("health_notes")}
              placeholder={t("common.optional", "Optional health details or observations")}
              className="h-12 w-full rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719] px-4 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">{t("common.description", "General Notes")}</span>
          <textarea
            {...register("notes")}
            rows={3}
            className="mt-1 w-full rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder={t("common.optional", "Optional general notes")}
          />
          {errors.notes && (
            <div className="text-rose-600 text-xs">{errors.notes.message}</div>
          )}
        </label>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-4 text-sm font-semibold text-slate-700 dark:text-[#F4F4F5] hover:bg-slate-50 dark:hover:bg-[#222428]"
            disabled={saving}
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-12 rounded-2xl bg-emerald-600 px-4 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 shadow-xs"
          >
            {saving ? t("common.saving", "Saving…") : t("common.save", "Save observation")}
          </button>
        </div>
        {saveError && <div className="mt-3 text-rose-600 text-sm">{saveError}</div>}
      </form>
    </div>
  );
}

