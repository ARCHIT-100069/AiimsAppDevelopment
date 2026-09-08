import { redirect } from "next/navigation";
import type {
  ListAppointmentsResponse,
  ListFacilitiesResponse,
  ListPatientsResponse,
  ListPractitionersResponse,
} from "@aiims/api-contracts";
import { apiFetch } from "../lib/api";
import { istDayWindow, todayIST } from "../lib/date";
import { readSession } from "../lib/session";
import { AppShell, canManageAppointments } from "../patients/shell";
import { SchedulingConsole } from "./scheduling-console";

function todayWindow(): { date: string; from: string; to: string } {
  const date = todayIST();
  return { date, ...istDayWindow(date) };
}

export default async function AppointmentsPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (session.roles.includes("patient")) redirect("/portal");
  const { date, from, to } = todayWindow();

  const [apptRes, practRes, bookableRes, facRes, patRes] = await Promise.all([
    apiFetch(`/v1/appointments?from=${from}&to=${to}&limit=100`),
    apiFetch("/v1/practitioners?limit=100"),
    // Booking must only offer doctors — a practitioner profile alone isn't
    // enough (nurses and even front-desk staff get one too).
    apiFetch("/v1/practitioners?role=doctor&limit=100"),
    apiFetch("/v1/facilities?limit=100"),
    apiFetch("/v1/patients?limit=100"),
  ]);

  const appts: ListAppointmentsResponse = aptOk(apptRes) ? await apptRes.json() : empty();
  const practitioners: ListPractitionersResponse = practRes.ok
    ? await practRes.json()
    : { data: [], meta: { nextCursor: null } };
  const bookablePractitioners: ListPractitionersResponse = bookableRes.ok
    ? await bookableRes.json()
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
        bookablePractitioners={bookablePractitioners.data}
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
