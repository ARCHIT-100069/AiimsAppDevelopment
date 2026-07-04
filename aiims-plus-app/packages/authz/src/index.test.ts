import { describe, expect, it } from "vitest";
import { decide } from "./index";

describe("RBAC PDP (SDR-0002)", () => {
  it("permits a doctor to create a note", () => {
    expect(decide({ principal: { roles: ["doctor"] }, permission: "note:create" }).allowed).toBe(
      true,
    );
  });

  it("denies a front-desk user note creation (least privilege)", () => {
    const d = decide({ principal: { roles: ["front_desk"] }, permission: "note:create" });
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("front_desk");
  });

  it("denies by default for unknown roles (fail-closed)", () => {
    expect(decide({ principal: { roles: ["superuser"] }, permission: "note:read" }).allowed).toBe(
      false,
    );
  });

  it("denies with no roles at all", () => {
    expect(decide({ principal: { roles: [] }, permission: "note:read" }).allowed).toBe(false);
  });
});
