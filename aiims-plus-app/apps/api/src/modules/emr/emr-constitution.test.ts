/**
 * CONSTITUTION GATE (Stage 5, decision D-5.9). The EMR is the clinical heart:
 * AI must not appear here, and signing is human-only. This test statically
 * asserts that NO file in the EMR module references the AI gateway seam — so an
 * accidental AI import into clinical documentation fails CI.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const emrDir = dirname(fileURLToPath(import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("EMR Constitution gate (D-5.9)", () => {
  const files = walk(emrDir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  it("scans a non-trivial number of EMR source files", () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it("no EMR source file references the AI gateway (AI is barred from the clinical heart)", () => {
    const offenders = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      return /AI_GATEWAY|AiGateway|ai-gateway|adapters\/.*ai/i.test(src);
    });
    expect(offenders, `AI referenced in EMR: ${JSON.stringify(offenders)}`).toEqual([]);
  });
});
