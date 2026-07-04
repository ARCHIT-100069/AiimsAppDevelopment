import { describe, expect, it } from "vitest";
import { ConfigValidationError, loadConfig } from "./index";

const validEnv = {
  DATABASE_URL_APP: "postgres://aiims_app:pw@localhost:5432/aiims",
  OIDC_ISSUER_URL: "http://localhost:8080/realms/aiims",
};

describe("loadConfig (BDR-0011 fail-fast)", () => {
  it("parses a minimal valid environment with safe defaults", () => {
    const cfg = loadConfig(validEnv as NodeJS.ProcessEnv);
    expect(cfg.PORT).toBe(3000);
    expect(cfg.ADAPTER_ABDM).toBe("mock");
    expect(cfg.OUTBOX_POLL_INTERVAL_MS).toBe(500);
  });

  it("fails fast when the database URL is missing", () => {
    expect(() =>
      loadConfig({ OIDC_ISSUER_URL: validEnv.OIDC_ISSUER_URL } as NodeJS.ProcessEnv),
    ).toThrow(ConfigValidationError);
  });

  it("rejects an invalid adapter mode instead of guessing", () => {
    expect(() => loadConfig({ ...validEnv, ADAPTER_ABDM: "sandbox" } as NodeJS.ProcessEnv)).toThrow(
      ConfigValidationError,
    );
  });
});
