"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Wrapper that clips the marquee and fades its edges. */
export function ScrollVelocityContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`hb-marquee-mask relative w-full overflow-hidden ${className}`}>{children}</div>
  );
}

/**
 * A row that scrolls its children horizontally forever. Base speed is constant,
 * but the page's scroll velocity is folded in — scroll faster and the row races,
 * then it eases back. Pure rAF, no deps.
 */
export function ScrollVelocityRow({
  children,
  baseVelocity = 40,
  direction = 1,
  className = "",
}: {
  children: ReactNode;
  /** px per second at rest */
  baseVelocity?: number;
  /** 1 → left, -1 → right */
  direction?: 1 | -1;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const scrollBoost = useRef(0);
  const lastScrollY = useRef(0);
  const raf = useRef(0);
  const lastT = useRef(0);

  useEffect(() => {
    lastScrollY.current = window.scrollY;
    const onScroll = () => {
      const dy = window.scrollY - lastScrollY.current;
      lastScrollY.current = window.scrollY;
      // add scroll delta into a decaying boost
      scrollBoost.current += dy;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const step = (t: number) => {
      if (!lastT.current) lastT.current = t;
      const dt = Math.min((t - lastT.current) / 1000, 0.05);
      lastT.current = t;

      const w = copyRef.current?.offsetWidth ?? 1;
      const boost = scrollBoost.current * 6; // amplify scroll into velocity
      const v = direction * (baseVelocity + Math.abs(boost)) * (boost >= 0 ? 1 : 1);
      offset.current -= v * dt;
      // wrap within one copy width for a seamless loop
      if (offset.current <= -w) offset.current += w;
      if (offset.current > 0) offset.current -= w;
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${offset.current}px,0,0)`;
      }
      scrollBoost.current *= 0.9; // decay
      if (Math.abs(scrollBoost.current) < 0.01) scrollBoost.current = 0;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("scroll", onScroll);
    };
  }, [baseVelocity, direction]);

  return (
    <div className={`flex w-max flex-nowrap ${className}`} ref={trackRef}>
      <div className="flex shrink-0 flex-nowrap" ref={copyRef}>
        {children}
      </div>
      <div className="flex shrink-0 flex-nowrap" aria-hidden>
        {children}
      </div>
    </div>
  );
}

export default ScrollVelocityContainer;
