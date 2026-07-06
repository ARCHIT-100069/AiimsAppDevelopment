import { type NextRequest } from "next/server";
import { apiFetch } from "../../../lib/api";
import { relay } from "../../../lib/proxy-response";

/** List/search practitioners (proxied, session bearer attached server-side). */
export async function GET(req: NextRequest) {
  return relay(await apiFetch(`/v1/practitioners${new URL(req.url).search}`));
}

/** Create a practitioner; response includes non-blocking warnings[] (decision i). */
export async function POST(req: NextRequest) {
  const body = await req.text();
  return relay(
    await apiFetch("/v1/practitioners", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
  );
}
