import { apiFetch } from "../../../lib/api";
import { relay } from "../../../lib/proxy-response";

/** Read-only proxy: the specialty reference code system (practitioner form). */
export async function GET() {
  return relay(await apiFetch("/v1/reference/codes?system=specialty&limit=100"));
}
