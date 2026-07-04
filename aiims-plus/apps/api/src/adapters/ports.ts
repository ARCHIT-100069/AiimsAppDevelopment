// Stable integration interfaces. Real impls arrive in Stage 8, selected by feature flag.
export interface AbdmGateway { createAbha(input: { patientRef: string }): Promise<{ abhaNumber: string; abhaAddress: string }>; }
export interface ConsentProvider { issueArtifact(input: { subject: string; purpose: string }): Promise<{ artifactId: string; status: string }>; }
export interface PaymentGateway { createIntent(input: { amount: string; currency: string }): Promise<{ intentId: string; status: string }>; }
export interface NotificationSender { send(input: { to: string; template: string }): Promise<{ messageId: string }>; }
export interface AiGateway { assist(input: { capability: string; redactedContext: unknown }): Promise<{ suggestion: string; model: string }>; }
