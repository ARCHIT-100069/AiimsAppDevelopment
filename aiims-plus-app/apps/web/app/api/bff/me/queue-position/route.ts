import { apiFetch } from "../../../../lib/api";
import { relay } from "../../../../lib/proxy-response";

/** Patient's live OPD token / queue position for today. */
export async function GET() {
  return relay(await apiFetch("/v1/me/queue-position"));
}
