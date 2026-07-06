import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { apiFetch } from "../../../lib/api";
import { relay } from "../../../lib/proxy-response";

/** List/search patients (proxied, session bearer attached server-side). */
export async function GET(req: NextRequest) {
  const qs = new URL(req.url).search;
  return relay(await apiFetch(`/v1/patients${qs}`));
}

/** Register a patient; the BFF mints the Idempotency-Key (APDR-0006). */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const res = await apiFetch("/v1/patients", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
    body,
  });
  return relay(res);
}
