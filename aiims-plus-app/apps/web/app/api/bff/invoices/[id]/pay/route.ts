import { type NextRequest } from "next/server";
import { apiFetch } from "../../../../../lib/api";
import { relay } from "../../../../../lib/proxy-response";

/** Settle an invoice at the billing desk. Server mints the Idempotency-Key. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.text();
  return relay(
    await apiFetch(`/v1/invoices/${id}/pay`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": `pay-${id}-${crypto.randomUUID()}`,
      },
      body: body || "{}",
    }),
  );
}
