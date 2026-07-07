"use client";

import { useState } from "react";
import type {
  AppointmentResponse,
  FacilityResponse,
  PatientResponse,
  PractitionerResponse,
  Slot,
} from "@aiims/api-contracts";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  IconCalendar,
  IconPlus,
  Select,
} from "@aiims/ui-web";

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const STATUS_TONE: Record<string, "green" | "sky" | "slate" | "amber"> = {
  booked: "sky",
  checked_in: "green",
  in_progress: "green",
  fulfilled: "slate",
  cancelled: "slate",
  no_show: "amber",
};

export function SchedulingConsole({
  date,
  initialAppointments,
  practitioners,
  facilities,
  patients,
  canManage,
}: {
  date: string;
  initialAppointments: AppointmentResponse[];
  practitioners: PractitionerResponse[];
  facilities: FacilityResponse[];
  patients: PatientResponse[];
  canManage: boolean;
}) {
  const [appts, setAppts] = useState(initialAppointments);
  const [patientId, setPatientId] = useState("");
  const [practitionerId, setPractitionerId] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotIdx, setSlotIdx] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const practitionerName = (id: string) => {
    const p = practitioners.find((x) => x.id === id);
    return p ? `${p.nameGiven} ${p.nameFamily}` : id.slice(0, 8);
  };
  const patientName = (id: string) => {
    const p = patients.find((x) => x.id === id);
    return p ? `${p.nameGiven} ${p.nameFamily}` : id.slice(0, 8);
  };

  async function reload() {
    const res = await fetch(
      `/api/bff/appointments?from=${date}T00:00:00.000Z&to=${date}T23:59:59.999Z&limit=100`,
    );
    const body = res.ok ? await res.json() : { data: [] };
    setAppts(body.data ?? []);
  }

  async function findSlots() {
    setError(null);
    setSlots([]);
    setSlotIdx("");
    if (!practitionerId) return;
    const res = await fetch(
      `/api/bff/slots?practitionerId=${practitionerId}&date=${encodeURIComponent(date)}`,
    );
    if (res.ok) {
      const body = await res.json();
      setSlots(body.slots ?? []);
    }
  }

  async function book(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const slot = slots[Number(slotIdx)];
    if (!patientId || !practitionerId || !facilityId || !slot) {
      setError("Select a patient, practitioner, facility, and slot.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/bff/appointments", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({
        patientId,
        practitionerId,
        facilityId,
        startAt: slot.startAt,
        endAt: slot.endAt,
      }),
    });
    setBusy(false);
    if (res.status === 201 || res.status === 200) {
      setNotice(`Booked ${patientName(patientId)} at ${timeOf(slot.startAt)}.`);
      setSlots([]);
      setSlotIdx("");
      await reload();
      return;
    }
    const problem = await res.json().catch(() => ({}));
    setError(
      res.status === 409
        ? (problem.detail ?? "That slot was just taken. Pick another.")
        : (problem.detail ?? "Could not book the appointment."),
    );
  }

  async function checkIn(a: AppointmentResponse) {
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/bff/appointments/${a.id}/check-in`, {
      method: "POST",
      headers: { "idempotency-key": crypto.randomUUID() },
    });
    if (res.ok) {
      const body = await res.json();
      setNotice(`${patientName(a.patientId)} checked in — token #${body.queueToken}.`);
      await reload();
    } else {
      const problem = await res.json().catch(() => ({}));
      setError(problem.detail ?? "Could not check in.");
    }
  }

  async function act(a: AppointmentResponse, action: "cancel" | "no-show") {
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/bff/appointments/${a.id}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json", "if-match": String(a.version) },
      body: "{}",
    });
    if (res.ok) {
      await reload();
    } else {
      const problem = await res.json().catch(() => ({}));
      setError(problem.detail ?? `Could not ${action} the appointment.`);
    }
  }

  return (
    <section aria-labelledby="appointments-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="appointments-heading" className="text-2xl font-bold text-slate-900">
            Appointments
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {date} · {appts.length} today
          </p>
        </div>
        <a href="/appointments/queue">
          <Button variant="secondary">
            <IconCalendar width={18} height={18} /> OPD queue
          </Button>
        </a>
      </div>

      {notice ? (
        <p role="status" className="mt-4 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {canManage ? (
        <Card className="mt-6 p-6">
          <h2 className="text-sm font-semibold text-slate-700">Book an appointment</h2>
          <form onSubmit={book} className="mt-4 space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Patient">
                <Select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                  <option value="">Select…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameGiven} {p.nameFamily} ({p.mrn})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Practitioner">
                <Select
                  value={practitionerId}
                  onChange={(e) => {
                    setPractitionerId(e.target.value);
                    setSlots([]);
                    setSlotIdx("");
                  }}
                >
                  <option value="">Select…</option>
                  {practitioners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameGiven} {p.nameFamily}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Facility">
                <Select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
                  <option value="">Select…</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <Button
                type="button"
                variant="secondary"
                onClick={findSlots}
                disabled={!practitionerId}
              >
                Find slots ({date})
              </Button>
              <Field label="Available slot">
                <Select value={slotIdx} onChange={(e) => setSlotIdx(e.target.value)}>
                  <option value="">
                    {slots.length ? "Select a slot…" : "No slots — set availability first"}
                  </option>
                  {slots.map((s, i) => (
                    <option key={s.startAt} value={i}>
                      {timeOf(s.startAt)} – {timeOf(s.endAt)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" disabled={busy || slotIdx === ""}>
                <IconPlus width={18} height={18} /> {busy ? "Booking…" : "Book"}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="mt-6 overflow-hidden">
        <DataTable
          rows={appts}
          rowKey={(a) => a.id}
          empty={
            <div className="flex flex-col items-center gap-2 py-6 text-slate-400">
              <IconCalendar width={32} height={32} />
              <p className="text-sm text-slate-500">No appointments today</p>
            </div>
          }
          columns={[
            {
              header: "Time",
              cell: (a) => (
                <span className="font-mono text-sm text-slate-700">
                  {timeOf(a.startAt)}–{timeOf(a.endAt)}
                </span>
              ),
            },
            { header: "Patient", cell: (a) => patientName(a.patientId) },
            { header: "Practitioner", cell: (a) => practitionerName(a.practitionerId) },
            {
              header: "Status",
              cell: (a) => (
                <Badge tone={STATUS_TONE[a.status] ?? "slate"}>{a.status.replace("_", " ")}</Badge>
              ),
            },
            {
              header: "Actions",
              cell: (a) =>
                canManage ? (
                  <div className="flex gap-2">
                    {a.status === "booked" ? (
                      <>
                        <Button size="sm" onClick={() => checkIn(a)}>
                          Check in
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => act(a, "no-show")}>
                          No-show
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => act(a, "cancel")}>
                          Cancel
                        </Button>
                      </>
                    ) : a.status === "checked_in" || a.status === "in_progress" ? (
                      <Button size="sm" variant="ghost" onClick={() => act(a, "cancel")}>
                        Cancel
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                ),
            },
          ]}
        />
      </Card>
    </section>
  );
}
