import { type NextRequest } from "next/server";
import { apiFetch } from "../../../../lib/api";
import { relay } from "../../../../lib/proxy-response";

/** Patient self-service booking — proxied with the session bearer attached. */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const res = await apiFetch("/v1/me/appointments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  return relay(res);
}
