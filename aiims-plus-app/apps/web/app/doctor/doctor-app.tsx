"use client";

import { useEffect, useState } from "react";
import {
  AppShell,
  Badge,
  Card,
  Empty,
  MockSection,
  Row,
  Stat,
  type NavItem,
} from "../lib/app-shell";
import { doctorMock } from "../lib/mock";

interface Patient {
  id: string;
  mrn: string;
  nameGiven: string;
  nameFamily: string;
  gender: string;
  birthDate: string;
}
interface Appt {
  id: string;
  startAt: string;
  status: string;
  appointmentType: string;
}
interface QueueItem {
  appointmentId?: string;
  queueToken?: number;
  status?: string;
}

export interface DoctorData {
  userName: string;
  roles: string[];
  patients: Patient[];
  appointments: Appt[];
  queue: QueueItem[];
}

const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", group: "Overview" },
  { key: "today", label: "Today's Appointments", group: "Clinic" },
  { key: "queue", label: "Patient Queue", group: "Clinic" },
  { key: "search", label: "Patient Search", group: "Clinic" },
  { key: "encounters", label: "Encounters / Consultations", group: "Patient Care" },
  { key: "records", label: "Medical Records", group: "Patient Care" },
  { key: "notes", label: "Clinical Notes", group: "Patient Care" },
  { key: "prescriptions", label: "Prescriptions", group: "Patient Care" },
  { key: "lab", label: "Lab Orders & Results", group: "Diagnostics" },
  { key: "radiology", label: "Radiology / Imaging", group: "Diagnostics" },
  { key: "vitals", label: "Vitals & Charts", group: "Diagnostics" },
  { key: "diagnoses", label: "Diagnoses (ICD-10)", group: "Diagnostics" },
  { key: "certificates", label: "Medical Certificates", group: "Documents" },
  { key: "admissions", label: "Admissions & Discharges", group: "Documents" },
  { key: "referrals", label: "Referrals", group: "Documents" },
  { key: "billing", label: "Billing Overview", group: "Admin" },
  { key: "notifications", label: "Notifications", group: "Admin" },
  { key: "schedule", label: "Schedule & Availability", group: "Admin" },
  { key: "analytics", label: "Doctor Analytics", group: "Admin" },
  { key: "profile", label: "My Profile", group: "Account" },
  { key: "settings", label: "Settings", group: "Account" },
];

const dayFmt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
const istDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });

