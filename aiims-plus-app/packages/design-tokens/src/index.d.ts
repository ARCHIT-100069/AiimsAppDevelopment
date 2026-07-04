/**
 * @aiims/design-tokens — the single token source driving ui-web and ui-native
 * (FEDR-0004). Stage 0 scaffold: structure only; the real token set is
 * authored in the frontend build-out. Semantic status colors are always
 * paired with text/icon in components — color is never the sole signal.
 */
export declare const tokens: {
  readonly color: {
    readonly primary: "#0f6cbd";
    readonly surface: "#ffffff";
    readonly textPrimary: "#1a1a1a";
    readonly statusCritical: "#b3261e";
    readonly statusWarning: "#8a6d00";
    readonly statusOk: "#1e7d32";
  };
  readonly spacing: {
    readonly xs: 4;
    readonly sm: 8;
    readonly md: 16;
    readonly lg: 24;
    readonly xl: 40;
  };
  readonly radius: {
    readonly sm: 4;
    readonly md: 8;
    readonly lg: 16;
  };
  readonly fontSize: {
    readonly body: 14;
    readonly label: 12;
    readonly heading: 20;
  };
};
export type Tokens = typeof tokens;
//# sourceMappingURL=index.d.ts.map
