import { notFound, redirect } from "next/navigation";
import type { PatientResponse } from "@aiims/api-contracts";
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
      <a href="/patients" className="text-sm text-sky-800 hover:underline">
        ← Back to patients
      </a>
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6">
        <PatientDetail patient={patient} />
      </div>
    </AppShell>
  );
}
