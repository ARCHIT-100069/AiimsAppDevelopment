/**
 * CONSTITUTION GATE for AI (Stage 7). The AI plane is operational-only and has
 * NO write path to clinical records. This static scan asserts no AI source file
 * imports a clinical-write helper — so an accidental "AI writes to the chart"
 * regression fails CI. AI reaches the world only through the AiGateway seam.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aiDir = dirname(fileURLToPath(import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// Any of these appearing in an AI source file = a forbidden clinical write path.
const FORBIDDEN = [
  "insertObservation",
  "insertCondition",
  "insertNote",
  "insertServiceRequest",
  "insertDiagnosticReport",
  "signEncounterVersioned",
  "updateEncounterChiefComplaint",
  "insertPatient",
  "insertAppointment",
];

describe("AI Constitution gate (operational-only, no write path)", () => {
  const files = walk(aiDir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  it("scans the AI module source", () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  it("no AI source file imports a clinical-write helper", () => {
    const offenders = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      return FORBIDDEN.some((sym) => src.includes(sym));
    });
    expect(offenders, `AI wrote to clinical data: ${JSON.stringify(offenders)}`).toEqual([]);
  });
});
