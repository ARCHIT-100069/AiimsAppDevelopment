import { describe, expect, it } from "vitest";
import { loadRetentionPolicy, retentionUntilFor, type RetentionPolicy } from "./retention";

const POLICY: RetentionPolicy = {
  rules: [
    { retentionClass: "opd-note", durationDays: 3, legalBasis: "clinical-establishment-rules" },
    { retentionClass: "lab", durationDays: 10, legalBasis: "clinical-establishment-rules" },
  ],
};

describe("retention policy loader (ADR-0009 — durations never hard-coded)", () => {
  it("is INERT (null) when no policy is configured — nothing may be shredded", () => {
    expect(loadRetentionPolicy({})).toBeNull();
    expect(loadRetentionPolicy({ RETENTION_POLICY_JSON: "" })).toBeNull();
    expect(loadRetentionPolicy({ RETENTION_POLICY_JSON: "   " })).toBeNull();
  });

  it("parses a valid policy from RETENTION_POLICY_JSON", () => {
    const p = loadRetentionPolicy({ RETENTION_POLICY_JSON: JSON.stringify(POLICY) });
    expect(p?.rules).toHaveLength(2);
    expect(p?.rules[0]?.retentionClass).toBe("opd-note");
  });

  it("rejects a policy missing a legalBasis (provenance is mandatory for DPIA)", () => {
    const bad = { rules: [{ retentionClass: "x", durationDays: 5 }] };
    expect(() => loadRetentionPolicy({ RETENTION_POLICY_JSON: JSON.stringify(bad) })).toThrow(
      /legalBasis/,
    );
  });

  it("rejects a negative or non-numeric duration", () => {
    const bad = { rules: [{ retentionClass: "x", durationDays: -1, legalBasis: "y" }] };
    expect(() => loadRetentionPolicy({ RETENTION_POLICY_JSON: JSON.stringify(bad) })).toThrow(
      /Invalid retention rule/,
    );
  });

  it("rejects a payload without a rules array", () => {
    expect(() => loadRetentionPolicy({ RETENTION_POLICY_JSON: "{}" })).toThrow(/rules/);
  });
});

describe("retentionUntilFor (schedule math)", () => {
  it("adds the class duration to createdAt", () => {
    const created = new Date("2026-01-01T00:00:00.000Z");
    expect(retentionUntilFor(POLICY, "opd-note", created)?.toISOString()).toBe(
      "2026-01-04T00:00:00.000Z",
    );
    expect(retentionUntilFor(POLICY, "lab", created)?.toISOString()).toBe(
      "2026-01-11T00:00:00.000Z",
    );
  });

  it("returns null for an unknown or absent class (never guesses a duration)", () => {
    const created = new Date("2026-01-01T00:00:00.000Z");
    expect(retentionUntilFor(POLICY, "unknown", created)).toBeNull();
    expect(retentionUntilFor(POLICY, null, created)).toBeNull();
  });
});
