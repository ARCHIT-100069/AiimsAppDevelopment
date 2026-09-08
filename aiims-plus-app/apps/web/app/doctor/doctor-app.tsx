"use client";

import { useEffect, useState } from "react";
import { IDBadgeStrip, IDCard } from "@aiims/ui-web";
import {
  Badge,
  Card,
  Empty,
  MockSection,
  Row,
  Splash,
  Stat,
  sectionIcon,
  type NavItem,
} from "../lib/app-shell";
import { formatDateShort, formatDayMonthTime, formatTodayHeader } from "../lib/date";
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
  patientId: string;
  startAt: string;
  status: string;
  appointmentType: string;
}
interface QueueItem {
  appointmentId?: string;
  patientId?: string;
  patientName?: string | null;
  queueToken?: number;
  status?: string;
  encounterId?: string | null;
}

export interface DoctorProfile {
  registrationNo: string;
  specialty: string | null;
  status: "active" | "inactive";
  since: string;
}

export interface DoctorData {
  userName: string;
  roles: string[];
  patients: Patient[];
  appointments: Appt[];
  queue: QueueItem[];
  profile: DoctorProfile | null;
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

const dayFmt = formatDayMonthTime;
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
        <button className="rounded-full bg-teal-700 px-4 py-2 text-sm font-medium tracking-wide text-white hover:bg-teal-800">
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
        className="mt-4 rounded-full bg-teal-700 px-4 py-2 text-sm font-medium tracking-wide text-white hover:bg-teal-800 disabled:opacity-50"
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
          className="mb-4 inline-block rounded-full bg-teal-700 px-4 py-2 text-sm font-medium tracking-wide text-white hover:bg-teal-800"
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
  const patientName = (id: string) => {
    const p = data.patients.find((x) => x.id === id);
    return p ? `${p.nameGiven} ${p.nameFamily}` : "Patient";
  };

  const render = (key: string) => {
    switch (key) {
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
                    title={patientName(a.patientId)}
                    sub={`${dayFmt(a.startAt)} · ${a.appointmentType.replace("_", " ")}`}
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
                    title={q.patientName ?? `Token ${q.queueToken ?? i + 1}`}
                    sub={`Token ${q.queueToken ?? i + 1} · ${(q.status ?? "waiting").replace("_", " ")}`}
                    right={
                      q.encounterId ? (
                        <a
                          href={`/encounters/${q.encounterId}`}
                          className="rounded-full bg-teal-700 px-3 py-1.5 text-sm font-medium tracking-wide text-white hover:bg-teal-800"
                        >
                          Open encounter →
                        </a>
                      ) : undefined
                    }
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
          <div className="grid gap-6 lg:grid-cols-[368px_1fr] lg:items-start">
            <IDCard
              kind="staff"
              name={data.userName}
              idLabel="REG. NO."
              idValue={data.profile?.registrationNo ?? "Not on file"}
              subtitle={data.profile?.specialty ? `Doctor — ${data.profile.specialty}` : "Doctor"}
              statusLabel={data.profile?.status === "inactive" ? "Inactive" : "Active"}
              facility="Main Campus — OPD Block"
              issuedValue={data.profile ? formatDateShort(data.profile.since) : undefined}
            />
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
                <div>
                  <dt className="text-xs uppercase text-slate-400">Registration</dt>
                  <dd className="font-mono text-slate-800">
                    {data.profile?.registrationNo ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-400">Specialty</dt>
                  <dd className="text-slate-800">{data.profile?.specialty ?? "—"}</dd>
                </div>
              </dl>
            </Card>
          </div>
        );
      default: {
        const label = NAV.find((n) => n.key === key)?.label ?? "Section";
        return <MockSection title={label} data={doctorMock[key]} />;
      }
    }
  };

  const [active, setActive] = useState<string | null>(null);
  const activeItem = NAV.find((n) => n.key === active);
  const groups = [...new Set(NAV.map((n) => n.group))];
  const nextUp = todays.find((a) => a.status !== "completed" && a.status !== "cancelled");

  return (
    <div className="app-bg flex h-screen flex-col overflow-hidden">
      <Splash greeting="Doctor" />

      {/* Persistent top bar: hospital brand, verified doctor identity, quick actions. */}
      <header className="z-20 flex shrink-0 items-center gap-4 border-b border-white/40 bg-white/75 px-5 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={() => setActive(null)}
          className="flex shrink-0 items-center gap-1.5 text-teal-700"
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M10 2h4v8h8v4h-8v8h-4v-8H2v-4h8z" />
          </svg>
          <span className="font-display text-base tracking-tight">AIIMS+</span>
        </button>

        <IDBadgeStrip
          kind="staff"
          name={data.userName}
          idLabel={data.profile ? "REG. NO." : undefined}
          idValue={data.profile?.registrationNo}
          subtitle={data.profile?.specialty ? `Doctor — ${data.profile.specialty}` : "Doctor · OPD"}
          className="cursor-pointer"
        />

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActive("search")}
            className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3.5 py-1.5 text-sm text-slate-500 hover:border-teal-300 hover:text-teal-700 sm:flex"
          >
            <svg
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            Find a patient
          </button>
          <button
            type="button"
            title="Notifications"
            className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6M10 21h4" />
            </svg>
          </button>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-full px-3.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
              Log out
            </button>
          </form>
        </div>
      </header>

