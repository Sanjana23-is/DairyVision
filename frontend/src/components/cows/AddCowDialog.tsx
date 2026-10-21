import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { fetchBreeds } from "@/services/breed";
import { useLanguage } from "@/context/LanguageContext";

const schema = z.object({
  name: z.string().min(1, "cows.validation_name_req"),
  tag: z.string().min(1, "cows.validation_tag_req"),
  breed: z.string().optional(),
  status: z.enum(["active", "dry", "sick", "deceased", "sold"], {
    message: "cows.validation_status_req",
  }),
  age_years: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().min(0, "cows.validation_years_min").optional(),
  ),
  age_months_part: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().min(0, "cows.validation_months_range").max(11, "cows.validation_months_range").optional(),
  ),
  weight_kg: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
    z.number().positive("cows.validation_weight_pos").optional(),
  ),
});
type FormData = z.infer<typeof schema>;

const initialValues: FormData = {
  name: "",
  tag: "",
  breed: "",
  status: "active" as const,
  age_years: undefined,
  age_months_part: undefined,
  weight_kg: undefined,
};

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
  if (!open) return null;

  return (
    <AddCowDialogContent
      open={open}
      onClose={onClose}
      onCreate={onCreate}
      isSubmitting={isSubmitting}
      submitError={submitError}
    />
  );
}

function AddCowDialogContent({
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
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver,
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [reset]);

  const { data: breeds = [] } = useQuery({
    queryKey: ["breeds"],
    queryFn: fetchBreeds,
    enabled: open,
  });

  const getBreedLabel = (b: { canonical_name?: string; name?: string }) => {
    const rawName = b.canonical_name || b.name || "";
    const slug = rawName.toLowerCase().trim().replace(/[\s.-]+/g, "_");
    return t(`breed.${slug}`, rawName);
  };

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
        <h3 className="mb-4 text-lg font-bold text-slate-900 dark:text-[#F4F4F5]">
          {t("cows.modal_title", "Add Cow")}
        </h3>
        <div className="space-y-3">
          <div>
            <label htmlFor="add-cow-name" className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">
              {t("cows.field_name", "Name")}
            </label>
            <input
              id="add-cow-name"
              data-testid="add-cow-name"
              className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              {...register("name")}
            />
            {errors.name && (
              <div className="text-rose-600 dark:text-rose-400 text-xs mt-1">
                {t(String(errors.name.message), "Name is required")}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="add-cow-tag" className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">
              {t("cows.field_tag", "Tag")}
            </label>
            <input
              id="add-cow-tag"
              data-testid="add-cow-tag"
              className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              {...register("tag")}
            />
            {errors.tag && (
              <div className="text-rose-600 dark:text-rose-400 text-xs mt-1">
                {t(String(errors.tag.message), "Tag is required")}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">
              {t("cows.field_age", "Age")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  id="add-cow-age-years"
                  data-testid="add-cow-age-years"
                  type="number"
                  min="0"
                  placeholder={t("cows.placeholder_age_years", "Years (e.g. 4)")}
                  className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  {...register("age_years")}
                />
                {errors.age_years && (
                  <div className="text-rose-600 dark:text-rose-400 text-xs mt-1">
                    {t(String(errors.age_years.message), "Years must be 0 or greater")}
                  </div>
                )}
              </div>
              <div>
                <input
                  id="add-cow-age-months"
                  data-testid="add-cow-age-months"
                  type="number"
                  min="0"
                  max="11"
                  placeholder={t("cows.placeholder_age_months", "Months (0–11)")}
                  className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  {...register("age_months_part")}
                />
                {errors.age_months_part && (
                  <div className="text-rose-600 dark:text-rose-400 text-xs mt-1">
                    {t(String(errors.age_months_part.message), "Months must be between 0 and 11")}
                  </div>
                )}
              </div>
            </div>
            <div className="text-xs text-slate-400 dark:text-[#A1A1AA] mt-1">
              {t("cows.helper_age", "Approximate age is okay.")}
            </div>
          </div>
          <div>
            <label htmlFor="add-cow-weight" className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">
              {t("cows.field_weight", "Weight (kg)")}
            </label>
            <input
              id="add-cow-weight"
              data-testid="add-cow-weight"
              type="number"
              step="any"
              placeholder={t("cows.placeholder_weight", "e.g. 500")}
              className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              {...register("weight_kg")}
            />
            {errors.weight_kg && (
              <div className="text-rose-600 dark:text-rose-400 text-xs mt-1">
                {t(String(errors.weight_kg.message), "Weight must be greater than 0")}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="add-cow-breed" className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">
              {t("cows.field_breed", "Breed")}
            </label>
            <select
              id="add-cow-breed"
              data-testid="add-cow-breed"
              className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              {...register("breed")}
            >
              <option value="" className="dark:bg-[#1B1D20] dark:text-[#F4F4F5]">
                {t("cows.select_breed", "Select breed")}
              </option>
              {breeds.map((b) => (
                <option key={b.id} value={b.id} className="dark:bg-[#1B1D20] dark:text-[#F4F4F5]">
                  {getBreedLabel(b)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="add-cow-status" className="text-sm font-medium text-slate-700 dark:text-[#A1A1AA]">
              {t("cows.field_status", "Status")}
            </label>
            <select
              id="add-cow-status"
              data-testid="add-cow-status"
              className="w-full rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-3 py-2 text-sm text-slate-900 dark:text-[#F4F4F5] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              {...register("status")}
            >
              <option value="" className="dark:bg-[#1B1D20] dark:text-[#F4F4F5]">
                {t("cows.select_status", "Select status")}
              </option>
              <option value="active" className="dark:bg-[#1B1D20] dark:text-[#F4F4F5]">
                {t("cows.status_active", "Active")}
              </option>
              <option value="dry" className="dark:bg-[#1B1D20] dark:text-[#F4F4F5]">
                {t("cows.status_dry", "Dry")}
              </option>
              <option value="sick" className="dark:bg-[#1B1D20] dark:text-[#F4F4F5]">
                {t("cows.status_sick", "Sick")}
              </option>
              <option value="deceased" className="dark:bg-[#1B1D20] dark:text-[#F4F4F5]">
                {t("cows.status_deceased", "Deceased")}
              </option>
              <option value="sold" className="dark:bg-[#1B1D20] dark:text-[#F4F4F5]">
                {t("cows.status_sold", "Sold")}
              </option>
            </select>
            {errors.status && (
              <div className="text-rose-600 dark:text-rose-400 text-xs mt-1">
                {t(String(errors.status.message), "Status is required")}
              </div>
            )}
          </div>

          {submitError && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {t(submitError, submitError)}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              data-testid="add-cow-cancel"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-4 py-2 text-sm font-semibold text-slate-700 dark:text-[#F4F4F5] hover:bg-slate-50 dark:hover:bg-[#222428]"
              disabled={isSubmitting}
            >
              {t("action.cancel", "Cancel")}
            </button>
            <button
              type="submit"
              data-testid="add-cow-submit"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60 shadow-xs"
              disabled={isSubmitting}
            >
              {isSubmitting ? t("action.creating", "Creating…") : t("action.create", "Create")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
