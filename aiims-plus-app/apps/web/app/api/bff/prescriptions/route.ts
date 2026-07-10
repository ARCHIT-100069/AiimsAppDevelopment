import { type NextRequest } from "next/server";
import { apiFetch } from "../../../lib/api";
import { relay } from "../../../lib/proxy-response";

export async function GET(req: NextRequest) {
  const qs = new URL(req.url).search;
  return relay(await apiFetch(`/v1/prescriptions${qs}`));
}
export async function POST(req: NextRequest) {
  const body = await req.text();
  return relay(
    await apiFetch("/v1/prescriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
  );
}
