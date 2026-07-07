import { type NextRequest } from "next/server";
import { apiFetch } from "../../../../../lib/api";
import { relay } from "../../../../../lib/proxy-response";

/** Mark no-show; forwards If-Match (optimistic concurrency). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return relay(
    await apiFetch(`/v1/appointments/${id}/no-show`, {
      method: "POST",
      headers: { "if-match": req.headers.get("if-match") ?? "" },
    }),
  );
}
