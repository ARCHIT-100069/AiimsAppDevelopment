import { redirect } from "next/navigation";
import type { ListPatientsResponse } from "@aiims/api-contracts";
import { apiFetch } from "../lib/api";
import { readSession } from "../lib/session";
import { AppShell, canRegisterPatients } from "./shell";
import { PatientList } from "./patient-list";

export default async function PatientsPage() {
  if (!(await readSession())) redirect("/login");
  const res = await apiFetch("/v1/patients?limit=50");
  const body: ListPatientsResponse = res.ok
    ? await res.json()
    : { data: [], meta: { nextCursor: null } };
  return (
    <AppShell>
      <PatientList initial={body.data} canCreate={await canRegisterPatients()} />
    </AppShell>
  );
}
