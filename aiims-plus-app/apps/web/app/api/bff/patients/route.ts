import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiFetch } from "../../../lib/api";

/** List/search patients (proxied, session bearer attached server-side). */
export async function GET(req: NextRequest) {
  const qs = new URL(req.url).search;
  const res = await apiFetch(`/v1/patients${qs}`);
  return new NextResponse(res.body, { status: res.status, headers: passthrough(res) });
}

/** Register a patient; the BFF mints the Idempotency-Key (APDR-0006). */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const res = await apiFetch("/v1/patients", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
    body,
  });
  return new NextResponse(res.body, { status: res.status, headers: passthrough(res) });
}

function passthrough(res: Response): HeadersInit {
  const h = new Headers();
  const ct = res.headers.get("content-type");
  if (ct) h.set("content-type", ct);
  return h;
}
