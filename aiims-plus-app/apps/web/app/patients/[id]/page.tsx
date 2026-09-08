import { notFound, redirect } from "next/navigation";
import type { MySummaryResponse, PatientResponse } from "@aiims/api-contracts";
import { IconChevronLeft } from "@aiims/ui-web";
import { apiFetch } from "../../lib/api";
import { readSession } from "../../lib/session";
import { AppShell } from "../shell";
import { PatientDetail } from "./patient-detail";

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) redirect("/login");
  if (session.roles.includes("patient")) redirect("/portal");
  const { id } = await params;
  const [res, chartRes] = await Promise.all([
    apiFetch(`/v1/patients/${id}`),
    apiFetch(`/v1/patients/${id}/chart`),
  ]);
  if (res.status === 404) notFound();
  if (!res.ok) redirect("/patients");
  const patient: PatientResponse = await res.json();
  const chart: MySummaryResponse | null = chartRes.ok ? await chartRes.json() : null;
  return (
    <AppShell active="Patients">
      <a
        href="/patients"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700"
      >
        <IconChevronLeft width={16} height={16} /> Back to patients
      </a>
      <PatientDetail patient={patient} chart={chart} />
    </AppShell>
  );
}
