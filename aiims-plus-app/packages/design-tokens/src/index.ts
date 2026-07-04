/**
 * @aiims/design-tokens — the single token source driving ui-web and ui-native
 * (FEDR-0004). Stage 0 scaffold: structure only; the real token set is
 * authored in the frontend build-out. Semantic status colors are always
 * paired with text/icon in components — color is never the sole signal.
 */
export const tokens = {
  color: {
    // Placeholder palette — replaced by the design-system work (FEDR-0004).
    primary: "#0f6cbd",
    surface: "#ffffff",
    textPrimary: "#1a1a1a",
    statusCritical: "#b3261e",
    statusWarning: "#8a6d00",
    statusOk: "#1e7d32",
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 },
  radius: { sm: 4, md: 8, lg: 16 },
  fontSize: { body: 14, label: 12, heading: 20 },
} as const;

export type Tokens = typeof tokens;
