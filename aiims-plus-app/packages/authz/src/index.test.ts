import { describe, expect, it } from "vitest";
import { decide } from "./index";

describe("RBAC PDP (SDR-0002)", () => {
  it("denies by default for unknown roles (fail-closed)", () => {
    expect(decide({ principal: { roles: ["superuser"] }, permission: "org:read" }).allowed).toBe(
      false,
    );
  });

  it("denies with no roles at all", () => {
    expect(decide({ principal: { roles: [] }, permission: "org:read" }).allowed).toBe(false);
  });

  it("carries a safe, explanatory reason on denial", () => {
    const d = decide({ principal: { roles: ["front_desk"] }, permission: "org:manage" });
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("front_desk");
  });
});

describe("Stage 1 permission matrix (separation of duties, SDR-0002)", () => {
  it("admin manages the directory and users", () => {
    for (const p of ["org:manage", "user:manage", "org:read", "user:read"] as const) {
      expect(decide({ principal: { roles: ["admin"] }, permission: p }).allowed).toBe(true);
    }
  });

  it("clinical roles read the directory but never manage it", () => {
    for (const role of ["doctor", "nurse", "front_desk"]) {
      expect(decide({ principal: { roles: [role] }, permission: "org:read" }).allowed).toBe(true);
      expect(decide({ principal: { roles: [role] }, permission: "org:manage" }).allowed).toBe(
        false,
      );
      expect(decide({ principal: { roles: [role] }, permission: "user:manage" }).allowed).toBe(
        false,
      );
    }
  });

  it("every tenant role can read reference codes", () => {
    for (const role of ["admin", "doctor", "nurse", "front_desk"]) {
      expect(decide({ principal: { roles: [role] }, permission: "reference:read" }).allowed).toBe(
        true,
      );
    }
  });

  it("platform_admin manages ONLY the tenant registry — no tenant data access", () => {
    const platform = { roles: ["platform_admin"] };
    expect(decide({ principal: platform, permission: "platform:tenant:manage" }).allowed).toBe(
      true,
    );
    for (const p of ["org:manage", "org:read", "user:manage", "user:read"] as const) {
      expect(decide({ principal: platform, permission: p }).allowed).toBe(false);
    }
  });

  it("no tenant role can manage the tenant registry", () => {
    for (const role of ["admin", "doctor", "nurse", "front_desk"]) {
      expect(
        decide({ principal: { roles: [role] }, permission: "platform:tenant:manage" }).allowed,
      ).toBe(false);
    }
  });
});
