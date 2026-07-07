import { type NextRequest } from "next/server";
import { apiFetch } from "../../../lib/api";
import { relay } from "../../../lib/proxy-response";

/** The live OPD waiting queue for a facility/day. */
export async function GET(req: NextRequest) {
  return relay(await apiFetch(`/v1/opd/queue${new URL(req.url).search}`));
}
