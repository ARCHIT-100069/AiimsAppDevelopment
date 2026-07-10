import { type NextRequest } from "next/server";
import { apiFetch } from "../../../../../lib/api";
import { relay } from "../../../../../lib/proxy-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.text();
  return relay(
    await apiFetch(`/v1/drugs/${id}/stock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
  );
}
