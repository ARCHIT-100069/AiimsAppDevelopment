import { type NextRequest } from "next/server";
import { apiFetch } from "../../../lib/api";
import { relay } from "../../../lib/proxy-response";

/** List/search appointments (proxied, session bearer attached server-side). */
export async function GET(req: NextRequest) {
  return relay(await apiFetch(`/v1/appointments${new URL(req.url).search}`));
}

/** Book an appointment; forwards the Idempotency-Key (APDR-0006). */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const headers: Record<string, string> = { "content-type": "application/json" };
  const idem = req.headers.get("idempotency-key");
  if (idem) headers["idempotency-key"] = idem;
  return relay(await apiFetch("/v1/appointments", { method: "POST", headers, body }));
}
