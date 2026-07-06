import { type NextRequest } from "next/server";
import { apiFetch } from "../../../../lib/api";
import { relay } from "../../../../lib/proxy-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return relay(await apiFetch(`/v1/practitioners/${id}`));
}

/** Update; forwards If-Match for optimistic concurrency (409). No appUserId. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.text();
  return relay(
    await apiFetch(`/v1/practitioners/${id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "if-match": req.headers.get("if-match") ?? "",
      },
      body,
    }),
  );
}
