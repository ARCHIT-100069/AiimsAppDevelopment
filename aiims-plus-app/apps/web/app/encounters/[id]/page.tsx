import { notFound, redirect } from "next/navigation";
import type {
  EncounterResponse,
  ListConditionsResponse,
  ListNotesResponse,
  ListObservationsResponse,
  ListOrdersResponse,
  ListResultsResponse,
} from "@aiims/api-contracts";
import { apiFetch } from "../../lib/api";
import { readSession } from "../../lib/session";
import { AppShell, canDocumentEncounter, canSignEncounter } from "../../patients/shell";
import { EncounterWorkspace } from "./encounter-workspace";

export default async function EncounterPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await readSession())) redirect("/login");
  const { id } = await params;

  const encRes = await apiFetch(`/v1/encounters/${id}`);
  if (!encRes.ok) notFound();
  const encounter: EncounterResponse = await encRes.json();

  const [notes, observations, conditions, orders, results] = await Promise.all([
    apiFetch(`/v1/encounters/${id}/notes`).then(okJson<ListNotesResponse>({ data: [] })),
    apiFetch(`/v1/encounters/${id}/observations`).then(
      okJson<ListObservationsResponse>({ data: [] }),
    ),
    apiFetch(`/v1/encounters/${id}/conditions`).then(okJson<ListConditionsResponse>({ data: [] })),
    apiFetch(`/v1/encounters/${id}/orders`).then(okJson<ListOrdersResponse>({ data: [] })),
    apiFetch(`/v1/encounters/${id}/results`).then(okJson<ListResultsResponse>({ data: [] })),
  ]);

  return (
    <AppShell active="Appointments">
      <EncounterWorkspace
        encounter={encounter}
        initialNotes={notes.data}
        initialObservations={observations.data}
        initialConditions={conditions.data}
        initialOrders={orders.data}
        initialResults={results.data}
        canDocument={await canDocumentEncounter()}
        canSign={await canSignEncounter()}
      />
    </AppShell>
  );
}

function okJson<T>(fallback: T): (res: Response) => Promise<T> {
  return async (res) => (res.ok ? ((await res.json()) as T) : fallback);
}
