/**
 * Adapter wiring (BDR-0008): mode comes from configuration (ADAPTER_* =
 * mock|real, mock default per ADR-0010). Selecting "real" in Stage 0 fails
 * fast at boot — real integrations are Stage 8 work behind these same seams.
 */
import { Global, Module } from "@nestjs/common";
import type { AppConfig } from "@aiims/config";
import { CONFIG } from "../platform/config.provider";
import {
  MockAbdmGateway,
  MockAiGateway,
  MockConsentProvider,
  MockNotificationSender,
  MockPaymentGateway,
} from "./mocks";
import {
  ABDM_GATEWAY,
  AI_GATEWAY,
  CONSENT_PROVIDER,
  NOTIFICATION_SENDER,
  PAYMENT_GATEWAY,
} from "./ports";

function select<T>(mode: "mock" | "real", name: string, mock: T): T {
  if (mode === "real") {
    throw new Error(
      `${name}: "real" adapter is Production work (Stage 8, ADR-0010) — only "mock" exists in Stage 0`,
    );
  }
  return mock;
}

@Global()
@Module({
  providers: [
    MockAbdmGateway,
    MockConsentProvider,
    MockPaymentGateway,
    MockNotificationSender,
    MockAiGateway,
    {
      provide: ABDM_GATEWAY,
      inject: [CONFIG, MockAbdmGateway],
      useFactory: (c: AppConfig, mock: MockAbdmGateway) =>
        select(c.ADAPTER_ABDM, "AbdmGateway", mock),
    },
    {
      provide: CONSENT_PROVIDER,
      inject: [CONFIG, MockConsentProvider],
      useFactory: (c: AppConfig, mock: MockConsentProvider) =>
        select(c.ADAPTER_CONSENT, "ConsentProvider", mock),
    },
    {
      provide: PAYMENT_GATEWAY,
      inject: [CONFIG, MockPaymentGateway],
      useFactory: (c: AppConfig, mock: MockPaymentGateway) =>
        select(c.ADAPTER_PAYMENT, "PaymentGateway", mock),
    },
    {
      provide: NOTIFICATION_SENDER,
      inject: [CONFIG, MockNotificationSender],
      useFactory: (c: AppConfig, mock: MockNotificationSender) =>
        select(c.ADAPTER_NOTIFICATION, "NotificationSender", mock),
    },
    {
      provide: AI_GATEWAY,
      inject: [CONFIG, MockAiGateway],
      useFactory: (c: AppConfig, mock: MockAiGateway) => select(c.ADAPTER_AI, "AiGateway", mock),
    },
  ],
  exports: [ABDM_GATEWAY, CONSENT_PROVIDER, PAYMENT_GATEWAY, NOTIFICATION_SENDER, AI_GATEWAY],
})
export class AdaptersModule {}
