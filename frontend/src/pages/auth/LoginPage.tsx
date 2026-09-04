import { DairyVideoBackground } from "@/components/auth/DairyVideoBackground";
import { LoginForm } from "@/components/login-form";
import { Activity, BarChart3, Calendar } from "lucide-react";

export function LoginPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 font-sans text-slate-100 flex items-center justify-center">
      {/* 1. CINEMATIC FULL-VIEWPORT BACKGROUND VIDEO */}
      <DairyVideoBackground />

      {/* 2. MAIN TWO-COLUMN CONTAINER (MAX-WIDTH 1440PX) */}
      <div className="relative z-10 w-full max-w-[1440px] mx-auto px-8 sm:px-12 lg:px-16 min-h-screen py-8 lg:py-12 flex flex-col justify-between">
        
        {/* TOP BRAND HEADER */}
        <div className="w-full flex items-center justify-between pt-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                <svg
                  className="h-5 w-5 text-emerald-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 6c0 0 2-2 5-2s5 2 5 2" />
                  <path d="M20 6c0 0-2-2-5-2s-5 2-5 2" />
                  <path d="M7 10h10" />
                  <path d="M6 8c0 4.5 2 11 6 11s6-6.5 6-11" />
                  <circle cx="9" cy="14" r="1" fill="currentColor" />
                  <circle cx="15" cy="14" r="1" fill="currentColor" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                DairyVision <span className="text-emerald-400">AI</span>
              </span>
            </div>
            <p className="text-xs text-slate-300/80 pl-10 font-normal">
              Smarter decisions. Healthier herds. Better farms.
            </p>
          </div>
        </div>

        {/* MIDDLE TWO-COLUMN CONTENT */}
        <div className="w-full my-auto py-8 grid lg:grid-cols-[1fr_420px] items-center justify-between gap-16 lg:gap-24">
          
          {/* LEFT LARGE HERO PANEL (MAX-WIDTH 660PX) */}
          <div className="w-full max-w-[660px] flex flex-col items-start text-left">
            {/* Main Headline */}
            <h1 className="text-4xl sm:text-[54px] lg:text-[60px] xl:text-[64px] font-bold tracking-tight text-white leading-[1.08] mb-5">
              Turn your farm data<br />
              into <span className="text-emerald-400">smarter decisions.</span>
            </h1>
            
            {/* Larger Supporting Description */}
            <p className="text-lg lg:text-[21px] font-normal text-slate-100/95 leading-relaxed max-w-[560px] mb-10">
              Monitor herd health, predict milk production, and make data-driven decisions with confidence.
            </p>

            {/* 3 Larger Feature Rows with High-Impact Typography & Contrast */}
            <div className="space-y-6 w-full">
              {/* Row 1 */}
              <div className="flex items-center gap-4.5">
                <div className="flex h-11 w-11 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-950/75 border border-emerald-500/40 text-emerald-400 backdrop-blur-md">
                  <Activity className="h-5.5 w-5.5 lg:h-6 lg:w-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-[17px] lg:text-[19px] font-bold text-white leading-snug">Herd Health Monitoring</h3>
                  <p className="text-sm lg:text-[15px] font-medium text-slate-200/95 mt-1">Real-time health tracking and alerts</p>
                </div>
              </div>

              {/* Row 2 */}
              <div className="flex items-center gap-4.5">
                <div className="flex h-11 w-11 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-950/75 border border-emerald-500/40 text-emerald-400 backdrop-blur-md">
                  <BarChart3 className="h-5.5 w-5.5 lg:h-6 lg:w-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-[17px] lg:text-[19px] font-bold text-white leading-snug">AI Milk Yield Predictions</h3>
                  <p className="text-sm lg:text-[15px] font-medium text-slate-200/95 mt-1">Predict milk yield and identify production risks</p>
                </div>
              </div>

              {/* Row 3 */}
              <div className="flex items-center gap-4.5">
                <div className="flex h-11 w-11 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-950/75 border border-emerald-500/40 text-emerald-400 backdrop-blur-md">
                  <Calendar className="h-5.5 w-5.5 lg:h-6 lg:w-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-[17px] lg:text-[19px] font-bold text-white leading-snug">Smart Farm Management</h3>
                  <p className="text-sm lg:text-[15px] font-medium text-slate-200/95 mt-1">Data-driven insights for better daily decisions</p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — LARGE CLEAN WHITE CARD */}
          <div className="w-full max-w-[420px] flex flex-col items-center justify-center mx-auto">
            <div className="w-full rounded-[20px] bg-white p-8 sm:p-9 shadow-2xl ring-1 ring-slate-900/5">
              <LoginForm />
            </div>
          </div>

        </div>

        {/* BOTTOM FOOTER / STATUS BAR */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 pb-2 text-xs font-normal text-slate-300/80">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live farm intelligence</span>
          </div>

          <p className="text-slate-300/70 font-normal">
            &copy; {new Date().getFullYear()} DairyVision AI. All rights reserved.
          </p>
        </div>

      </div>
    </div>
  );
}
