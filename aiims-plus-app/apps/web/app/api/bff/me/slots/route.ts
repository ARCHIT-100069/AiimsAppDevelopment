import { type NextRequest } from "next/server";
import { apiFetch } from "../../../../lib/api";
import { relay } from "../../../../lib/proxy-response";

/** Patient-facing available slots for a practitioner on a date. */
export async function GET(req: NextRequest) {
  const qs = new URL(req.url).search;
  return relay(await apiFetch(`/v1/me/slots${qs}`));
}
