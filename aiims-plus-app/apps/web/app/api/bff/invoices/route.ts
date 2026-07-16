import { type NextRequest } from "next/server";
import { apiFetch } from "../../../lib/api";
import { relay } from "../../../lib/proxy-response";

/** Billing desk — list tenant invoices (optionally ?status=issued|paid). */
export async function GET(req: NextRequest) {
  return relay(await apiFetch(`/v1/invoices${new URL(req.url).search}`));
}
