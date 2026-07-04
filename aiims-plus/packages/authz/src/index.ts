// Policy Decision Point (skeleton). RBAC now; ABAC/consent-aware ready (SDR-0002).
export type Role = "admin" | "front_desk" | "doctor" | "nurse";
export interface Principal { userId: string; tenantId: string; roles: Role[]; }
export interface AccessRequest { action: string; resource: string; }

const RBAC: Record<Role, string[]> = {
  admin: ["*"],
  front_desk: ["note:create", "note:read"],
  doctor: ["note:create", "note:read"],
  nurse: ["note:read"],
};
export function can(p: Principal, req: AccessRequest): boolean {
  const perm = `${req.resource}:${req.action}`;
  return p.roles.some((r) => (RBAC[r] ?? []).some((g) => g === "*" || g === perm));
}
