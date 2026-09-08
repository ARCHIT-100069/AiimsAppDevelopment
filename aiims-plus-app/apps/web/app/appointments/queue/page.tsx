import { redirect } from "next/navigation";
import type { ListFacilitiesResponse } from "@aiims/api-contracts";
import { apiFetch } from "../../lib/api";
import { todayIST } from "../../lib/date";
import { readSession } from "../../lib/session";
import { AppShell } from "../../patients/shell";
import { QueueBoard } from "./queue-board";

export default async function QueuePage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (session.roles.includes("patient")) redirect("/portal");
  const res = await apiFetch("/v1/facilities?limit=100");
  const facilities: ListFacilitiesResponse = res.ok
    ? await res.json()
    : { data: [], meta: { nextCursor: null } };
  return (
    <AppShell active="Appointments">
      <QueueBoard facilities={facilities.data} date={todayIST()} />
    </AppShell>
  );
}
