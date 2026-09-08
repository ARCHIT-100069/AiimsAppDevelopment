import { redirect } from "next/navigation";
import type { ListPractitionersResponse } from "@aiims/api-contracts";
import { apiFetch } from "../lib/api";
import { readSession } from "../lib/session";
import { AppShell, canManagePractitioners } from "../patients/shell";
import { PractitionerList } from "./practitioner-list";

export default async function PractitionersPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (session.roles.includes("patient")) redirect("/portal");
  const res = await apiFetch("/v1/practitioners?limit=50");
  const body: ListPractitionersResponse = res.ok
    ? await res.json()
    : { data: [], meta: { nextCursor: null } };
  return (
    <AppShell active="Practitioners">
      <PractitionerList initial={body.data} canManage={await canManagePractitioners()} />
    </AppShell>
  );
}
