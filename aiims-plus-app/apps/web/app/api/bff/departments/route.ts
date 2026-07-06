import { type NextRequest } from "next/server";
import { apiFetch } from "../../../lib/api";
import { relay } from "../../../lib/proxy-response";

/** Read-only proxy: departments (for the practitioner department picker). */
export async function GET(req: NextRequest) {
  return relay(await apiFetch(`/v1/departments${new URL(req.url).search}`));
}
