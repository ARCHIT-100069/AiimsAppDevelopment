import type { Config } from "tailwindcss";

/** Content includes ui-web so shared component classes are not purged. */
export default {
  content: ["./app/**/*.{ts,tsx}", "../../packages/ui-web/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // The editorial serif for display moments only (see layout.tsx) —
        // everything else stays on the plain system sans stack.
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
