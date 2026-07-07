import { redirect } from "next/navigation";
import type {
  ListAppointmentsResponse,
  ListFacilitiesResponse,
  ListPatientsResponse,
  ListPractitionersResponse,
} from "@aiims/api-contracts";
import { apiFetch } from "../lib/api";
import { readSession } from "../lib/session";
import { AppShell, canManageAppointments } from "../patients/shell";
import { SchedulingConsole } from "./scheduling-console";

/** Today's UTC window (DB §4 stores UTC; MVP treats the calendar day as UTC). */
function todayWindow(): { date: string; from: string; to: string } {
  const date = new Date().toISOString().slice(0, 10);
  return { date, from: `${date}T00:00:00.000Z`, to: `${date}T23:59:59.999Z` };
}

export default async function AppointmentsPage() {
  if (!(await readSession())) redirect("/login");
  const { date, from, to } = todayWindow();

  const [apptRes, practRes, facRes, patRes] = await Promise.all([
    apiFetch(`/v1/appointments?from=${from}&to=${to}&limit=100`),
    apiFetch("/v1/practitioners?limit=100"),
    apiFetch("/v1/facilities?limit=100"),
    apiFetch("/v1/patients?limit=100"),
  ]);

  const appts: ListAppointmentsResponse = aptOk(apptRes) ? await apptRes.json() : empty();
  const practitioners: ListPractitionersResponse = practRes.ok
    ? await practRes.json()
    : { data: [], meta: { nextCursor: null } };
  const facilities: ListFacilitiesResponse = facRes.ok
    ? await facRes.json()
    : { data: [], meta: { nextCursor: null } };
  const patients: ListPatientsResponse = patRes.ok
    ? await patRes.json()
    : { data: [], meta: { nextCursor: null } };

  return (
    <AppShell active="Appointments">
      <SchedulingConsole
        date={date}
        initialAppointments={appts.data}
        practitioners={practitioners.data}
        facilities={facilities.data}
        patients={patients.data}
        canManage={await canManageAppointments()}
      />
    </AppShell>
  );
}

function aptOk(res: Response): boolean {
  return res.ok;
}
function empty(): ListAppointmentsResponse {
  return { data: [], meta: { nextCursor: null } };
}
