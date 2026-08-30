import { useEffect, useRef } from "react";
import type { ExplainabilityFeature } from "@/services/explainability";

// This component loads Plotly from CDN at runtime and renders a horizontal bar chart.
export default function FeatureImportanceChart({
  features,
}: {
  features: ExplainabilityFeature[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadAndPlot() {
      if (!containerRef.current) return;

      // ensure Plotly is available on window, otherwise load from CDN
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const Plotly = (window as any).Plotly ?? null;
      if (!Plotly) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdn.plot.ly/plotly-2.29.1.min.js";
          s.async = true;
          s.onload = () => resolve(null);
          s.onerror = () => reject(new Error("Failed to load Plotly"));
          document.head.appendChild(s);
        });
      }

      // @ts-ignore
      const P = (window as any).Plotly;
      if (!mounted || !P) return;

      // sort features by shap_value descending for visualization
      const sorted = [...features].sort(
        (a, b) => Math.abs(b.shap_value ?? 0) - Math.abs(a.shap_value ?? 0),
      );
      const names = sorted.map((f) => f.display_name || f.feature);
      const values = sorted.map((f) => f.shap_value ?? 0);
      const colors = values.map((v) => (v >= 0 ? "#0ea5e9" : "#fb7185"));


      const data = [
        {
          type: "bar",
          x: values,
          y: names,
          orientation: "h",
          marker: { color: colors },
        },
      ];

      const layout = {
        margin: { l: 200, r: 30, t: 20, b: 30 },
        yaxis: { automargin: true },
        xaxis: { title: "SHAP value" },
        height: Math.max(300, names.length * 30),
      } as any;

      P.newPlot(containerRef.current, data, layout, { responsive: true });
    }

    loadAndPlot().catch(() => {
      // Plotly failed to load. The chart will remain hidden in production.
    });

    return () => {
      mounted = false;
    };
  }, [features]);

  if (!features || features.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-slate-600">
        No feature importance data.
      </div>
    );
  }

  return <div ref={containerRef} className="rounded-2xl border bg-white p-2" />;
}
