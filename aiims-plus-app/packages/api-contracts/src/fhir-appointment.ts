/**
 * FHIR R4 Appointment contract + pure mapper (ADR-0003/DDR-0005). Regenerated
 * from the relational model on demand; the HTTP read endpoint is feature-
 * flagged OFF by default (dark behind `fhir.read`, matching Patient/Practitioner).
 */
import { z } from "zod";
import type { AppointmentStatus } from "./appointments";
import type { SpecialtyCoding } from "./practitioners";

/** Internal status → FHIR Appointment.status value set. */
const FHIR_STATUS: Record<AppointmentStatus, string> = {
  booked: "booked",
  checked_in: "arrived",
  in_progress: "checked-in",
  fulfilled: "fulfilled",
  cancelled: "cancelled",
  no_show: "noshow",
};

export const fhirAppointmentSchema = z.object({
  resourceType: z.literal("Appointment"),
  id: z.string(),
  status: z.string(),
  start: z.string(),
  end: z.string(),
  minutesDuration: z.number().int().optional(),
  specialty: z
    .array(
      z.object({
        coding: z.array(z.object({ system: z.string(), code: z.string(), display: z.string() })),
      }),
    )
    .optional(),
  appointmentType: z.object({ coding: z.array(z.object({ code: z.string() })) }).optional(),
  reasonCode: z.array(z.object({ text: z.string() })).optional(),
  participant: z.array(
    z.object({
      actor: z.object({ reference: z.string() }),
      required: z.string(),
      status: z.string(),
    }),
  ),
  extension: z.array(z.record(z.string(), z.unknown())).optional(),
});
export type FhirAppointment = z.infer<typeof fhirAppointmentSchema>;

export interface FhirAppointmentInput {
  id: string;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  appointmentType: string;
  patientId: string;
  practitionerId: string;
  specialties: SpecialtyCoding[];
  reasonText?: string | null;
  fhirExtensions?: Record<string, unknown> | null;
}

export function buildFhirAppointment(input: FhirAppointmentInput): FhirAppointment {
  const minutes = Math.round(
    (new Date(input.endAt).getTime() - new Date(input.startAt).getTime()) / 60000,
  );
  const extensions = Object.entries(input.fhirExtensions ?? {}).map(([url, value]) => ({
    url,
    ...(typeof value === "object" && value !== null ? value : { valueString: String(value) }),
  }));
  return fhirAppointmentSchema.parse({
    resourceType: "Appointment",
    id: input.id,
    status: FHIR_STATUS[input.status],
    start: input.startAt,
    end: input.endAt,
    ...(minutes > 0 ? { minutesDuration: minutes } : {}),
    ...(input.specialties.length ? { specialty: [{ coding: input.specialties }] } : {}),
    appointmentType: { coding: [{ code: input.appointmentType }] },
    ...(input.reasonText ? { reasonCode: [{ text: input.reasonText }] } : {}),
    participant: [
      {
        actor: { reference: `Patient/${input.patientId}` },
        required: "required",
        status: "accepted",
      },
      {
        actor: { reference: `Practitioner/${input.practitionerId}` },
        required: "required",
        status: "accepted",
      },
    ],
    ...(extensions.length ? { extension: extensions } : {}),
  });
}
