"use client";

import { useEffect, useState } from "react";

/**
 * Text3DFlip — cycles through words with a 3D flip-in. Pure CSS/JS (no deps).
 * Pass `words` to cycle, or a single `children` to flip once.
 */
export default function Text3DFlip({
  words,
  interval = 2200,
  className = "",
  children,
}: {
  words?: string[];
  interval?: number;
  className?: string;
  children?: string;
}) {
  const list = words && words.length > 0 ? words : children ? [children] : [""];
  const [i, setI] = useState(0);

  useEffect(() => {
    if (list.length < 2) return;
    const id = setInterval(() => setI((p) => (p + 1) % list.length), interval);
    return () => clearInterval(id);
  }, [list.length, interval]);

  return (
    <span className={`inline-block [perspective:700px] ${className}`}>
      <span key={i} className="hb-flip">
        {list[i]}
      </span>
    </span>
  );
}

export { Text3DFlip };
