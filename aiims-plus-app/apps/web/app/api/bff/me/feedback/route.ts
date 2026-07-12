import { type NextRequest } from "next/server";
import { apiFetch } from "../../../../lib/api";
import { relay } from "../../../../lib/proxy-response";

/** Patient submits satisfaction feedback about their own care. */
export async function POST(req: NextRequest) {
  const body = await req.text();
  return relay(
    await apiFetch("/v1/me/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
  );
}
