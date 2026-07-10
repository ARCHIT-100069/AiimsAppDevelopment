import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { apiFetch } from "../../../lib/api";
import { relay } from "../../../lib/proxy-response";

export async function GET() {
  return relay(await apiFetch("/v1/drugs"));
}
export async function POST(req: NextRequest) {
  const body = await req.text();
  return relay(
    await apiFetch("/v1/drugs", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
      body,
    }),
  );
}
