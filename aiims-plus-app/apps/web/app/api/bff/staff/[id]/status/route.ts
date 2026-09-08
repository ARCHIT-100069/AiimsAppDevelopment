import { type NextRequest } from "next/server";
import { apiFetch } from "../../../../../lib/api";
import { relay } from "../../../../../lib/proxy-response";

/** Deactivate/reactivate a staff login. Forwards If-Match (409 on conflict). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.text();
  return relay(
    await apiFetch(`/v1/users/${id}/status`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "if-match": req.headers.get("if-match") ?? "",
      },
      body,
    }),
  );
}
