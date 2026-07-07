import { describe, expect, it } from "vitest";
import { Appointment, InvalidAppointmentError } from "./appointment";

const base = {
  id: "018f0000-0000-7000-8000-000000000001",
  tenantId: "018f0000-0000-7000-8000-00000000000a",
  patientId: "018f0000-0000-7000-8000-000000000002",
  practitionerId: "018f0000-0000-7000-8000-000000000003",
  facilityId: "018f0000-0000-7000-8000-000000000004",
  startAt: new Date("2026-08-01T09:00:00Z"),
  endAt: new Date("2026-08-01T09:15:00Z"),
  appointmentType: "routine" as const,
};

describe("Appointment domain (pure state machine, TDR-0002)", () => {
  it("books with default status/version and a positive interval", () => {
    const a = Appointment.book(base);
    expect(a.props.status).toBe("booked");
    expect(a.props.version).toBe(0);
    expect(a.props.priority).toBe(0);
    expect(a.props.queueToken).toBeNull();
  });

  it("rejects a non-positive interval", () => {
    expect(() => Appointment.book({ ...base, endAt: base.startAt })).toThrow(
      InvalidAppointmentError,
    );
    expect(() => Appointment.book({ ...base, endAt: new Date("2026-08-01T08:00:00Z") })).toThrow(
      InvalidAppointmentError,
    );
  });

  it("allows only legal transitions from booked", () => {
    const a = Appointment.book(base);
    expect(() => a.assertCanTransition("checked_in")).not.toThrow();
    expect(() => a.assertCanTransition("cancelled")).not.toThrow();
    expect(() => a.assertCanTransition("no_show")).not.toThrow();
    // Cannot jump straight to in_progress or fulfilled.
    expect(() => a.assertCanTransition("in_progress")).toThrow(InvalidAppointmentError);
    expect(() => a.assertCanTransition("fulfilled")).toThrow(InvalidAppointmentError);
  });

  it("terminal states reject all transitions", () => {
    const cancelled = Appointment.fromPersistence({
      ...Appointment.book(base).props,
      status: "cancelled",
    });
    for (const target of ["checked_in", "cancelled", "no_show", "in_progress"] as const) {
      expect(() => cancelled.assertCanTransition(target)).toThrow(InvalidAppointmentError);
    }
  });

  it("is reschedulable only while booked or checked_in", () => {
    expect(() => Appointment.book(base).assertReschedulable()).not.toThrow();
    const checkedIn = Appointment.fromPersistence({
      ...Appointment.book(base).props,
      status: "checked_in",
    });
    expect(() => checkedIn.assertReschedulable()).not.toThrow();
    const noShow = Appointment.fromPersistence({
      ...Appointment.book(base).props,
      status: "no_show",
    });
    expect(() => noShow.assertReschedulable()).toThrow(InvalidAppointmentError);
  });

  it("validateChanges rejects an inverted new range", () => {
    const a = Appointment.book(base);
    expect(() =>
      a.validateChanges({
        startAt: new Date("2026-08-01T10:00:00Z"),
        endAt: new Date("2026-08-01T09:30:00Z"),
      }),
    ).toThrow(InvalidAppointmentError);
    expect(() => a.validateChanges({ startAt: new Date("2026-08-01T08:00:00Z") })).not.toThrow();
  });
});
