import { apiFetch } from "../../../../lib/api";
import { relay } from "../../../../lib/proxy-response";

/** Leadership analytics rollup (OPD, revenue, lab, pharmacy, satisfaction). */
export async function GET() {
  return relay(await apiFetch("/v1/management/overview"));
}
