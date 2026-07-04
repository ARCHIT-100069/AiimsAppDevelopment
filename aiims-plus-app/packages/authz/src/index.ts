/**
 * @aiims/authz — the Policy Decision Point (SDR-0002).
 *
 * RBAC now (user/role/department/organization/resource per Blueprint §11),
 * shaped to accept ABAC/ReBAC/consent-aware policies later without a rewrite:
 * `Decision` takes a full context object, so richer attributes (department,
 * relationship, consent artifact) slot in as new policy inputs, not new APIs.
 *
 * Enforcement (PEP) lives in NestJS guards; this package only decides.
 */
import type { Principal, RoleCode } from "@aiims/domain-types";

/** Stage 0 permission vocabulary — grows with each module (never ad hoc strings). */
export const PERMISSIONS = ["note:create", "note:read"] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Role → permission policy. Data-driven so it can move to `platform.role`
 * configuration in Stage 1 without changing the decision API.
 */
const ROLE_PERMISSIONS: Record<RoleCode, readonly Permission[]> = {
  admin: ["note:create", "note:read"],
  doctor: ["note:create", "note:read"],
  nurse: ["note:read"],
  front_desk: ["note:read"],
};

export interface Decision {
  readonly allowed: boolean;
  /** Safe for logs/audit — never contains PHI. */
  readonly reason: string;
}

/** ABAC-ready decision context; Stage 0 uses only the principal's roles. */
export interface AuthzInput {
  readonly principal: Pick<Principal, "roles">;
  readonly permission: Permission;
}

export function decide({ principal, permission }: AuthzInput): Decision {
  for (const role of principal.roles) {
    const grants = ROLE_PERMISSIONS[role as RoleCode];
    if (grants?.includes(permission)) {
      return { allowed: true, reason: `role "${role}" grants "${permission}"` };
    }
  }
  return {
    allowed: false,
    reason: `no role of [${principal.roles.join(", ")}] grants "${permission}"`,
  };
}
