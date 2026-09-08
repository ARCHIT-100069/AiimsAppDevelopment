/** Where each role lands after login (and the guard target for wrong-role visits). */
export function homeFor(roles: readonly string[]): string {
  if (roles.includes("patient")) return "/portal";
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("doctor")) return "/doctor";
  if (roles.includes("nurse")) return "/nurse";
  return "/patients"; // front_desk
}

/** Friendly role label for greetings ("Hey Doctor"). */
export function friendlyRole(roles: readonly string[]): string {
  if (roles.includes("patient")) return "Patient";
  if (roles.includes("admin")) return "Admin";
  if (roles.includes("doctor")) return "Doctor";
  if (roles.includes("nurse")) return "Nurse";
  if (roles.includes("front_desk")) return "Front Desk";
  return "Team";
}
