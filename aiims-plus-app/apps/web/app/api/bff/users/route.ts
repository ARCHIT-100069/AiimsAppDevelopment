import { type NextRequest } from "next/server";
import { apiFetch } from "../../../lib/api";
import { relay } from "../../../lib/proxy-response";

/** Read-only proxy: tenant users (for the practitioner "link to user" picker). */
export async function GET(req: NextRequest) {
  return relay(await apiFetch(`/v1/users${new URL(req.url).search}`));
}
