/**
 * @aiims/authz — the Policy Decision Point (SDR-0002).
 *
 * RBAC now (user/role/department/organization/resource per Blueprint §11),
 * shaped to accept ABAC/ReBAC/consent-aware policies later without a rewrite:
 * the decision input is a context object, so richer attributes (department,
 * relationship, consent artifact) slot in as new policy inputs, not new APIs.
 *
 * Enforcement (PEP) lives in NestJS guards; this package only decides.
 */
import { PATIENT_ROLE, PLATFORM_ADMIN_ROLE, type RoleCode } from "@aiims/domain-types";

/** Roles that treat patients — used by the practitioner clinical-role check (decision i). */
export const CLINICAL_ROLES = ["doctor", "nurse"] as const;

/** Permission vocabulary — grows per stage, never ad hoc strings. */
export const PERMISSIONS = [
  // Stage 1 — Core Platform
  "platform:tenant:manage", // platform operators only
  "org:manage", // organizations, facilities, departments
  "org:read",
  "user:manage", // app users + role assignment
  "user:read",
  "reference:read", // global code systems
  // Stage 2 — Patient Module (decision S2-d: admin holds NO clinical perms)
  "patient:create",
  "patient:read",
  "patient:update",
  // Stage 3 — Practitioner (decision e: admin manages the staff directory)
  "practitioner:manage",
  "practitioner:read",
  // Stage 4 — Appointments / OPD (decision D-4.7: reception books, admin
  // configures schedules, doctors advance their queue — separation of duties)
  "appointment:manage", // book / reschedule / cancel / no-show
  "appointment:checkin", // arrive a patient → issue token + open encounter
  "appointment:read",
  "schedule:manage", // availability templates
  "schedule:read", // templates + computed slots
  "encounter:read",
  // Stage 5 — EMR (Constitution: sign is human/doctor-only; no AI here)
  "encounter:document", // notes, vitals, conditions on an in-progress encounter
  "encounter:sign", // finalize (doctor-only, human attestation)
  "order:place", // place a lab/imaging order (doctor)
  "result:file", // file a diagnostic report against an order
  "result:read",
  // Stage 6 — Billing (reception/cashier invoices + settles; consent-gated share)
  "billing:manage", // generate invoice, take (mock) payment
  "billing:read",
  "encounter:share", // mock ABDM share-on-consent (closes the golden path)
  // Stage 7 — AI (operational-only, HITL). Clinicians may request suggestions.
  "ai:use",
  // Patient portal — a patient reads ONLY their own record (/v1/me/*)…
  "self:read",
  // …and books an appointment for themselves (server forces their own id).
  "self:book",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Role → permission policy. Data-driven; separation of duties per SDR-0002:
 * platform_admin administers the tenant REGISTRY only and holds no tenant
 * data permission; clinical roles read the directory, never manage it.
 */
const ROLE_PERMISSIONS: Record<
  RoleCode | typeof PLATFORM_ADMIN_ROLE | typeof PATIENT_ROLE,
  readonly Permission[]
> = {
  [PLATFORM_ADMIN_ROLE]: ["platform:tenant:manage"],
  // Patient portal: read own record + book own appointments — nothing else.
  [PATIENT_ROLE]: ["self:read", "self:book"],
  // Separation of duties (SDR-0002): admin administers, clinicians treat,
  // front desk registers — admin deliberately holds NO patient permission.
  admin: [
    "org:manage",
    "org:read",
    "user:manage",
    "user:read",
    "reference:read",
    "practitioner:manage",
    "practitioner:read",
    // Configures OPD schedules and oversees; does NOT book (front desk does).
    "schedule:manage",
    "schedule:read",
    "appointment:read",
    "encounter:read",
    "result:read",
    "billing:read",
  ],
  doctor: [
    "org:read",
    "user:read",
    "reference:read",
    "patient:read",
    "patient:update",
    "practitioner:read",
    "appointment:read",
    "schedule:read",
    "encounter:read",
    // The clinical heart (Stage 5): document, sign (Constitution: doctor-only),
    // order, and file results.
    "encounter:document",
    "encounter:sign",
    "order:place",
    "result:file",
    "result:read",
    "billing:read",
    // A doctor may share the encounter on consent (care-context linking).
    "encounter:share",
    // Operational AI assistance (advisory, HITL — never auto-applied).
    "ai:use",
  ],
  nurse: [
    "org:read",
    "reference:read",
    "patient:read",
    "practitioner:read",
    "appointment:read",
    "schedule:read",
    "encounter:read",
    // Nurse may document (vitals) but NOT sign, order, or file results.
    "encounter:document",
    "result:read",
    "billing:read",
  ],
  front_desk: [
    "org:read",
    "reference:read",
    "patient:create",
    "patient:read",
    "patient:update",
    "practitioner:read",
    // Reception owns the OPD desk: booking through check-in.
    "appointment:manage",
    "appointment:checkin",
    "appointment:read",
    "schedule:read",
    "encounter:read",
    "result:read",
    // Reception is also the cashier: invoice + settle + consent-share.
    "billing:manage",
    "billing:read",
    "encounter:share",
  ],
};

export interface Decision {
  readonly allowed: boolean;
  /** Safe for logs/audit — never contains PHI. */
  readonly reason: string;
}

/** ABAC-ready decision context; Stage 1 uses roles (+ department later). */
export interface AuthzInput {
  readonly principal: { readonly roles: readonly string[] };
  readonly permission: Permission;
}

export function decide({ principal, permission }: AuthzInput): Decision {
  for (const role of principal.roles) {
    const grants = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
    if (grants?.includes(permission)) {
      return { allowed: true, reason: `role "${role}" grants "${permission}"` };
    }
  }
  return {
    allowed: false,
    reason: `no role of [${principal.roles.join(", ")}] grants "${permission}"`,
  };
}
