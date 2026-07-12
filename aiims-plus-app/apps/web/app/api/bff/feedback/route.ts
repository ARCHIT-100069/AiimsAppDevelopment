import { apiFetch } from "../../../lib/api";
import { relay } from "../../../lib/proxy-response";

/** Staff/quality read of patient-satisfaction feedback for the tenant. */
export async function GET() {
  return relay(await apiFetch("/v1/feedback"));
}
