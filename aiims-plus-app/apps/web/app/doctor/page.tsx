import { redirect } from "next/navigation";
import { apiFetch } from "../lib/api";
import { readSession } from "../lib/session";
import { homeFor } from "../lib/roles";
import { DoctorApp } from "./doctor-app";

export const dynamic = "force-dynamic";

async function list<T>(path: string): Promise<T[]> {
  try {
    const res = await apiFetch(path);
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: T[] };
    return body.data ?? [];
  } catch {
    return [];
  }
}

export default async function DoctorPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!session.roles.includes("doctor")) redirect(homeFor(session.roles));

  const [patients, appointments, queue] = await Promise.all([
    list("/v1/patients?limit=25"),
    list("/v1/appointments"),
    list("/v1/opd/queue"),
  ]);

  return (
    <DoctorApp
      data={{
        userName: session.displayName,
        roles: session.roles,
        patients: patients as never,
        appointments: appointments as never,
        queue: queue as never,
      }}
    />
  );
}
