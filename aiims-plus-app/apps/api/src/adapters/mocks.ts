/**
 * Mock adapter implementations (ADR-0010: "mock the integrations, keep the
 * structure"). Deterministic canned responses make the full experience
 * demoable with zero external dependency. No PHI is logged or fabricated.
 */
import { Inject, Injectable } from "@nestjs/common";
import type { AppConfig } from "@aiims/config";
import { CONFIG } from "../platform/config.provider";
import type {
  AbdmGateway,
  AiGateway,
  ConsentProvider,
  NotificationSender,
  PaymentGateway,
  StorageGateway,
} from "./ports";

@Injectable()
export class MockAbdmGateway implements AbdmGateway {
  async verifyAbha(abhaAddress: string): Promise<{ verified: boolean; reference: string }> {
    // Mock M1: any syntactically plausible address verifies.
    return { verified: abhaAddress.includes("@"), reference: `mock-abdm-${Date.now()}` };
  }

  async createAbha(): Promise<{ abhaNumber: string; abhaAddress: string; reference: string }> {
    // Clearly-synthetic 14-digit ABHA in the mock 99-prefix range (TDR-0013).
    const digits = `99${String(Math.floor(Math.random() * 1e12)).padStart(12, "0")}`;
    return {
      abhaNumber: digits,
      abhaAddress: `synthetic.${digits.slice(-6)}@abdm-mock`,
      reference: `mock-abdm-create-${Date.now()}`,
    };
  }

  async linkCareContext(input: {
    patientRef: string;
    encounterRef: string;
    consentArtifactRef: string;
  }): Promise<{ careContextRef: string }> {
    // Mock: deterministic care-context reference; no external call.
    return { careContextRef: `mock-carecontext-${input.encounterRef.split("/").pop()}` };
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

/** Deterministic keyword → ICD-10 mock (the default when no AI plane/model). */
const MOCK_ICD10: { keys: string[]; code: { system: string; code: string; display: string } }[] = [
  {
    keys: ["fever", "febrile", "pyrexia"],
    code: { system: "icd-10", code: "R50.9", display: "Fever, unspecified" },
  },
  {
    keys: ["cough", "uri", "cold", "respiratory"],
    code: {
      system: "icd-10",
      code: "J06.9",
      display: "Acute upper respiratory infection, unspecified",
    },
  },
  {
    keys: ["hypertension", "bp"],
    code: { system: "icd-10", code: "I10", display: "Essential (primary) hypertension" },
  },
  {
    keys: ["diabetes", "diabetic"],
    code: {
      system: "icd-10",
      code: "E11.9",
      display: "Type 2 diabetes mellitus without complications",
    },
  },
  {
    keys: ["back pain", "lumbago"],
    code: { system: "icd-10", code: "M54.5", display: "Low back pain" },
  },
];

@Injectable()
export class MockAiGateway implements AiGateway {
  async codingAssist(input: { text: string; tenantRef: string }): Promise<{
    suggestions: { code: { system: string; code: string; display: string }; confidence: number }[];
    label: "AI-generated — verify";
    redactionApplied: boolean;
    provider: string;
  }> {
    // Constitution enforced at the seam: operational-only, labelled, HITL.
    const text = input.text.toLowerCase();
    const suggestions = MOCK_ICD10.filter((m) => m.keys.some((k) => text.includes(k))).map((m) => ({
      code: m.code,
      confidence: 0.6,
    }));
    return {
      suggestions,
      label: "AI-generated — verify",
      redactionApplied: false,
      provider: "mock",
    };
  }
}

/**
 * Mock object storage (APDR-0007). Returns a presigned-style URL pointing at
 * the local MinIO endpoint — demonstrating the direct-to-storage flow (key +
 * expiry + no API byte-proxying) without depending on AWS. Real S3/MinIO
 * signature v4 is Stage 8 behind this same seam; bytes never touch the API.
 */
@Injectable()
export class MockStorageGateway implements StorageGateway {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  private url(objectKey: string, op: "put" | "get", expiresInSeconds: number): string {
    const base = this.config.S3_ENDPOINT ?? "http://localhost:9000";
    const bucket = this.config.S3_BUCKET;
    const params = new URLSearchParams({
      "X-Amz-Mock-Op": op,
      "X-Amz-Expires": String(expiresInSeconds),
      "X-Amz-Signature": `mock-${op}-${Date.now().toString(36)}`,
    });
    return `${base}/${bucket}/${objectKey}?${params.toString()}`;
  }

  async presignUpload(input: {
    objectKey: string;
    contentType: string;
    expiresInSeconds?: number;
  }): Promise<{ url: string; expiresInSeconds: number }> {
    const expiresInSeconds = input.expiresInSeconds ?? 900;
    return { url: this.url(input.objectKey, "put", expiresInSeconds), expiresInSeconds };
  }

  async presignDownload(input: {
    objectKey: string;
    expiresInSeconds?: number;
  }): Promise<{ url: string; expiresInSeconds: number }> {
    const expiresInSeconds = input.expiresInSeconds ?? 900;
    return { url: this.url(input.objectKey, "get", expiresInSeconds), expiresInSeconds };
  }
}
