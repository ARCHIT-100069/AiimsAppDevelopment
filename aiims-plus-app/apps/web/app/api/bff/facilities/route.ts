import { type NextRequest } from "next/server";
import { apiFetch } from "../../../lib/api";
import { relay } from "../../../lib/proxy-response";

/** List facilities (for the scheduling facility picker). */
export async function GET(req: NextRequest) {
  return relay(await apiFetch(`/v1/facilities${new URL(req.url).search}`));
}
