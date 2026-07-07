import { redirect } from "next/navigation";
import type { ListFacilitiesResponse } from "@aiims/api-contracts";
import { apiFetch } from "../../lib/api";
import { readSession } from "../../lib/session";
import { AppShell } from "../../patients/shell";
import { QueueBoard } from "./queue-board";

export default async function QueuePage() {
  if (!(await readSession())) redirect("/login");
  const res = await apiFetch("/v1/facilities?limit=100");
  const facilities: ListFacilitiesResponse = res.ok
    ? await res.json()
    : { data: [], meta: { nextCursor: null } };
  return (
    <AppShell active="Appointments">
      <QueueBoard facilities={facilities.data} date={new Date().toISOString().slice(0, 10)} />
    </AppShell>
  );
}
