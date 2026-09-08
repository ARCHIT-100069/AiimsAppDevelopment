import { notFound, redirect } from "next/navigation";
import type { PractitionerResponse } from "@aiims/api-contracts";
import { IconChevronLeft } from "@aiims/ui-web";
import { apiFetch } from "../../lib/api";
import { readSession } from "../../lib/session";
import { AppShell } from "../../patients/shell";
import { PractitionerDetail } from "./practitioner-detail";

export default async function PractitionerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ warning?: string }>;
}) {
  const session = await readSession();
  if (!session) redirect("/login");
  if (session.roles.includes("patient")) redirect("/portal");
  const { id } = await params;
  const { warning } = await searchParams;
  const res = await apiFetch(`/v1/practitioners/${id}`);
  if (res.status === 404) notFound();
  if (!res.ok) redirect("/practitioners");
  const practitioner: PractitionerResponse = await res.json();
  return (
    <AppShell active="Practitioners">
      <a
        href="/practitioners"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700"
      >
        <IconChevronLeft width={16} height={16} /> Back to practitioners
      </a>
      <PractitionerDetail
        practitioner={practitioner}
        roleWarning={warning === "LINKED_USER_NOT_CLINICAL"}
      />
    </AppShell>
  );
}
