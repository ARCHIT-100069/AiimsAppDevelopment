import { apiFetch } from "../../../../lib/api";
import { relay } from "../../../../lib/proxy-response";

/** Resolve the first facility this staff member can see (single-campus MVP). */
async function firstFacilityId(): Promise<string | null> {
  const orgsRes = await apiFetch("/v1/organizations");
  if (!orgsRes.ok) return null;
  const orgs = (await orgsRes.json()).data ?? [];
  for (const o of orgs as { id: string }[]) {
    const facRes = await apiFetch(`/v1/facilities?organizationId=${o.id}`);
    if (!facRes.ok) continue;
    const facs = (await facRes.json()).data ?? [];
    if (facs.length) return (facs[0] as { id: string }).id;
  }
  return null;
}

/** Facility-wide lab worklist. Facility is resolved server-side. */
export async function GET() {
  const facilityId = await firstFacilityId();
  if (!facilityId) return Response.json({ data: [] });
  return relay(await apiFetch(`/v1/lab/worklist?facilityId=${facilityId}`));
}
