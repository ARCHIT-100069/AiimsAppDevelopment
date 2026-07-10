"use client";

import { useState } from "react";
import {
  AppShell,
  Badge,
  Card,
  Empty,
  Placeholder,
  Row,
  Stat,
  type NavItem,
} from "../lib/app-shell";

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
        const notes: Record<string, string> = {
          encounters: "Open an appointment from Today's list to start a consultation.",
          records: "A patient's full medical record opens from Patient Search.",
          notes: "Clinical notes for the active encounter will appear here.",
          prescriptions: "Prescribing and medication history will appear here.",
          lab: "Lab orders you place and their results will appear here.",
          radiology: "Imaging orders and reports will appear here.",
          vitals: "Vitals trends and charts will appear here.",
          diagnoses: "ICD-10 diagnoses you record will appear here.",
          certificates: "Fitness and medical certificates will appear here.",
          admissions: "Admission and discharge workflow will appear here.",
          referrals: "Referrals in and out will appear here.",
          billing: "Read-only billing for your encounters will appear here.",
          notifications: "Your alerts and messages will appear here.",
          schedule: "Your availability templates and slots will appear here.",
          analytics: "Your consultation and outcome metrics will appear here.",
          settings: "Personal preferences will appear here.",
        };
        const label = NAV.find((n) => n.key === key)?.label ?? "Section";
        return <Placeholder title={label} note={notes[key] ?? "Coming soon."} />;
      }
    }
  };

  return (
    <AppShell
      appName="AIIMS+"
      roleLabel="Doctor Workspace"
      userName={data.userName}
      nav={NAV}
      renderSection={render}
    />
  );
}
