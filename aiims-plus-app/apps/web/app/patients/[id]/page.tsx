import { notFound, redirect } from "next/navigation";
import type { PatientResponse } from "@aiims/api-contracts";
import { IconChevronLeft } from "@aiims/ui-web";
import { apiFetch } from "../../lib/api";
import { readSession } from "../../lib/session";
import { AppShell } from "../shell";
import { PatientDetail } from "./patient-detail";

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await readSession())) redirect("/login");
  const { id } = await params;
  const res = await apiFetch(`/v1/patients/${id}`);
  if (res.status === 404) notFound();
  if (!res.ok) redirect("/patients");
  const patient: PatientResponse = await res.json();
  return (
    <AppShell>
      <a
        href="/patients"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700"
      >
        <IconChevronLeft width={16} height={16} /> Back to patients
      </a>
      <PatientDetail patient={patient} />
    </AppShell>
  );
}
