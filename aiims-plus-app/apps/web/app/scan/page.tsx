import { redirect } from "next/navigation";
import { readSession } from "../lib/session";
import { homeFor } from "../lib/roles";
import { AppShell } from "../patients/shell";
import { ScanApp } from "./scan-app";

export default async function ScanPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (session.roles.includes("patient")) redirect("/portal");
  // Admin deliberately holds no patient:read permission (separation of
  // duties) — the lookup this page depends on would 403 for that role.
  if (session.roles.includes("admin")) redirect(homeFor(session.roles));

  return (
    <AppShell active="Scan ID">
      <ScanApp />
    </AppShell>
  );
}
