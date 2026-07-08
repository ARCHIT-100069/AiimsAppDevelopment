/**
 * Adapter wiring (BDR-0008): mode comes from configuration (ADAPTER_* =
 * mock|real, mock default per ADR-0010). Real adapters (Stage 8) are built and
 * live behind the SAME seams; each is constructed ONLY when its mode is "real"
 * and fails fast at boot if its credentials are missing. Swapping mock↔real is
 * a config change, never a domain change. Nothing is fabricated — supply
 * credentials to activate. `real` remains disabled by default everywhere.
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
  MockStorageGateway,
} from "./mocks";
import { HttpAiGateway } from "./real/http-ai.gateway";
import { RealAbdmGateway } from "./real/real-abdm.gateway";
import { RealNotificationSender } from "./real/real-notification.sender";
import { RealPaymentGateway } from "./real/real-payment.gateway";
import { RealStorageGateway } from "./real/real-storage.gateway";
import {
  ABDM_GATEWAY,
  AI_GATEWAY,
  CONSENT_PROVIDER,
  NOTIFICATION_SENDER,
  PAYMENT_GATEWAY,
  STORAGE_GATEWAY,
  type AbdmGateway,
  type AiGateway,
  type NotificationSender,
  type PaymentGateway,
  type StorageGateway,
} from "./ports";

/** mock by default; construct the real adapter (fail-fast on creds) when selected. */
function pick<T>(mode: "mock" | "real", mock: T, makeReal: () => T): T {
  return mode === "real" ? makeReal() : mock;
}

@Global()
@Module({
  providers: [
    MockAbdmGateway,
    MockConsentProvider,
    MockPaymentGateway,
    MockStorageGateway,
    MockNotificationSender,
    MockAiGateway,
    {
      provide: ABDM_GATEWAY,
      inject: [CONFIG, MockAbdmGateway],
      useFactory: (c: AppConfig, mock: MockAbdmGateway) =>
        pick<AbdmGateway>(c.ADAPTER_ABDM, mock, () => new RealAbdmGateway(c)),
    },
    {
      // The DPDP/ABDM Consent Manager is part of ABDM certification; the real
      // client lands with the ABDM sandbox. Mock is the only built impl today.
      provide: CONSENT_PROVIDER,
      inject: [CONFIG, MockConsentProvider],
      useFactory: (c: AppConfig, mock: MockConsentProvider) => {
        if (c.ADAPTER_CONSENT === "real") {
          throw new Error(
            "ConsentProvider: real (ABDM Consent Manager) is wired with the ABDM sandbox — pending certification",
          );
        }
        return mock;
      },
    },
    {
      provide: PAYMENT_GATEWAY,
      inject: [CONFIG, MockPaymentGateway],
      useFactory: (c: AppConfig, mock: MockPaymentGateway) =>
        pick<PaymentGateway>(c.ADAPTER_PAYMENT, mock, () => new RealPaymentGateway(c)),
    },
    {
      provide: NOTIFICATION_SENDER,
      inject: [CONFIG, MockNotificationSender],
      useFactory: (c: AppConfig, mock: MockNotificationSender) =>
        pick<NotificationSender>(c.ADAPTER_NOTIFICATION, mock, () => new RealNotificationSender(c)),
    },
    {
      provide: AI_GATEWAY,
      inject: [CONFIG, MockAiGateway],
      useFactory: (c: AppConfig, mock: MockAiGateway) =>
        pick<AiGateway>(c.ADAPTER_AI, mock, () => new HttpAiGateway(c)),
    },
    {
      provide: STORAGE_GATEWAY,
      inject: [CONFIG, MockStorageGateway],
      useFactory: (c: AppConfig, mock: MockStorageGateway) =>
        pick<StorageGateway>(c.ADAPTER_STORAGE, mock, () => new RealStorageGateway(c)),
    },
  ],
  exports: [
    ABDM_GATEWAY,
    CONSENT_PROVIDER,
    PAYMENT_GATEWAY,
    NOTIFICATION_SENDER,
    AI_GATEWAY,
    STORAGE_GATEWAY,
  ],
})
export class AdaptersModule {}
