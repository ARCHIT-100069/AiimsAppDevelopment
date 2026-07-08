import { describe, expect, it } from "vitest";
import { AI_LABEL, codingSuggestRequestSchema, codingSuggestResponseSchema } from "./ai";

describe("AI contracts (Stage 7, operational-only + HITL)", () => {
  it("coding request requires non-empty, bounded text", () => {
    expect(codingSuggestRequestSchema.safeParse({ text: "cough and fever" }).success).toBe(true);
    expect(codingSuggestRequestSchema.safeParse({ text: "" }).success).toBe(false);
    expect(codingSuggestRequestSchema.safeParse({ text: "x".repeat(5000) }).success).toBe(false);
  });

  it("response label is the mandatory HITL literal (never auto-applied)", () => {
    const parsed = codingSuggestResponseSchema.parse({
      capability: "coding_assist",
      label: AI_LABEL,
      suggestions: [
        { code: { system: "icd-10", code: "J06.9", display: "Acute URI" }, confidence: 0.7 },
      ],
      redactionApplied: true,
      provider: "mock",
      disclaimer: "Advisory only.",
    });
    expect(parsed.label).toBe("AI-generated — verify");
    // A non-literal label is rejected — the label cannot be spoofed to "approved".
    expect(
      codingSuggestResponseSchema.safeParse({
        capability: "coding_assist",
        label: "approved",
        suggestions: [],
        redactionApplied: true,
        provider: "mock",
        disclaimer: "x",
      }).success,
    ).toBe(false);
  });
});
