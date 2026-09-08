import { redirect } from "next/navigation";
import { apiFetch } from "../lib/api";
import { readSession } from "../lib/session";
import { homeFor } from "../lib/roles";
import { AdminApp } from "./admin-app";

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

export default async function AdminPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!session.roles.includes("admin")) redirect(homeFor(session.roles));

  const [organizations, staff, practitioners, appointments, overviewRes] = await Promise.all([
    list("/v1/organizations"),
    list("/v1/users"),
    list("/v1/practitioners"),
    list("/v1/appointments"),
    apiFetch("/v1/management/overview"),
  ]);
  const overview = overviewRes.ok ? await overviewRes.json() : null;

  return (
    <AdminApp
      data={{
        userName: session.displayName,
        roles: session.roles,
        organizations: organizations as never,
        staff: staff as never,
        practitioners: practitioners as never,
        appointments: appointments as never,
        overview,
      }}
    />
  );
}
