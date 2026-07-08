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

  it("patient permissions follow the S2-d matrix (admin has NONE)", () => {
    expect(
      decide({ principal: { roles: ["front_desk"] }, permission: "patient:create" }).allowed,
    ).toBe(true);
    expect(decide({ principal: { roles: ["doctor"] }, permission: "patient:update" }).allowed).toBe(
      true,
    );
    expect(decide({ principal: { roles: ["nurse"] }, permission: "patient:read" }).allowed).toBe(
      true,
    );
    expect(decide({ principal: { roles: ["nurse"] }, permission: "patient:update" }).allowed).toBe(
      false,
    );
    expect(decide({ principal: { roles: ["doctor"] }, permission: "patient:create" }).allowed).toBe(
      false,
    );
    for (const perm of ["patient:create", "patient:read", "patient:update"] as const) {
      expect(decide({ principal: { roles: ["admin"] }, permission: perm }).allowed).toBe(false);
      expect(decide({ principal: { roles: ["platform_admin"] }, permission: perm }).allowed).toBe(
        false,
      );
    }
  });

  it("practitioner directory: admin manages, all tenant roles read (decision e)", () => {
    expect(
      decide({ principal: { roles: ["admin"] }, permission: "practitioner:manage" }).allowed,
    ).toBe(true);
    for (const role of ["admin", "doctor", "nurse", "front_desk"]) {
      expect(
        decide({ principal: { roles: [role] }, permission: "practitioner:read" }).allowed,
      ).toBe(true);
    }
    for (const role of ["doctor", "nurse", "front_desk"]) {
      expect(
        decide({ principal: { roles: [role] }, permission: "practitioner:manage" }).allowed,
      ).toBe(false);
    }
    expect(
      decide({ principal: { roles: ["platform_admin"] }, permission: "practitioner:read" }).allowed,
    ).toBe(false);
  });

  it("scheduling: reception books/checks-in, admin configures, all clinical read (D-4.7)", () => {
    // Reception (front_desk) owns booking + check-in; admin does NOT book.
    for (const perm of ["appointment:manage", "appointment:checkin"] as const) {
      expect(decide({ principal: { roles: ["front_desk"] }, permission: perm }).allowed).toBe(true);
      expect(decide({ principal: { roles: ["admin"] }, permission: perm }).allowed).toBe(false);
      expect(decide({ principal: { roles: ["doctor"] }, permission: perm }).allowed).toBe(false);
    }
    // Availability templates are admin config; reception/clinicians cannot manage.
    expect(decide({ principal: { roles: ["admin"] }, permission: "schedule:manage" }).allowed).toBe(
      true,
    );
    expect(
      decide({ principal: { roles: ["front_desk"] }, permission: "schedule:manage" }).allowed,
    ).toBe(false);
    // Everyone in-tenant can read the schedule + queue + encounter.
    for (const role of ["admin", "doctor", "nurse", "front_desk"]) {
      expect(decide({ principal: { roles: [role] }, permission: "appointment:read" }).allowed).toBe(
        true,
      );
      expect(decide({ principal: { roles: [role] }, permission: "encounter:read" }).allowed).toBe(
        true,
      );
    }
    expect(
      decide({ principal: { roles: ["platform_admin"] }, permission: "appointment:read" }).allowed,
    ).toBe(false);
  });

  it("EMR: doctor documents/signs/orders; nurse documents only; sign is doctor-only (D-5.6 / Constitution)", () => {
    // Doctor: the full clinical heart.
    for (const perm of [
      "encounter:document",
      "encounter:sign",
      "order:place",
      "result:file",
    ] as const) {
      expect(decide({ principal: { roles: ["doctor"] }, permission: perm }).allowed).toBe(true);
    }
    // Nurse may document (vitals) but NEVER sign, order, or file results.
    expect(
      decide({ principal: { roles: ["nurse"] }, permission: "encounter:document" }).allowed,
    ).toBe(true);
    for (const perm of ["encounter:sign", "order:place", "result:file"] as const) {
      expect(decide({ principal: { roles: ["nurse"] }, permission: perm }).allowed).toBe(false);
      // Constitution: NOBODY but a doctor signs — not admin, not front_desk.
      expect(decide({ principal: { roles: ["admin"] }, permission: perm }).allowed).toBe(false);
      expect(decide({ principal: { roles: ["front_desk"] }, permission: perm }).allowed).toBe(
        false,
      );
    }
    // Results are readable across the clinical + reception roles.
    for (const role of ["admin", "doctor", "nurse", "front_desk"]) {
      expect(decide({ principal: { roles: [role] }, permission: "result:read" }).allowed).toBe(
        true,
      );
    }
  });

  it("billing: reception invoices + settles; all clinical read; share is doctor/reception (D-6.5)", () => {
    // Reception (front_desk) is the cashier.
    expect(
      decide({ principal: { roles: ["front_desk"] }, permission: "billing:manage" }).allowed,
    ).toBe(true);
    // Clinicians and admin do NOT take payment.
    for (const role of ["admin", "doctor", "nurse"]) {
      expect(decide({ principal: { roles: [role] }, permission: "billing:manage" }).allowed).toBe(
        false,
      );
    }
    // Everyone in-tenant can read a bill.
    for (const role of ["admin", "doctor", "nurse", "front_desk"]) {
      expect(decide({ principal: { roles: [role] }, permission: "billing:read" }).allowed).toBe(
        true,
      );
    }
    // Consent-share (mock ABDM): doctor + reception; nurse/admin cannot.
    expect(
      decide({ principal: { roles: ["doctor"] }, permission: "encounter:share" }).allowed,
    ).toBe(true);
    expect(
      decide({ principal: { roles: ["front_desk"] }, permission: "encounter:share" }).allowed,
    ).toBe(true);
    expect(decide({ principal: { roles: ["nurse"] }, permission: "encounter:share" }).allowed).toBe(
      false,
    );
    expect(decide({ principal: { roles: ["admin"] }, permission: "encounter:share" }).allowed).toBe(
      false,
    );
  });

  it("AI is operational-only for clinicians: doctor uses; others cannot (Stage 7)", () => {
    expect(decide({ principal: { roles: ["doctor"] }, permission: "ai:use" }).allowed).toBe(true);
    for (const role of ["admin", "nurse", "front_desk", "platform_admin"]) {
      expect(decide({ principal: { roles: [role] }, permission: "ai:use" }).allowed).toBe(false);
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
