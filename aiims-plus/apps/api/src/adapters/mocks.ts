import { uuidv7 } from "uuidv7";
import type { AbdmGateway, ConsentProvider, PaymentGateway, NotificationSender, AiGateway } from "./ports.js";
// MVP mocks — make the full experience demoable with no external dependency (ADR 0010).
export const mockAbdm: AbdmGateway = { async createAbha() { return { abhaNumber: "91-" + Math.floor(1e13 * Math.random()), abhaAddress: "mock@abdm" }; } };
export const mockConsent: ConsentProvider = { async issueArtifact() { return { artifactId: uuidv7(), status: "granted" }; } };
export const mockPayment: PaymentGateway = { async createIntent() { return { intentId: uuidv7(), status: "requires_capture" }; } };
export const mockNotify: NotificationSender = { async send() { return { messageId: uuidv7() }; } };
export const mockAi: AiGateway = { async assist() { return { suggestion: "(mock) AI disabled in Stage 0", model: "mock" }; } };
