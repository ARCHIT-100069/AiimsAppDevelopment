/**
 * Stage 0 exit criterion (Master Plan §10): "all mock adapters resolve".
 * Builds the real AdaptersModule DI graph with mock-mode config and asserts
 * every port resolves to a working mock — and that selecting "real" fails
 * fast (real adapters are Stage 8 work, ADR-0010).
 */
import { Global, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { CONFIG } from "../platform/config.provider";
import { AdaptersModule } from "./adapters.module";
import {
  ABDM_GATEWAY,
  AI_GATEWAY,
  CONSENT_PROVIDER,
  NOTIFICATION_SENDER,
  PAYMENT_GATEWAY,
  type AbdmGateway,
  type AiGateway,
  type ConsentProvider,
  type NotificationSender,
  type PaymentGateway,
} from "./ports";

/**
 * Vitest's transformer does not support legacy decorator syntax, so the Nest
 * decorators are applied as plain function calls — identical semantics.
 */
function configModule(mode: "mock" | "real") {
  class TestConfigModule {}
  Module({
    providers: [
      {
        provide: CONFIG,
        useValue: {
          ADAPTER_ABDM: mode,
          ADAPTER_CONSENT: mode,
          ADAPTER_PAYMENT: mode,
          ADAPTER_NOTIFICATION: mode,
          ADAPTER_AI: mode,
        },
      },
    ],
    exports: [CONFIG],
  })(TestConfigModule);
  Global()(TestConfigModule);
  return TestConfigModule;
}

describe("adapter ports (BDR-0008, ADR-0010)", () => {
  it("all five ports resolve to mocks and answer", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [configModule("mock"), AdaptersModule],
    }).compile();

    const abdm = moduleRef.get<AbdmGateway>(ABDM_GATEWAY);
    const consent = moduleRef.get<ConsentProvider>(CONSENT_PROVIDER);
    const payment = moduleRef.get<PaymentGateway>(PAYMENT_GATEWAY);
    const notify = moduleRef.get<NotificationSender>(NOTIFICATION_SENDER);
    const ai = moduleRef.get<AiGateway>(AI_GATEWAY);

    expect((await abdm.verifyAbha("demo@abdm")).verified).toBe(true);
    expect(
      (await consent.validateConsent({ subjectId: "s", purpose: "treatment", scope: ["OPD"] }))
        .valid,
    ).toBe(true);
    expect(
      (await payment.createPaymentIntent({ amount: "10.00", currency: "INR", reference: "r1" }))
        .status,
    ).toBe("created");
    expect(
      (await notify.send({ channel: "sms", templateRef: "t1", recipientRef: "u1" })).accepted,
    ).toBe(true);
    const coding = await ai.codingAssist({ text: "fever and cough", tenantRef: "t1" });
    expect(coding.label).toBe("AI-generated — verify");
    expect(coding.provider).toBe("mock");
    expect(coding.suggestions.length).toBeGreaterThan(0); // fever/cough → ICD-10
  });

  it('selecting "real" without credentials fails fast at boot (Stage 8 real adapters)', async () => {
    // Real adapters are BUILT but disabled: selecting "real" with no credentials
    // must throw at construction, never silently fall back to mock.
    await expect(
      Test.createTestingModule({ imports: [configModule("real"), AdaptersModule] }).compile(),
    ).rejects.toThrow(/requires|pending/i);
  });
});
