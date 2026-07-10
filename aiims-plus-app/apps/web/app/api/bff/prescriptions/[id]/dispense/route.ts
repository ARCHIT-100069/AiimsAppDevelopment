import { type NextRequest } from "next/server";
import { apiFetch } from "../../../../../lib/api";
import { relay } from "../../../../../lib/proxy-response";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return relay(await apiFetch(`/v1/prescriptions/${id}/dispense`, { method: "POST" }));
}
