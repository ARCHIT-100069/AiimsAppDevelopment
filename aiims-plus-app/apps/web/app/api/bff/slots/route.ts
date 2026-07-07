import { type NextRequest } from "next/server";
import { apiFetch } from "../../../lib/api";
import { relay } from "../../../lib/proxy-response";

/** Computed free slots: maps ?practitionerId=&date= → /v1/practitioners/{id}/slots. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const practitionerId = url.searchParams.get("practitionerId") ?? "";
  const date = url.searchParams.get("date") ?? "";
  return relay(
    await apiFetch(`/v1/practitioners/${practitionerId}/slots?date=${encodeURIComponent(date)}`),
  );
}