function PatientSearch({ initial }: { initial: Patient[] }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Patient[]>(initial);
  const [busy, setBusy] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/bff/patients?q=${encodeURIComponent(q)}&limit=25`);
      const body = (await res.json().catch(() => ({ data: [] }))) as { data?: Patient[] };
      setResults(body.data ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Patient search">
      <form onSubmit={run} className="mb-3 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name or MRN"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
          {busy ? "…" : "Search"}
        </button>
      </form>
      {results.length === 0 ? (
        <Empty>No patients found.</Empty>
      ) : (
        <ul className="divide-y divide-slate-100">
          {results.map((p) => (
            <Row
              key={p.id}
              title={`${p.nameGiven} ${p.nameFamily}`}
              sub={`${p.mrn} · ${p.gender} · ${p.birthDate}`}
              right={
                <a
                  className="text-sm font-medium text-teal-700 hover:underline"
                  href={`/patients/${p.id}`}
                >
                  Open
                </a>
              }
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

interface DrugOpt {
  id: string;
  name: string;
  strength: string;
  form: string;
  totalQty: number;
}
/* Deterministic prescribing aids (NOT AI — standard clinical shorthand). */
const FREQ_OPTIONS = [
  { code: "OD", label: "OD — once daily", perDay: 1 },
  { code: "BD", label: "BD — twice daily", perDay: 2 },
  { code: "TDS", label: "TDS — thrice daily", perDay: 3 },
  { code: "QID", label: "QID — four times daily", perDay: 4 },
  { code: "HS", label: "HS — at bedtime", perDay: 1 },
  { code: "SOS", label: "SOS — as needed", perDay: 1 },
  { code: "STAT", label: "STAT — at once", perDay: 1 },
] as const;
const WHEN_OPTIONS = ["After food", "Before food", "With food", "Empty stomach"] as const;
const DURATION_OPTIONS = [
  { label: "3 days", days: 3 },
  { label: "5 days", days: 5 },
  { label: "7 days", days: 7 },
  { label: "10 days", days: 10 },
  { label: "14 days", days: 14 },
  { label: "1 month", days: 30 },
] as const;

interface RxLine {
  drugId: string;
  name: string;
  strength: string;
  form: string;
  dose: string;
  freq: string; // FREQ code
  when: string;
  durationDays: number;
  quantity: number;
}

const perDayFor = (code: string) => FREQ_OPTIONS.find((f) => f.code === code)?.perDay ?? 1;
const suggestQty = (form: string, freqCode: string, days: number) => {
  // Countable forms (tablet/capsule): perDay × days. Others: 1 unit (bottle/tube).
  const countable = /tablet|capsule/i.test(form);
  return countable ? Math.max(1, perDayFor(freqCode) * days) : 1;
};

/** Digital prescription pad: search the formulary, add drugs with structured
 *  dose/frequency/timing/duration suggestions, auto quantity → pharmacy queue. */
function PrescribeForm({ patients }: { patients: Patient[] }) {
  const [drugs, setDrugs] = useState<DrugOpt[]>([]);
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<RxLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  useEffect(() => {
    fetch("/api/bff/drugs")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setDrugs(d.data ?? []));
  }, []);

  const matches = query.trim()
    ? drugs
        .filter((d) => `${d.name} ${d.strength}`.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 6)
    : [];

  function addDrug(d: DrugOpt) {
    if (lines.some((l) => l.drugId === d.id)) {
      setQuery("");
      return;
    }
    const freq = "BD";
    const durationDays = 5;
    setLines((ls) => [
      ...ls,
      {
        drugId: d.id,
        name: d.name,
        strength: d.strength,
        form: d.form,
        dose: d.strength,
        freq,
        when: "After food",
        durationDays,
        quantity: suggestQty(d.form, freq, durationDays),
      },
    ]);
    setQuery("");
  }

  function patch(idx: number, p: Partial<RxLine>) {
    setLines((ls) =>
      ls.map((l, i) => {
        if (i !== idx) return l;
        const next = { ...l, ...p };
        // Re-suggest quantity whenever frequency or duration changes (unless the
        // clinician typed a custom quantity via the quantity field itself).
        if (("freq" in p || "durationDays" in p) && !("quantity" in p)) {
          next.quantity = suggestQty(next.form, next.freq, next.durationDays);
        }
        return next;
      }),
    );
  }

  async function submit() {
    if (!patientId || lines.length === 0 || busy) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/bff/prescriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId,
        items: lines.map((l) => ({
          drugId: l.drugId,
          dose: l.dose || l.strength,
          frequency: l.freq,
          duration: l.durationDays === 30 ? "1 month" : `${l.durationDays} days`,
          quantity: l.quantity,
          instructions: l.when,
        })),
      }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg({
        ok: true,
        t: `Prescription (${lines.length} drug${lines.length > 1 ? "s" : ""}) sent to the pharmacy queue.`,
      });
      setLines([]);
    } else {
      const b = (await res.json().catch(() => ({}))) as { detail?: string };
      setMsg({ ok: false, t: b.detail ?? "Could not write prescription." });
    }
  }

  return (
    <Card title="Write a prescription">
      <label className="block text-sm">
        <span className="text-slate-500">Patient</span>
        <select
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
        >
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nameGiven} {p.nameFamily} · {p.mrn}
            </option>
          ))}
        </select>
      </label>

      {/* Drug search + suggestions */}
      <div className="relative mt-4">
        <span className="text-sm text-slate-500">Add medicine</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            drugs.length ? "Search the formulary — e.g. Paracetamol" : "No drugs in formulary yet"
          }
          disabled={drugs.length === 0}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        {matches.length > 0 ? (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            {matches.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => addDrug(d)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-teal-50"
                >
                  <span className="font-medium text-slate-800">
                    {d.name} {d.strength}{" "}
                    <span className="font-normal text-slate-400">({d.form})</span>
                  </span>
                  <span
                    className={d.totalQty > 0 ? "text-xs text-slate-400" : "text-xs text-red-500"}
                  >
                    {d.totalQty} in stock
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Prescription lines */}
      {lines.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
          Search above to add medicines to this prescription.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {lines.map((l, idx) => (
            <li key={l.drugId} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-800">
                  {l.name} <span className="text-slate-400">{l.strength}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label className="text-xs text-slate-500">
                  Dose
                  <input
                    value={l.dose}
                    onChange={(e) => patch(idx, { dose: e.target.value })}
                    className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-800"
                  />
                </label>
                <label className="text-xs text-slate-500">
                  Frequency
                  <select
                    value={l.freq}
                    onChange={(e) => patch(idx, { freq: e.target.value })}
                    className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-800"
                  >
                    {FREQ_OPTIONS.map((f) => (
                      <option key={f.code} value={f.code}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-500">
                  Timing
                  <select
                    value={l.when}
                    onChange={(e) => patch(idx, { when: e.target.value })}
                    className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-800"
                  >
                    {WHEN_OPTIONS.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-500">
                  Duration
                  <select
                    value={l.durationDays}
                    onChange={(e) => patch(idx, { durationDays: Number(e.target.value) })}
                    className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-800"
                  >
                    {DURATION_OPTIONS.map((d) => (
                      <option key={d.days} value={d.days}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <span>Dispense qty</span>
                <input
                  type="number"
                  min={1}
                  value={l.quantity}
                  onChange={(e) => patch(idx, { quantity: Math.max(1, Number(e.target.value)) })}
                  className="w-20 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-800"
                />
                <span className="text-slate-400">
                  · {l.freq} · {l.when} ·{" "}
                  {l.durationDays === 30 ? "1 month" : `${l.durationDays} days`}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {msg ? (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
        >
          {msg.t}
        </p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={busy || lines.length === 0}
        className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {busy ? "Writing…" : `Write prescription${lines.length ? ` (${lines.length})` : ""}`}
      </button>
    </Card>
  );
}

/** Real entry into the working EMR: open a patient's chart / the OPD schedule. */
function ClinicalLauncher({
  patients,
  note,
  primary,
}: {
  patients: Patient[];
  note: string;
  primary?: { label: string; href: string };
}) {
  return (
    <Card title="Clinical workspace">
      <p className="mb-3 text-sm text-slate-600">{note}</p>
      {primary ? (
        <a
          href={primary.href}
          className="mb-4 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          {primary.label}
        </a>
      ) : null}
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Open a patient chart
      </p>
      {patients.length === 0 ? (
        <Empty>No patients on record.</Empty>
      ) : (
        <ul className="divide-y divide-slate-100">
          {patients.slice(0, 12).map((p) => (
            <Row
              key={p.id}
              title={`${p.nameGiven} ${p.nameFamily}`}
              sub={`${p.mrn} · ${p.gender}`}
              right={
                <a
                  href={`/patients/${p.id}`}
                  className="text-sm font-medium text-teal-700 hover:underline"
                >
                  Open →
                </a>
              }
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

export function DoctorApp({ data }: { data: DoctorData }) {
  const today = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
  const todays = data.appointments.filter((a) => istDay(a.startAt) === today);

  const render = (key: string) => {
    switch (key) {
      case "dashboard":
        return (
          <>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Good day, {data.userName}</h2>
              <p className="mt-1 text-sm text-slate-500">Your clinical workspace.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Today" value={`${todays.length}`} />
              <Stat label="In queue" value={`${data.queue.length}`} tone="amber" />
              <Stat label="Appointments" value={`${data.appointments.length}`} tone="slate" />
              <Stat label="Patients" value={`${data.patients.length}`} tone="slate" />
            </div>
            <Card title="Next patients today">
              {todays.length === 0 ? (
                <Empty>No appointments today.</Empty>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {todays.slice(0, 6).map((a) => (
                    <Row
                      key={a.id}
                      title={dayFmt(a.startAt)}
                      sub={a.appointmentType}
                      right={<Badge tone="teal">{a.status.replace("_", " ")}</Badge>}
                    />
                  ))}
                </ul>
              )}
            </Card>
          </>
        );
      case "today":
        return (
          <Card title="Today's appointments">
            {todays.length === 0 ? (
              <Empty>No appointments today.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {todays.map((a) => (
                  <Row
                    key={a.id}
                    title={dayFmt(a.startAt)}
                    sub={a.appointmentType}
                    right={<Badge tone="teal">{a.status.replace("_", " ")}</Badge>}
                  />
                ))}
              </ul>
            )}
          </Card>
        );
      case "queue":
        return (
          <Card title="OPD patient queue">
            {data.queue.length === 0 ? (
              <Empty>The queue is empty.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.queue.map((q, i) => (
                  <Row
                    key={q.appointmentId ?? i}
                    title={`Token ${q.queueToken ?? i + 1}`}
                    sub={q.status ?? "waiting"}
                  />
                ))}
              </ul>
            )}
          </Card>
        );
      case "search":
        return <PatientSearch initial={data.patients} />;
      case "prescriptions":
        return <PrescribeForm patients={data.patients} />;
      case "encounters":
        return (
          <ClinicalLauncher
            patients={data.patients}
            note="Consultations open from the OPD schedule — check a patient in to start and sign an encounter."
            primary={{ label: "Go to OPD schedule", href: "/appointments" }}
          />
        );
      case "records":
        return (
          <ClinicalLauncher
            patients={data.patients}
            note="Open a patient's chart to review their record and history."
          />
        );
      case "notes":
      case "vitals":
      case "diagnoses":
      case "lab":
        return (
          <ClinicalLauncher
            patients={data.patients}
            note="These are recorded inside an encounter. Open the patient's chart, then their active encounter to document."
            primary={{ label: "Go to OPD schedule", href: "/appointments" }}
          />
        );
      case "profile":
        return (
          <Card title="My profile">
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase text-slate-400">Name</dt>
                <dd className="text-slate-800">{data.userName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-400">Roles</dt>
                <dd className="text-slate-800">{data.roles.join(", ")}</dd>
              </div>
            </dl>
          </Card>
        );
      default: {
        const label = NAV.find((n) => n.key === key)?.label ?? "Section";
        return <MockSection title={label} data={doctorMock[key]} />;
      }
    }
  };

  return (
    <AppShell
      appName="AIIMS+"
      roleLabel="Doctor Workspace"
      greeting="Doctor"
      userName={data.userName}
      nav={NAV}
      renderSection={render}
    />
  );
}
