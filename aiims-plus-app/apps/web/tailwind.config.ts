import type { Config } from "tailwindcss";

/** Content includes ui-web so shared component classes are not purged. */
export default {
  content: ["./app/**/*.{ts,tsx}", "../../packages/ui-web/src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
