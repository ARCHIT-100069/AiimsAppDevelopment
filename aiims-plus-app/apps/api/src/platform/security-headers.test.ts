import { describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import { securityHeadersMiddleware } from "./security-headers";

function run(): { headers: Record<string, string>; removed: string[]; nexted: boolean } {
  const headers: Record<string, string> = {};
  const removed: string[] = [];
  let nexted = false;
  const res = {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    removeHeader: (k: string) => {
      removed.push(k);
    },
  } as unknown as Response;
  securityHeadersMiddleware({} as Request, res, () => {
    nexted = true;
  });
  return { headers, removed, nexted };
}

describe("securityHeadersMiddleware (Stage 9 hardening)", () => {
  it("calls next()", () => {
    expect(run().nexted).toBe(true);
  });

  it("strips X-Powered-By", () => {
    expect(run().removed).toContain("X-Powered-By");
  });

  it("sets HSTS for a year including subdomains", () => {
    expect(run().headers["Strict-Transport-Security"]).toBe(
      "max-age=31536000; includeSubDomains; preload",
    );
  });

  it("locks down framing, sniffing and referrer", () => {
    const h = run().headers;
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("no-referrer");
  });

  it("uses a deny-all CSP with no frame-ancestors for the JSON API", () => {
    const csp = run().headers["Content-Security-Policy"];
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("forbids caching so PHI is never stored by intermediaries", () => {
    expect(run().headers["Cache-Control"]).toBe("no-store");
  });

  it("disables privileged browser features via Permissions-Policy", () => {
    expect(run().headers["Permissions-Policy"]).toContain("camera=()");
  });
});
