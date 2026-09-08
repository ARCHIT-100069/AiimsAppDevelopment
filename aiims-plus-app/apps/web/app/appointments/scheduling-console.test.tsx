import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AppointmentResponse,
  FacilityResponse,
  PatientResponse,
  PractitionerResponse,
} from "@aiims/api-contracts";
import { SchedulingConsole } from "./scheduling-console";

const patients = [
  {
    id: "0197a000-0000-7000-8000-000000000001",
    nameGiven: "Asha",
    nameFamily: "Rao",
    mrn: "MRN-000001",
  },
] as unknown as PatientResponse[];
const practitioners = [
  {
    id: "0197a000-0000-7000-8000-000000000002",
    nameGiven: "Dr",
    nameFamily: "Bose",
    registrationNo: "MCI-1",
  },
] as unknown as PractitionerResponse[];
const facilities = [
  { id: "0197a000-0000-7000-8000-000000000003", name: "Main OPD" },
] as unknown as FacilityResponse[];
const appts = [
  {
    id: "0197a000-0000-7000-8000-000000000004",
    patientId: patients[0]!.id,
    practitionerId: practitioners[0]!.id,
    facilityId: facilities[0]!.id,
    departmentId: null,
    startAt: "2026-08-01T09:00:00.000Z",
    endAt: "2026-08-01T09:15:00.000Z",
    status: "booked",
    appointmentType: "routine",
    specialties: [],
    reasonText: null,
    priority: 0,
    version: 0,
    createdAt: "2026-08-01T08:00:00.000Z",
  },
] as unknown as AppointmentResponse[];

describe("SchedulingConsole (a11y)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: [], slots: [], entries: [] }),
      })) as unknown as typeof fetch,
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("book form controls are labelled and the console has no axe violations", async () => {
    const { container } = render(
      <SchedulingConsole
        date="2026-08-01"
        initialAppointments={appts}
        practitioners={practitioners}
        bookablePractitioners={practitioners}
        facilities={facilities}
        patients={patients}
        canManage
      />,
    );
    expect(screen.getByLabelText("Patient")).toBeInTheDocument();
    expect(screen.getByLabelText("Practitioner")).toBeInTheDocument();
    expect(screen.getByLabelText("Facility")).toBeInTheDocument();
    expect(screen.getByLabelText("Available slot")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /book/i })).toBeInTheDocument();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
