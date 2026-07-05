/**
 * @aiims/domain-types — the canonical domain vocabulary.
 *
 * Every package and app depends inward on this package; it depends on nothing
 * but Zod (Blueprint §9). No framework, no ORM, no IO (BDR-0001).
 */
import { z } from "zod";

/** UUID string schema (ids are UUIDv7, application-generated — DDR-0001). */
export const uuidSchema = z.uuid();

/** Branded identifier types — prevent accidental cross-entity id mixups. */
export const tenantIdSchema = uuidSchema.brand<"TenantId">();
export type TenantId = z.infer<typeof tenantIdSchema>;

export const userIdSchema = uuidSchema.brand<"UserId">();
export type UserId = z.infer<typeof userIdSchema>;

export const noteIdSchema = uuidSchema.brand<"NoteId">();
export type NoteId = z.infer<typeof noteIdSchema>;

/** ISO-8601 timestamp (API layer uses timestamptz — DB Arch §4). */
export const isoTimestampSchema = z.iso.datetime({ offset: true });

/**
 * The security principal resolved from a verified OIDC token (SDR-0001).
 * Set once per request; drives RLS tenant context and audit actor identity.
 */
export interface Principal {
  readonly kind: "tenant";
  /** `platform.app_user.id` resolved from the Keycloak subject. */
  readonly actorId: UserId;
  /** Tenant the token is scoped to — becomes `app.tenant_id` (DDR-0002). */
  readonly tenantId: TenantId;
  /** RBAC role codes (SDR-0002). */
  readonly roles: readonly string[];
}

/**
 * Platform operator (Stage 1): authorized by the Keycloak realm role
 * `platform_admin`, outside any tenant's RLS scope. May ONLY perform tenant
 * registry operations — least privilege; no access to tenant data.
 */
export interface PlatformPrincipal {
  readonly kind: "platform";
  /** Keycloak subject (uuid) — the audit actor for registry operations. */
  readonly actorId: string;
  readonly roles: readonly string[];
}

export type AuthenticatedParty = Principal | PlatformPrincipal;

/** Keycloak REALM role marking a platform operator (Stage 1 decision). */
export const PLATFORM_ADMIN_ROLE = "platform_admin" as const;

/** Tenant role codes (platform.role seed). */
export const ROLE_CODES = ["admin", "doctor", "nurse", "front_desk"] as const;
export type RoleCode = (typeof ROLE_CODES)[number];
