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
/** Real prescribing: write a prescription (patient + drug lines) → pharmacy queue. */
function PrescribeForm({ patients }: { patients: Patient[] }) {
  const [drugs, setDrugs] = useState<DrugOpt[]>([]);
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const [drugId, setDrugId] = useState("");
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  useEffect(() => {
    fetch("/api/bff/drugs")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => {
        setDrugs(d.data ?? []);
        setDrugId(d.data?.[0]?.id ?? "");
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId || !drugId) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/bff/prescriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId,
        items: [{ drugId, dose, frequency, duration, quantity: Number(quantity) }],
      }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, t: "Prescription sent to the pharmacy queue." });
      setDose("");
      setFrequency("");
      setDuration("");
      setQuantity("");
    } else {
      const b = (await res.json().catch(() => ({}))) as { detail?: string };
      setMsg({ ok: false, t: b.detail ?? "Could not write prescription." });
    }
  }

  if (drugs.length === 0) {
    return (
      <Card title="Write a prescription">
        <Empty>No drugs in the formulary yet — ask pharmacy to add drugs first.</Empty>
      </Card>
    );
  }
  return (
    <Card title="Write a prescription">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
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
        <label className="text-sm sm:col-span-2">
          <span className="text-slate-500">Drug</span>
          <select
            value={drugId}
            onChange={(e) => setDrugId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            {drugs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} {d.strength} ({d.form}) · {d.totalQty} in stock
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-500">Dose</span>
          <input
            required
            placeholder="e.g. 500 mg"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-500">Frequency</span>
          <input
            required
            placeholder="e.g. BD"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-500">Duration</span>
          <input
            required
            placeholder="e.g. 5 days"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-500">Quantity</span>
          <input
            required
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        {msg ? (
          <p
            className={`sm:col-span-2 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
          >
            {msg.t}
          </p>
        ) : null}
        <div className="sm:col-span-2">
          <button
            disabled={busy}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {busy ? "Writing…" : "Write prescription"}
          </button>
        </div>
      </form>
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
