/**
 * Node-side AI guards (defense in depth) — pure. PHI is redacted here BEFORE it
 * ever leaves the core to the AI plane (AIDR-0008), and operational-only safety
 * gates (injection / clinical-decision) run before any model is reached. The
 * plane re-applies both; belt and braces. No PHI is logged.
 */

const PHI_PATTERNS: [string, RegExp][] = [
  ["EMAIL", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g],
  ["ABHA", /\b\d{2}-?\d{4}-?\d{4}-?\d{4}\b/g],
  ["MRN", /\bMRN[-\s]?\d{3,}\b/gi],
  ["PHONE", /\+?\d[\d \-]{7,}\d/g],
  ["ID", /\b\d{7,}\b/g],
];

export function redactPhi(text: string): { text: string; applied: boolean } {
  let out = text;
  for (const [label, pattern] of PHI_PATTERNS) out = out.replace(pattern, `[REDACTED_${label}]`);
  return { text: out, applied: out !== text };
}

const INJECTION = [
  /ignore (all |the )?(previous|prior|above) (instructions|prompts)/i,
  /disregard .*(instruction|rule|policy)/i,
  /\byou are now\b/i,
  /system prompt/i,
  /\bjailbreak\b/i,
  /act as .*(admin|root|developer|dan)\b/i,
];
const CLINICAL_DECISION = [
  /what (should|do) (i|we) (prescribe|treat|do)/i,
  /recommend .*(treatment|medication|drug|dose|therapy)/i,
];

export class AiSafetyError extends Error {
  constructor(readonly kind: "prompt_injection" | "clinical_decision_out_of_scope") {
    super(`AI safety gate tripped: ${kind}`);
    this.name = "AiSafetyError";
  }
}

/** Operational-only enforcement — throws AiSafetyError on injection/out-of-scope. */
export function assertOperationallySafe(text: string): void {
  if (INJECTION.some((p) => p.test(text))) throw new AiSafetyError("prompt_injection");
  if (CLINICAL_DECISION.some((p) => p.test(text)))
    throw new AiSafetyError("clinical_decision_out_of_scope");
}
