import { type NextRequest } from "next/server";
import { apiFetch } from "../../../../lib/api";
import { relay } from "../../../../lib/proxy-response";

/**
 * Allow-listed EMR proxy (FEDR-0006). Fans the many encounter sub-routes
 * (notes/observations/conditions/orders/results/sign/attachments) to /v1/*
 * without a file per path. Only these top-level resources are proxied; the
 * bearer is attached server-side and If-Match / Idempotency-Key are forwarded.
 */
const ALLOWED = new Set(["encounters", "notes", "orders", "attachments"]);

function target(path: string[], search: string): string | null {
  if (path.length === 0 || !ALLOWED.has(path[0]!)) return null;
  return `/v1/${path.map(encodeURIComponent).join("/")}${search}`;
}

function fwd(req: NextRequest): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  const ifMatch = req.headers.get("if-match");
  const idem = req.headers.get("idempotency-key");
  if (ifMatch) h["if-match"] = ifMatch;
  if (idem) h["idempotency-key"] = idem;
  return h;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = target(path, new URL(req.url).search);
  if (!url) return new Response(null, { status: 404 });
  return relay(await apiFetch(url));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = target(path, "");
  if (!url) return new Response(null, { status: 404 });
  const body = await req.text();
  return relay(await apiFetch(url, { method: "POST", headers: fwd(req), body: body || "{}" }));
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = target(path, "");
  if (!url) return new Response(null, { status: 404 });
  const body = await req.text();
  return relay(await apiFetch(url, { method: "PATCH", headers: fwd(req), body }));
}