      {/* Mobile section picker — the rail below is desktop/tablet-only (lg+); a
          narrow phone gets a plain dropdown instead of a squeezed sidebar. */}
      <div className="shrink-0 border-b border-white/40 bg-white/60 px-4 py-2 lg:hidden">
        <label htmlFor="doctor-mobile-nav" className="sr-only">
          Section
        </label>
        <select
          id="doctor-mobile-nav"
          value={active ?? "dashboard"}
          onChange={(e) => setActive(e.target.value === "dashboard" ? null : e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
        >
          {NAV.map((n) => (
            <option key={n.key} value={n.key}>
              {n.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Persistent left rail — every section one click away, no home-screen tile hunt. */}
        <nav className="hidden w-[276px] shrink-0 overflow-y-auto border-r border-white/40 bg-white/45 px-3 py-4 lg:block">
          {groups.map((g, gi) => (
            <div key={g} className={gi === 0 ? "mb-5" : "mb-5 mt-1"}>
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {g}
              </p>
              <div className="space-y-0.5">
                {NAV.filter((n) => n.group === g).map((n) => {
                  const isDashboard = n.key === "dashboard";
                  const isActive = isDashboard ? active === null : active === n.key;
                  return (
                    <button
                      type="button"
                      key={n.key}
                      onClick={() => setActive(isDashboard ? null : n.key)}
                      className={`flex w-full items-center gap-3 rounded-full px-2.5 py-2 text-left text-[13px] font-medium transition-colors ${
                        isActive
                          ? "bg-teal-700 text-white"
                          : "text-slate-600 hover:bg-teal-50 hover:text-teal-700"
                      }`}
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                          isActive ? "bg-white/15" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {sectionIcon(n.label, 16)}
                      </span>
                      <span className="min-w-0 flex-1 leading-tight">{n.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Main workspace */}
        <main className="flex-1 overflow-y-auto p-6">
          {active === null ? (
            <div className="flex h-full flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-display text-xl font-normal tracking-tight text-slate-900">
                    Good day, {data.userName}
                  </h1>
                  <p className="text-sm text-slate-500">
                    {formatTodayHeader()} · your clinical workspace at a glance.
                  </p>
                </div>
                {nextUp ? (
                  <a
                    href="/appointments"
                    className="hidden rounded-full bg-teal-700 px-4 py-2 text-sm font-medium tracking-wide text-white hover:bg-teal-800 md:inline-block"
                  >
                    Next: {dayFmt(nextUp.startAt)} →
                  </a>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Today" value={`${todays.length}`} />
                <Stat label="In queue" value={`${data.queue.length}`} tone="amber" />
                <Stat label="Appointments" value={`${data.appointments.length}`} tone="slate" />
                <Stat label="Patients" value={`${data.patients.length}`} tone="slate" />
              </div>

              <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-5">
                <Card
                  title="Next patients today"
                  action={<Badge tone="teal">{todays.length} today</Badge>}
                >
                  <div className="max-h-[420px] overflow-y-auto">
                    {todays.length === 0 ? (
                      <Empty>No appointments today.</Empty>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {todays.map((a) => (
                          <Row
                            key={a.id}
                            title={patientName(a.patientId)}
                            sub={`${dayFmt(a.startAt)} · ${a.appointmentType.replace("_", " ")}`}
                            right={<Badge tone="teal">{a.status.replace("_", " ")}</Badge>}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                </Card>

                <div className="flex flex-col gap-4 lg:col-span-2">
                  <Card
                    title="OPD queue"
                    action={<Badge tone="amber">{data.queue.length} waiting</Badge>}
                  >
                    <div className="max-h-[180px] overflow-y-auto">
                      {data.queue.length === 0 ? (
                        <Empty>The queue is empty.</Empty>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {data.queue.map((q, i) => (
                            <Row
                              key={q.appointmentId ?? i}
                              title={q.patientName ?? `Token ${q.queueToken ?? i + 1}`}
                              sub={`Token ${q.queueToken ?? i + 1} · ${(q.status ?? "waiting").replace("_", " ")}`}
                              right={
                                q.encounterId ? (
                                  <a
                                    href={`/encounters/${q.encounterId}`}
                                    className="text-sm font-medium text-teal-700 hover:underline"
                                  >
                                    Open →
                                  </a>
                                ) : undefined
                              }
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  </Card>

                  <Card title="Quick actions">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: "search", label: "Find patient" },
                        { key: "prescriptions", label: "Write Rx" },
                        { key: "encounters", label: "OPD schedule" },
                        { key: "records", label: "Patient chart" },
                        { key: "scan", label: "Scan patient ID", href: "/scan" },
                      ].map((qa) =>
                        qa.href ? (
                          <a
                            key={qa.key}
                            href={qa.href}
                            className="qa-tile flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-700"
                          >
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-700">
                              {sectionIcon(qa.label, 15)}
                            </span>
                            {qa.label}
                          </a>
                        ) : (
                          <button
                            key={qa.key}
                            type="button"
                            onClick={() => setActive(qa.key)}
                            className="qa-tile flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-700"
                          >
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-700">
                              {sectionIcon(qa.label, 15)}
                            </span>
                            {qa.label}
                          </button>
                        ),
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="mb-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium text-teal-800 hover:bg-teal-50"
              >
                ← Dashboard
              </button>
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-teal-800 text-white">
                  {sectionIcon(activeItem?.label ?? "", 22)}
                </span>
                <h1 className="font-display text-2xl font-normal tracking-tight text-slate-900">
                  {activeItem?.label}
                </h1>
              </div>
              <div className="space-y-5 pb-6">{render(active)}</div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
