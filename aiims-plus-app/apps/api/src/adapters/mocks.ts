/**
 * Mock adapter implementations (ADR-0010: "mock the integrations, keep the
 * structure"). Deterministic canned responses make the full experience
 * demoable with zero external dependency. No PHI is logged or fabricated.
 */
import { Injectable } from "@nestjs/common";
import type {
  AbdmGateway,
  AiGateway,
  ConsentProvider,
  NotificationSender,
  PaymentGateway,
} from "./ports";

@Injectable()
export class MockAbdmGateway implements AbdmGateway {
  async verifyAbha(abhaAddress: string): Promise<{ verified: boolean; reference: string }> {
    // Mock M1: any syntactically plausible address verifies.
    return { verified: abhaAddress.includes("@"), reference: `mock-abdm-${Date.now()}` };
  }
}

@Injectable()
export class MockConsentProvider implements ConsentProvider {
  async validateConsent(input: {
    subjectId: string;
    purpose: string;
    scope: string[];
  }): Promise<{ valid: boolean; artifactRef: string }> {
    return { valid: input.scope.length > 0, artifactRef: `mock-consent-${input.purpose}` };
  }
}

@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  async createPaymentIntent(input: {
    amount: string;
    currency: string;
    reference: string;
  }): Promise<{ intentRef: string; status: "created" }> {
    return { intentRef: `mock-pay-${input.reference}`, status: "created" };
  }
}

@Injectable()
export class MockNotificationSender implements NotificationSender {
  async send(input: {
    channel: "sms" | "email";
    templateRef: string;
    recipientRef: string;
  }): Promise<{ accepted: boolean; messageRef: string }> {
    return { accepted: true, messageRef: `mock-${input.channel}-${input.templateRef}` };
  }
}

@Injectable()
export class MockAiGateway implements AiGateway {
  async suggest(input: {
    capability: "coding_assist" | "documentation_draft" | "search";
    contextRef: string;
  }): Promise<{ suggestionRef: string; label: "AI-generated — verify" }> {
    // Constitution enforced at the seam: only operational capabilities exist
    // on the interface; outputs are labeled and human-reviewed (AIDR-0010).
    return { suggestionRef: `mock-ai-${input.capability}`, label: "AI-generated — verify" };
  }
}
