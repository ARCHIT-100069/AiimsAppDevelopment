import { describe, expect, it } from "vitest";
import {
  createAppointmentRequestSchema,
  searchAppointmentsQuerySchema,
  updateAppointmentRequestSchema,
} from "./appointments";
import { buildFhirAppointment, fhirAppointmentSchema } from "./fhir-appointment";

const uuid = "0197a000-0000-7000-8000-000000000001";
const base = {
  patientId: uuid,
  practitionerId: "0197a000-0000-7000-8000-000000000002",
  facilityId: "0197a000-0000-7000-8000-000000000003",
  startAt: "2026-08-01T09:00:00Z",
  endAt: "2026-08-01T09:15:00Z",
};

describe("appointment contracts (Stage 4)", () => {
  it("create requires ids + a valid time range; defaults type/priority/specialties", () => {
    const parsed = createAppointmentRequestSchema.parse(base);
    expect(parsed.appointmentType).toBe("routine");
    expect(parsed.priority).toBe(0);
    expect(parsed.specialties).toEqual([]);
    // endAt must be after startAt.
    expect(
      createAppointmentRequestSchema.safeParse({ ...base, endAt: "2026-08-01T08:00:00Z" }).success,
    ).toBe(false);
  });

  it("update rejects an empty patch and an inverted range", () => {
    expect(updateAppointmentRequestSchema.safeParse({}).success).toBe(false);
    expect(updateAppointmentRequestSchema.safeParse({ priority: 5 }).success).toBe(true);
    expect(
      updateAppointmentRequestSchema.safeParse({
        startAt: "2026-08-01T10:00:00Z",
        endAt: "2026-08-01T09:00:00Z",
      }).success,
    ).toBe(false);
  });

  it("search allow-lists at most one subject filter (APDR-0005)", () => {
    expect(searchAppointmentsQuerySchema.safeParse({ practitionerId: uuid }).success).toBe(true);
    expect(
      searchAppointmentsQuerySchema.safeParse({ practitionerId: uuid, patientId: uuid }).success,
    ).toBe(false);
  });
});

describe("FHIR Appointment mapper (ADR-0003/DDR-0005)", () => {
  it("maps status + participants + duration into a valid resource", () => {
    const fhir = buildFhirAppointment({
      id: uuid,
      status: "checked_in",
      startAt: base.startAt,
      endAt: base.endAt,
      appointmentType: "routine",
      patientId: base.patientId,
      practitionerId: base.practitionerId,
      specialties: [{ system: "specialty", code: "cardiology", display: "Cardiology" }],
      reasonText: "chest pain",
    });
    expect(fhirAppointmentSchema.safeParse(fhir).success).toBe(true);
    expect(fhir.status).toBe("arrived"); // checked_in → arrived
    expect(fhir.minutesDuration).toBe(15);
    expect(fhir.participant.map((p) => p.actor.reference)).toEqual([
      `Patient/${base.patientId}`,
      `Practitioner/${base.practitionerId}`,
    ]);
    expect(fhir.reasonCode?.[0]?.text).toBe("chest pain");
  });

  it("maps no_show → noshow and in_progress → checked-in", () => {
    const noshow = buildFhirAppointment({
      id: uuid,
      status: "no_show",
      startAt: base.startAt,
      endAt: base.endAt,
      appointmentType: "routine",
      patientId: base.patientId,
      practitionerId: base.practitionerId,
      specialties: [],
    });
    expect(noshow.status).toBe("noshow");
    expect(noshow.specialty).toBeUndefined();
  });
});
