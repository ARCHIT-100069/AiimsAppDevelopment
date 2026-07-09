import { redirect } from "next/navigation";
import type { BookableOptionsResponse, MySummaryResponse } from "@aiims/api-contracts";
import { apiFetch } from "../lib/api";
import { readSession } from "../lib/session";
import { PortalApp } from "./portal-app";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const res = await apiFetch("/v1/me/summary");
  if (!res.ok) {
    if (res.status === 403) redirect("/patients"); // staff token -> their app
    redirect("/login");
  }
  const me: MySummaryResponse = await res.json();

  const pracRes = await apiFetch("/v1/me/practitioners");
  const { practitioners }: BookableOptionsResponse = pracRes.ok
    ? await pracRes.json()
    : { practitioners: [] };

  return <PortalApp me={me} practitioners={practitioners} />;
}
