import { type NextRequest } from "next/server";
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

/** Facility-wide diagnostics worklist. Facility is resolved server-side;
 *  ?category=lab|imaging picks the department (defaults to lab). */
export async function GET(req: NextRequest) {
  const facilityId = await firstFacilityId();
  if (!facilityId) return Response.json({ data: [] });
  const category = new URL(req.url).searchParams.get("category") ?? "lab";
  return relay(await apiFetch(`/v1/lab/worklist?facilityId=${facilityId}&category=${category}`));
}
