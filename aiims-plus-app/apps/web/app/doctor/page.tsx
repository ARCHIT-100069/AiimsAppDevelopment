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

interface PractitionerLike {
  nameGiven: string;
  nameFamily: string;
  registrationNo: string;
  specialties: { display: string }[];
  status: "active" | "inactive";
  createdAt: string;
}

/** Best-effort match of the logged-in doctor to their clinical profile — the
 *  registration number and specialty printed on their ID badge. There is no
 *  "my practitioner record" endpoint, so this matches by display name against
 *  the tenant's practitioner directory (practitioner names default to the
 *  linked login's display name unless overridden). Missing gracefully. */
async function fetchDoctorProfile(displayName: string): Promise<PractitionerLike | null> {
  const practitioners = await list<PractitionerLike>("/v1/practitioners?limit=100");
  const norm = (s: string) => s.trim().toLowerCase();
  return (
    practitioners.find((p) => norm(`${p.nameGiven} ${p.nameFamily}`) === norm(displayName)) ?? null
  );
}

/** OPD queue is facility-scoped and returns { entries }. Resolve a facility first. */
async function fetchQueue(): Promise<unknown[]> {
  const orgs = await list<{ id: string }>("/v1/organizations");
  let facilityId: string | null = null;
  for (const o of orgs) {
    const facs = await list<{ id: string }>(`/v1/facilities?organizationId=${o.id}`);
    if (facs[0]) {
      facilityId = facs[0].id;
      break;
    }
  }
  if (!facilityId) return [];
  try {
    const res = await apiFetch(`/v1/opd/queue?facilityId=${facilityId}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { entries?: unknown[] };
    return body.entries ?? [];
  } catch {
    return [];
  }
}

export default async function DoctorPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!session.roles.includes("doctor")) redirect(homeFor(session.roles));

  const [patients, appointments, queue, profile] = await Promise.all([
    list("/v1/patients?limit=25"),
    list("/v1/appointments"),
    fetchQueue(),
    fetchDoctorProfile(session.displayName),
  ]);

  return (
    <DoctorApp
      data={{
        userName: session.displayName,
        roles: session.roles,
        patients: patients as never,
        appointments: appointments as never,
        queue: queue as never,
        profile: profile
          ? {
              registrationNo: profile.registrationNo,
              specialty: profile.specialties[0]?.display ?? null,
              status: profile.status,
              since: profile.createdAt,
            }
          : null,
      }}
    />
  );
}
