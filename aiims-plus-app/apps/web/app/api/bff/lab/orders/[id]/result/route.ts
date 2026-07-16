import { type NextRequest } from "next/server";
import { apiFetch } from "../../../../../../lib/api";
import { relay } from "../../../../../../lib/proxy-response";

/** File a lab result (conclusion + structured analyte lines) against an order. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.text();
  return relay(
    await apiFetch(`/v1/lab/orders/${id}/result`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
  );
}
