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
import { PLATFORM_ADMIN_ROLE, type RoleCode } from "@aiims/domain-types";

/** Permission vocabulary — grows per stage, never ad hoc strings. */
export const PERMISSIONS = [
  // Stage 1 — Core Platform
  "platform:tenant:manage", // platform operators only
  "org:manage", // organizations, facilities, departments
  "org:read",
  "user:manage", // app users + role assignment
  "user:read",
  "reference:read", // global code systems
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Role → permission policy. Data-driven; separation of duties per SDR-0002:
 * platform_admin administers the tenant REGISTRY only and holds no tenant
 * data permission; clinical roles read the directory, never manage it.
 */
const ROLE_PERMISSIONS: Record<RoleCode | typeof PLATFORM_ADMIN_ROLE, readonly Permission[]> = {
  [PLATFORM_ADMIN_ROLE]: ["platform:tenant:manage"],
  admin: ["org:manage", "org:read", "user:manage", "user:read", "reference:read"],
  doctor: ["org:read", "user:read", "reference:read"],
  nurse: ["org:read", "reference:read"],
  front_desk: ["org:read", "reference:read"],
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
