import { useState, useEffect, useRef } from "react";

const SINGLE_VIDEO_SRC = "/videos/dairy-farm-02.mp4";
const FALLBACK_POSTER = "/assets/dairy-farm-bg.jpg";

export function DairyVideoBackground() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Guarantee muted autoplay on mount
  useEffect(() => {
    if (prefersReducedMotion || !videoRef.current) return;
    videoRef.current.muted = true;
    videoRef.current.play().catch((err) => {
      console.warn("[Video DBG] Autoplay notice:", err);
    });
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) {
    return (
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${FALLBACK_POSTER}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/15 to-black/25 pointer-events-none" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-slate-950 select-none">
      {/* Global Keyframe for Ultra-Subtle Single-Video Camera Motion (1.00 -> 1.03) */}
      <style>{`
        @keyframes ultraSubtleVideoZoom {
          0% { transform: scale(1.00) translateY(0%); }
          100% { transform: scale(1.03) translateY(-0.3%); }
        }
      `}</style>

      {/* Fallback Static Poster Layer */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-40 transition-opacity duration-1000"
        style={{ backgroundImage: `url('${FALLBACK_POSTER}')` }}
      />

      {/* Full HD High-Quality Single Dairy Cattle Video Background */}
      <video
        ref={videoRef}
        src={SINGLE_VIDEO_SRC}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster={FALLBACK_POSTER}
        style={{
          animation: prefersReducedMotion ? "none" : "ultraSubtleVideoZoom 16s ease-in-out infinite alternate",
          willChange: "transform",
          filter: "brightness(0.96) contrast(1.08) saturate(1.04)",
        }}
        className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000"
      />

      {/* Single Subtle Natural Dark Cinematic Overlay (Left: 45% dark for text, Center: 15% clear, Right: 25% dark) */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/15 to-black/25 pointer-events-none" />
    </div>
  );
}
