"use client";

import { type CSSProperties } from "react";

/**
 * Ripple — a decorative background of concentric, gently pulsing rings.
 * Pure CSS (no deps). Tinted to the app's teal theme.
 */
export function Ripple({
  mainCircleSize = 220,
  mainCircleOpacity = 0.22,
  numCircles = 8,
  className = "",
}: {
  mainCircleSize?: number;
  mainCircleOpacity?: number;
  numCircles?: number;
  className?: string;
}) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden [mask-image:radial-gradient(closest-side,white,transparent)] ${className}`}
      aria-hidden
    >
      {Array.from({ length: numCircles }).map((_, i) => {
        const size = mainCircleSize + i * 90;
        const opacity = Math.max(mainCircleOpacity - i * 0.03, 0);
        return (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 rounded-full border border-white/40 bg-white/5"
            style={
              {
                width: size,
                height: size,
                "--ripple-o": opacity,
                animation: `hb-ripple ${2.8 + i * 0.25}s ease-in-out ${i * 0.12}s infinite`,
                transform: "translate(-50%, -50%) scale(1)",
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

export default Ripple;
