import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { fetchBreeds } from "@/services/breed";
import { useLanguage } from "@/context/LanguageContext";
import { getBreedLabel, getStatusLabel } from "@/lib/i18n-helpers";

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
  const { t } = useLanguage();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs px-4">
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
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#151719] border border-slate-200 dark:border-[#27272A] p-6 shadow-xl text-slate-900 dark:text-[#F4F4F5]"
      >
        <h3 className="mb-4 text-lg font-bold text-slate-900 dark:text-[#F4F4F5]">{t("cows.add_cow", "Add Cow")}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">{t("cows.name", "Name")}</label>
            <input
              placeholder={t("cows.enter_cow_name", "Enter cow name (e.g. Ganga)")}
              className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              {...register("name")}
            />
            {errors.name && (
              <div className="text-rose-600 dark:text-rose-400 text-xs mt-1">
                {String(errors.name.message)}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">{t("cows.tag_id", "Tag ID")}</label>
            <input
              placeholder={t("cows.enter_tag_id", "Enter unique tag ID (e.g. COW-001)")}
              className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              {...register("tag")}
            />
            {errors.tag && (
              <div className="text-rose-600 dark:text-rose-400 text-xs mt-1">
                {String(errors.tag.message)}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">{t("cows.age", "Age")}</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  type="number"
                  min="0"
                  placeholder={t("cows.years", "Years")}
                  className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  {...register("age_years")}
                />
                {errors.age_years && (
                  <div className="text-rose-600 dark:text-rose-400 text-xs mt-1">
                    {String(errors.age_years.message)}
                  </div>
                )}
              </div>
              <div>
                <input
                  type="number"
                  min="0"
                  max="11"
                  placeholder={t("cows.months", "Months")}
                  className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  {...register("age_months_part")}
                />
                {errors.age_months_part && (
                  <div className="text-rose-600 dark:text-rose-400 text-xs mt-1">
                    {String(errors.age_months_part.message)}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">{t("cows.weight_kg", "Weight (kg)")}</label>
            <input
              type="number"
              step="any"
              placeholder="500"
              className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              {...register("weight_kg")}
            />
            {errors.weight_kg && (
              <div className="text-rose-600 dark:text-rose-400 text-xs mt-1">
                {String(errors.weight_kg.message)}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">{t("cows.breed", "Breed")}</label>
            <select
              className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              {...register("breed")}
            >
              <option value="" className="dark:bg-[#1B1D20] dark:text-[#F4F4F5]">{t("cows.select_breed", "Select Breed")}</option>
              {breeds.map((b) => (
                <option key={b.id} value={b.id} className="dark:bg-[#1B1D20] dark:text-[#F4F4F5]">
                  {getBreedLabel(b.canonical_name, t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">{t("cows.status", "Status")}</label>
            <select
              className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              {...register("status")}
            >
              <option value="" className="dark:bg-[#1B1D20] dark:text-[#F4F4F5]">{t("cows.select_status", "Select Status")}</option>
              <option value="active" className="dark:bg-[#1B1D20] dark:text-[#F4F4F5]">{getStatusLabel("active", t)}</option>
              <option value="dry" className="dark:bg-[#1B1D20] dark:text-[#F4F4F5]">{getStatusLabel("dry", t)}</option>
              <option value="sick" className="dark:bg-[#1B1D20] dark:text-[#F4F4F5]">{getStatusLabel("sick", t)}</option>
              <option value="deceased" className="dark:bg-[#1B1D20] dark:text-[#F4F4F5]">{getStatusLabel("deceased", t)}</option>
              <option value="sold" className="dark:bg-[#1B1D20] dark:text-[#F4F4F5]">{getStatusLabel("sold", t)}</option>
            </select>
            {errors.status && (
              <div className="text-rose-600 dark:text-rose-400 text-xs mt-1">
                {String(errors.status.message)}
              </div>
            )}
          </div>

          {submitError && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {submitError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-4 py-2 text-sm font-semibold text-slate-700 dark:text-[#F4F4F5] hover:bg-slate-50 dark:hover:bg-[#222428]"
              disabled={isSubmitting}
            >
              {t("common.cancel", "Cancel")}
            </button>
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60 shadow-xs"
              disabled={isSubmitting}
            >
              {isSubmitting ? t("common.saving", "Saving...") : t("common.create", "Create")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
