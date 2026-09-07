import React, { useState, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  X,
} from "lucide-react";
import {
  BulkObservationItem,
  BulkObservationResponse,
  uploadBulkObservations,
} from "@/services/observation";
import { useLanguage } from "@/context/LanguageContext";
import { getConditionLabel } from "@/lib/i18n-helpers";

type ParsedRow = {
  rowNumber: number;
  raw: Record<string, string>;
  item?: BulkObservationItem;
  clientError?: string;
};

const VALID_HEALTH_CONDITIONS = new Set([
  "normal",
  "fever",
  "mastitis",
  "lameness",
  "respiratory",
  "digestive",
  "other",
]);

export default function BulkUploadModal({
  open,
  farmId,
  cows,
  onClose,
  onSuccess,
}: {
  open: boolean;
  farmId: string;
  cows: Array<{ id: string; tag_id?: string; name?: string }>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState<boolean>(false);
  const [result, setResult] = useState<BulkObservationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const validCowTags = new Set(
    cows.map((c) => (c.tag_id || "").trim().toLowerCase()).filter(Boolean)
  );

  const handleDownloadTemplate = () => {
    const csvContent =
      "tag_id,observation_date,milk_produced_liters,feed_quantity_kg,body_condition_score,body_temperature_c,health_condition,notes\n" +
      "TAG-101,2026-08-31,22.5,24.0,3.5,38.6,normal,TEMPLATE EXAMPLE - Morning milking optimal\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "dairyvision_observations_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSVText = (text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setError("CSV file is empty.");
      setParsedRows([]);
      return;
    }

    const headers = lines[0]
      .split(",")
      .map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ""));

    if (!headers.includes("tag_id")) {
      setError("Missing required column: 'tag_id' header is required.");
      setParsedRows([]);
      return;
    }

    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const values = line.split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
      const raw: Record<string, string> = {};
      headers.forEach((h, idx) => {
        raw[h] = values[idx] !== undefined ? values[idx] : "";
      });

      const tag_id = raw["tag_id"] || "";
      const obs_date = raw["observation_date"] || undefined;
      const milkStr = raw["milk_produced_liters"];
      const feedStr = raw["feed_quantity_kg"];
      const bcsStr = raw["body_condition_score"];
      const tempStr = raw["body_temperature_c"];
      const health = (raw["health_condition"] || "normal").toLowerCase();
      const notes = raw["notes"] || undefined;

      let clientError: string | undefined = undefined;

      if (!tag_id) {
        clientError = "Missing tag_id";
      } else if (validCowTags.size > 0 && !validCowTags.has(tag_id.toLowerCase())) {
        clientError = `Tag '${tag_id}' not found in farm`;
      } else if (milkStr !== undefined && milkStr !== "" && (isNaN(Number(milkStr)) || Number(milkStr) < 0)) {
        clientError = "Milk produced must be a non-negative number";
      } else if (feedStr !== undefined && feedStr !== "" && (isNaN(Number(feedStr)) || Number(feedStr) < 0)) {
        clientError = "Feed quantity must be a non-negative number";
      } else if (bcsStr !== undefined && bcsStr !== "" && (isNaN(Number(bcsStr)) || Number(bcsStr) < 1.0 || Number(bcsStr) > 5.0)) {
        clientError = "Body condition score must be between 1.0 and 5.0";
      } else if (tempStr !== undefined && tempStr !== "" && (isNaN(Number(tempStr)) || Number(tempStr) <= 0)) {
        clientError = "Body temperature must be positive";
      } else if (health && !VALID_HEALTH_CONDITIONS.has(health)) {
        clientError = `Invalid health condition '${health}'`;
      }

      const item: BulkObservationItem = {
        tag_id,
        observation_date: obs_date || undefined,
        milk_produced_liters: milkStr !== undefined && milkStr !== "" ? Number(milkStr) : undefined,
        feed_quantity_kg: feedStr !== undefined && feedStr !== "" ? Number(feedStr) : undefined,
        body_condition_score: bcsStr !== undefined && bcsStr !== "" ? Number(bcsStr) : undefined,
        body_temperature_c: tempStr !== undefined && tempStr !== "" ? Number(tempStr) : undefined,
        health_condition: health || "normal",
        notes: notes || undefined,
      };

      rows.push({
        rowNumber: i + 1,
        raw,
        item,
        clientError,
      });
    }

    setError(null);
    setParsedRows(rows);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setResult(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      parseCSVText(text);
    };
    reader.readAsText(selected);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;

    setFile(dropped);
    setResult(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      parseCSVText(text);
    };
    reader.readAsText(dropped);
  };

  const handleImport = async () => {
    const validItems = parsedRows.filter((r) => !r.clientError && r.item).map((r) => r.item!);
    if (validItems.length === 0) {
      setError("No valid rows to import.");
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const res = await uploadBulkObservations(farmId, validItems);
      setResult(res);
      if (res.imported_count > 0) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Bulk import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validRowsCount = parsedRows.filter((r) => !r.clientError).length;
  const invalidRowsCount = parsedRows.filter((r) => !!r.clientError).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 animate-in fade-in">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#151719] border border-slate-200 dark:border-[#27272A] p-6 shadow-xl space-y-6 text-slate-900 dark:text-[#F4F4F5]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272A] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-[#F4F4F5]">{t("obs.bulk_import", "Bulk Import CSV")}</h3>
              <p className="text-xs text-slate-500 dark:text-[#A1A1AA]">{t("obs.bulk_instructions", "Upload CSV file to log daily metrics for multiple cows at once.")}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 dark:text-[#A1A1AA] hover:bg-slate-100 dark:hover:bg-[#222428] hover:text-slate-700 dark:hover:text-[#F4F4F5]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Global Error Notice */}
        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-3.5 text-xs font-semibold text-rose-800 dark:text-rose-300">
            <XCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* State 1: Final Import Result Summary */}
        {result ? (
          <div className="space-y-5">
            <div
              className={`rounded-2xl border p-5 space-y-2 ${
                result.imported_count > 0 ? "border-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/20" : "border-rose-200 bg-rose-50/70 dark:bg-rose-950/20"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {result.imported_count > 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                )}
                <span>
                  {t("common.success", "Import Completed")}: {result.imported_count} imported, {result.failed_count} failed
                  {result.duplicate_count > 0 ? ` (${result.duplicate_count} duplicates skipped)` : ""}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-[#A1A1AA]">
                Processed {result.total_rows} total rows. Successfully logged observations have been added to the farm database.
              </p>
            </div>

            {/* Error Table if any failures */}
            {result.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900 dark:text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  Import Exception Log ({result.errors.length} rows failed)
                </h4>
                <div className="max-h-56 overflow-y-auto rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-[#151719]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-rose-50 dark:bg-rose-950/40 border-b border-rose-100 dark:border-rose-900/40 text-rose-900 dark:text-rose-300 font-bold">
                      <tr>
                        <th className="p-2.5">CSV Row</th>
                        <th className="p-2.5">Tag ID</th>
                        <th className="p-2.5">Failure Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100 dark:divide-rose-900/40">
                      {result.errors.map((err, idx) => (
                        <tr key={idx} className="hover:bg-rose-50/50 dark:hover:bg-rose-950/20">
                          <td className="p-2.5 font-bold text-slate-700 dark:text-[#F4F4F5]">Row #{err.row}</td>
                          <td className="p-2.5 font-semibold text-slate-900 dark:text-[#F4F4F5]">{err.tag_id || "N/A"}</td>
                          <td className="p-2.5 text-rose-700 dark:text-rose-400 font-medium">{err.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={handleReset}
                className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-[#F4F4F5] hover:bg-slate-50 dark:hover:bg-[#222428]"
              >
                {t("common.reset", "Upload Another File")}
              </button>
              <button
                onClick={onClose}
                className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
              >
                {t("common.close", "Done")}
              </button>
            </div>
          </div>
        ) : (
          /* State 2: Upload & Preview State */
          <div className="space-y-6">
            {/* File Drag Drop & Template Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl bg-slate-50 dark:bg-[#1B1D20] border border-slate-200 dark:border-[#27272A] p-4">
              <div className="text-xs text-slate-600 dark:text-[#A1A1AA]">
                <span className="font-bold text-slate-800 dark:text-[#F4F4F5]">Supported Headers: </span>
                <code className="text-[11px] bg-slate-200/80 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-800 dark:text-slate-200">
                  tag_id, observation_date, milk_produced_liters, feed_quantity_kg, body_condition_score, body_temperature_c, health_condition, notes
                </code>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 shrink-0 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50 dark:bg-sky-950/40 px-3 py-1.5 text-xs font-bold text-sky-800 dark:text-sky-300 hover:bg-sky-100 transition"
              >
                <Download className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                {t("common.export_csv", "Download Template CSV")}
              </button>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-sky-200 dark:border-sky-800/40 bg-sky-50/40 dark:bg-[#1B1D20] p-8 text-center cursor-pointer transition hover:border-sky-400 hover:bg-sky-50"
            >
              <Upload className="h-8 w-8 text-sky-600 dark:text-sky-400 mb-2" />
              <p className="text-sm font-bold text-slate-800 dark:text-[#F4F4F5]">
                {file ? file.name : "Click or Drag & Drop CSV file here"}
              </p>
              <p className="text-xs text-slate-500 dark:text-[#A1A1AA] mt-1">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : "Select a valid .csv file with herd records"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Parse Preview Grid */}
            {parsedRows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className="text-slate-800 dark:text-[#F4F4F5]">Preview Parsed Rows ({parsedRows.length} total):</span>
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 text-emerald-800 dark:text-emerald-300 font-extrabold">
                      {validRowsCount} Valid
                    </span>
                    {invalidRowsCount > 0 && (
                      <span className="rounded-full bg-rose-100 dark:bg-rose-950/40 px-2 py-0.5 text-rose-800 dark:text-rose-300 font-extrabold">
                        {invalidRowsCount} Invalid
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleReset}
                    className="text-xs text-slate-500 dark:text-[#A1A1AA] hover:text-slate-800 dark:hover:text-[#F4F4F5] font-semibold"
                  >
                    {t("common.clear_filter", "Clear File")}
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#151719]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-[#1B1D20] border-b border-slate-200 dark:border-[#27272A] text-slate-600 dark:text-[#A1A1AA] font-bold">
                      <tr>
                        <th className="p-2.5">Row</th>
                        <th className="p-2.5">{t("cows.tag_id", "Tag ID")}</th>
                        <th className="p-2.5">{t("common.date", "Date")}</th>
                        <th className="p-2.5">{t("obs.milk_yield_l", "Milk (L)")}</th>
                        <th className="p-2.5">{t("obs.feed_kg", "Feed (kg)")}</th>
                        <th className="p-2.5">{t("obs.health_condition", "Health")}</th>
                        <th className="p-2.5">{t("common.status", "Status")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#27272A]">
                      {parsedRows.map((row) => (
                        <tr
                          key={row.rowNumber}
                          className={row.clientError ? "bg-rose-50/60 dark:bg-rose-950/20" : "hover:bg-slate-50 dark:hover:bg-[#222428]"}
                        >
                          <td className="p-2.5 font-bold text-slate-500 dark:text-[#A1A1AA]">#{row.rowNumber}</td>
                          <td className="p-2.5 font-bold text-slate-900 dark:text-[#F4F4F5]">{row.item?.tag_id || row.raw["tag_id"]}</td>
                          <td className="p-2.5 text-slate-600 dark:text-[#A1A1AA]">{row.item?.observation_date || "Today"}</td>
                          <td className="p-2.5 text-slate-700 dark:text-[#F4F4F5] font-medium">
                            {row.item?.milk_produced_liters != null ? `${row.item.milk_produced_liters} L` : "-"}
                          </td>
                          <td className="p-2.5 text-slate-700 dark:text-[#F4F4F5] font-medium">
                            {row.item?.feed_quantity_kg != null ? `${row.item.feed_quantity_kg} kg` : "-"}
                          </td>
                          <td className="p-2.5 text-slate-700 dark:text-[#F4F4F5] capitalize">
                            {getConditionLabel(row.item?.health_condition, t)}
                          </td>
                          <td className="p-2.5">
                            {row.clientError ? (
                              <span className="flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-400">
                                <XCircle className="h-3.5 w-3.5" />
                                {row.clientError}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {t("common.success", "Valid")}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-[#27272A] pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={importing}
                className="rounded-2xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#1B1D20] px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-[#F4F4F5] hover:bg-slate-50 dark:hover:bg-[#222428]"
              >
                {t("common.cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || validRowsCount === 0}
                className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {importing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    {t("common.loading", "Importing Records…")}
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4" />
                    {t("obs.bulk_import", "Import")} {validRowsCount} {t("nav.daily_observations", "Observations")}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
