/** Where each role lands after login (and the guard target for wrong-role visits). */
export function homeFor(roles: readonly string[]): string {
  if (roles.includes("patient")) return "/portal";
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("doctor")) return "/doctor";
  return "/patients"; // nurse / front_desk
}
