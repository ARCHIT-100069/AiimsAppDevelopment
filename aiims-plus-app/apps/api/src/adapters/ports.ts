/**
 * Integration ports (BDR-0008, ADR-0010): every external system is reached
 * ONLY through these interfaces. Stage 0 ships mock implementations selected
 * by configuration; real adapters are Production work behind the SAME seams
 * — swapping is a config change, never a domain change.
 *
 * Method signatures are deliberately minimal in Stage 0: they fix the seam,
 * not the full surface (that grows with the stages that need them).
 */

/** ADR-0006 — ABDM gateway (M1 ABHA first; M2/M3 grow here). */
export interface AbdmGateway {
  /** Mock M1: verify an ABHA address exists/matches. */
  verifyAbha(abhaAddress: string): Promise<{ verified: boolean; reference: string }>;
  /** Mock M1: create an ABHA for a new patient (real flow is Stage 8). */
  createAbha(): Promise<{ abhaNumber: string; abhaAddress: string; reference: string }>;
}

/** ADR-0004 — regime-agnostic consent authority. */
export interface ConsentProvider {
  /** Is there a valid, unexpired artifact covering this purpose+scope? */
  validateConsent(input: {
    subjectId: string;
    purpose: string;
    scope: string[];
  }): Promise<{ valid: boolean; artifactRef: string }>;
}

/** Blueprint §29 — payment gateway (Billing stage consumes it). */
export interface PaymentGateway {
  createPaymentIntent(input: {
    amount: string;
    currency: string;
    reference: string;
  }): Promise<{ intentRef: string; status: "created" }>;
}

/** Blueprint §29 — SMS/email providers (Notifications stage consumes it). */
export interface NotificationSender {
  /** Payload is a template reference + params — never raw PHI (SDR-0004). */
  send(input: {
    channel: "sms" | "email";
    templateRef: string;
    recipientRef: string;
  }): Promise<{ accepted: boolean; messageRef: string }>;
}

/** AIDR-0002 — the single AI ingress/egress. Operational-only (Constitution). */
export interface AiGateway {
  /**
   * Request an operational suggestion. Stage 0 stub: the mock refuses
   * clinical categories by construction, mirroring the gateway contract.
   */
  suggest(input: {
    capability: "coding_assist" | "documentation_draft" | "search";
    contextRef: string;
  }): Promise<{ suggestionRef: string; label: "AI-generated — verify" }>;
}

/**
 * APDR-0007 — object storage seam (Stage 5). Large clinical files never pass
 * through the API: the server issues short-lived PRESIGNED URLs and the client
 * transfers bytes directly to storage. Mock = local MinIO; real AWS S3 signing
 * is Stage 8 behind this same seam.
 */
export interface StorageGateway {
  /** A presigned PUT URL for a tenant-scoped object key. */
  presignUpload(input: {
    objectKey: string;
    contentType: string;
    expiresInSeconds?: number;
  }): Promise<{ url: string; expiresInSeconds: number }>;
  /** A presigned GET URL for an existing object. */
  presignDownload(input: {
    objectKey: string;
    expiresInSeconds?: number;
  }): Promise<{ url: string; expiresInSeconds: number }>;
}

/* NestJS injection tokens for the ports. */
export const ABDM_GATEWAY = Symbol("ABDM_GATEWAY");
export const CONSENT_PROVIDER = Symbol("CONSENT_PROVIDER");
export const PAYMENT_GATEWAY = Symbol("PAYMENT_GATEWAY");
export const NOTIFICATION_SENDER = Symbol("NOTIFICATION_SENDER");
export const AI_GATEWAY = Symbol("AI_GATEWAY");
export const STORAGE_GATEWAY = Symbol("STORAGE_GATEWAY");
