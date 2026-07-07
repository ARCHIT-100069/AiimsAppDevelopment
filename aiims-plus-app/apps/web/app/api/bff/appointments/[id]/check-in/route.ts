import { type NextRequest } from "next/server";
import { apiFetch } from "../../../../../lib/api";
import { relay } from "../../../../../lib/proxy-response";

/** Check in an arrived patient; forwards Idempotency-Key (opens an encounter). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers: Record<string, string> = {};
  const idem = req.headers.get("idempotency-key");
  if (idem) headers["idempotency-key"] = idem;
  return relay(await apiFetch(`/v1/appointments/${id}/check-in`, { method: "POST", headers }));
}
