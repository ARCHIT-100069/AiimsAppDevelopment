import { notFound, redirect } from "next/navigation";
import type {
  EncounterResponse,
  InvoiceResponse,
  ListConditionsResponse,
  ListNotesResponse,
  ListObservationsResponse,
  ListOrdersResponse,
  ListResultsResponse,
  PractitionerResponse,
} from "@aiims/api-contracts";
import { apiFetch } from "../../lib/api";
import { readSession } from "../../lib/session";
import {
  AppShell,
  canBillEncounter,
  canDocumentEncounter,
  canReviewResult,
  canShareEncounter,
  canSignEncounter,
} from "../../patients/shell";
import { EncounterWorkspace } from "./encounter-workspace";

export default async function EncounterPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) redirect("/login");
  if (session.roles.includes("patient")) redirect("/portal");
  const { id } = await params;

  const encRes = await apiFetch(`/v1/encounters/${id}`);
  if (!encRes.ok) notFound();
  const encounter: EncounterResponse = await encRes.json();

  const [notes, observations, conditions, orders, results, invoiceRes, attendingRes] =
    await Promise.all([
      apiFetch(`/v1/encounters/${id}/notes`).then(okJson<ListNotesResponse>({ data: [] })),
      apiFetch(`/v1/encounters/${id}/observations`).then(
        okJson<ListObservationsResponse>({ data: [] }),
      ),
      apiFetch(`/v1/encounters/${id}/conditions`).then(
        okJson<ListConditionsResponse>({ data: [] }),
      ),
      apiFetch(`/v1/encounters/${id}/orders`).then(okJson<ListOrdersResponse>({ data: [] })),
      apiFetch(`/v1/encounters/${id}/results`).then(okJson<ListResultsResponse>({ data: [] })),
      apiFetch(`/v1/encounters/${id}/invoice`),
      // Whose patient this is — any doctor/nurse can open the encounter (a
      // shared OPD queue), but the chart should always say who's attending.
      apiFetch(`/v1/practitioners/${encounter.practitionerId}`),
    ]);
  const invoice: InvoiceResponse | null = invoiceRes.ok ? await invoiceRes.json() : null;
  const attending: PractitionerResponse | null = attendingRes.ok ? await attendingRes.json() : null;

  return (
    <AppShell active="Appointments">
      <EncounterWorkspace
        encounter={encounter}
        attendingName={attending ? `${attending.nameGiven} ${attending.nameFamily}` : null}
        initialNotes={notes.data}
        initialObservations={observations.data}
        initialConditions={conditions.data}
        initialOrders={orders.data}
        initialResults={results.data}
        initialInvoice={invoice}
        canDocument={await canDocumentEncounter()}
        canSign={await canSignEncounter()}
        canBill={await canBillEncounter()}
        canShare={await canShareEncounter()}
        canReview={await canReviewResult()}
      />
    </AppShell>
  );
}

function okJson<T>(fallback: T): (res: Response) => Promise<T> {
  return async (res) => (res.ok ? ((await res.json()) as T) : fallback);
}
