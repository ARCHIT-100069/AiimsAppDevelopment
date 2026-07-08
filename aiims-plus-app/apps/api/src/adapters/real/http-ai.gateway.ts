/**
 * Real AiGateway (Stage 7/8) — HTTP client to the isolated Python AI plane
 * (AIDR-0003). Activated by `ADAPTER_AI=real` + `AI_PLANE_URL`; otherwise the
 * mock is used. AI failure NEVER blocks care (AIDR-0014): a plane/provider error
 * degrades to zero suggestions, not an exception. A plane-reported safety
 * violation surfaces as a DomainError (→ 422) so the caller learns their input
 * was rejected.
 */
import { Inject, Injectable } from "@nestjs/common";
import type { AppConfig } from "@aiims/config";
import { CONFIG } from "../../platform/config.provider";
import { DomainError } from "../../common/errors";
import type { AiGateway } from "../ports";

interface PlaneSuggestion {
  code: { system: string; code: string; display: string };
  confidence: number;
}

@Injectable()
export class HttpAiGateway implements AiGateway {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {
    if (!config.AI_PLANE_URL) {
      // Fail fast at boot: real AI selected but no plane configured.
      throw new Error("AiGateway: ADAPTER_AI=real requires AI_PLANE_URL (the isolated AI plane)");
    }
  }

  async codingAssist(input: { text: string; tenantRef: string }): Promise<{
    suggestions: PlaneSuggestion[];
    label: "AI-generated — verify";
    redactionApplied: boolean;
    provider: string;
  }> {
    const base = this.config.AI_PLANE_URL!.replace(/\/$/, "");
    let body: Record<string, unknown>;
    try {
      const res = await fetch(`${base}/v1/ai/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ capability: "coding_assist", text: input.text }),
        signal: AbortSignal.timeout(15_000),
      });
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      // AIDR-0014: never block care on AI — degrade to no suggestions.
      return {
        suggestions: [],
        label: "AI-generated — verify",
        redactionApplied: true,
        provider: "unavailable",
      };
    }
    if (body.error === "safety_violation") {
      throw new DomainError(`AI input rejected by safety gate (${String(body.kind)})`);
    }
    return {
      suggestions: Array.isArray(body.suggestions) ? (body.suggestions as PlaneSuggestion[]) : [],
      label: "AI-generated — verify",
      redactionApplied: Boolean(body.redactionApplied),
      provider: typeof body.provider === "string" ? body.provider : "http",
    };
  }
}
