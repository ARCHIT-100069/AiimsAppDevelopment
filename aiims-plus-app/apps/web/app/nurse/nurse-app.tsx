"use client";

import { useState } from "react";
import { IDBadgeStrip } from "@aiims/ui-web";
import { Badge, Card, Empty, MockSection, Row, Splash, sectionIcon, Stat } from "../lib/app-shell";
import { formatTodayHeader } from "../lib/date";
import type { MockSectionData } from "../lib/mock";

interface Patient {
  id: string;
  mrn: string;
  nameGiven: string;
  nameFamily: string;
  gender: string;
  birthDate: string;
}
interface QueueItem {
  appointmentId?: string;
  patientId?: string;
  patientName?: string | null;
  queueToken?: number;
  status?: string;
  encounterId?: string | null;
}

export interface NurseData {
  userName: string;
  roles: string[];
  patients: Patient[];
  queue: QueueItem[];
}

interface NurseNavItem {
  key: string;
  label: string;
  group: string;
  /** True for sections with no real backend yet (no task/care-plan/alert
   *  data model exists) — rendered honestly as a labelled preview instead
   *  of inventing nursing data that was never recorded. */
  mock?: boolean;
}

const NAV: NurseNavItem[] = [
  { key: "dashboard", label: "Dashboard", group: "Overview" },
  { key: "ward", label: "Ward / Assigned Patients", group: "Care" },
  { key: "search", label: "My Patients", group: "Care" },
  { key: "vitals", label: "Vitals", group: "Care" },
  { key: "notes", label: "Nursing Notes", group: "Care" },
  { key: "tasks", label: "Today's Tasks", group: "Tasks", mock: true },
  { key: "medications", label: "Medication Tasks", group: "Tasks", mock: true },
  { key: "careplan", label: "Care Plan", group: "Tasks", mock: true },
  { key: "timeline", label: "Patient Timeline", group: "Records" },
  { key: "alerts", label: "Alerts", group: "Records", mock: true },
  { key: "profile", label: "My Profile", group: "Account" },
];

/** No task/alert/care-plan tracking exists in the data model yet — these
 *  stay empty rather than inventing nursing data that was never recorded. */
const EMPTY_MOCK: MockSectionData = {};

/** Real entry into the working EMR: open a patient's chart / active encounter
 *  to document vitals or notes — the same encounter workspace doctors use. */
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
    <Card title="My patients">
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
                  Open chart
                </a>
              }
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

export function NurseApp({ data }: { data: NurseData }) {
  const render = (key: string) => {
    const navItem = NAV.find((n) => n.key === key);
    if (navItem?.mock) return <MockSection title={navItem.label} data={EMPTY_MOCK} />;

    switch (key) {
      case "ward":
        return (
          <Card
            title="OPD queue — everyone currently waiting or in consult"
            action={<Badge tone="amber">{data.queue.length} waiting</Badge>}
          >
            {data.queue.length === 0 ? (
              <Empty>No one is checked in right now.</Empty>
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
      case "vitals":
        return (
          <ClinicalLauncher
            patients={data.patients}
            note="Vitals are recorded inside a patient's active encounter — open their chart, then the encounter, to add a reading."
            primary={{ label: "Go to OPD queue", href: "/appointments/queue" }}
          />
        );
      case "notes":
        return (
          <ClinicalLauncher
            patients={data.patients}
            note="Nursing notes use the same clinical-notes panel as the rest of the care team — open the patient's active encounter to add one."
          />
        );
      case "timeline":
        return (
          <ClinicalLauncher
            patients={data.patients}
            note="Open a patient's chart for their full timeline — encounters, vitals, diagnoses, medications, and results in one place."
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
      default:
        return <MockSection title={navItem?.label ?? "Section"} data={EMPTY_MOCK} />;
    }
  };

  const [active, setActive] = useState<string | null>(null);
  const activeItem = NAV.find((n) => n.key === active);
  const groups = [...new Set(NAV.map((n) => n.group))];

  return (
    <div className="app-bg flex h-screen flex-col overflow-hidden">
      <Splash greeting="Nurse" />

      {/* Persistent top bar: hospital brand, verified identity, quick actions. */}
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
          subtitle="Nurse · OPD"
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
        <label htmlFor="nurse-mobile-nav" className="sr-only">
          Section
        </label>
        <select
          id="nurse-mobile-nav"
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
        {/* Persistent left rail — same pattern as the doctor workspace. */}
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
              <div>
                <h1 className="font-display text-xl font-normal tracking-tight text-slate-900">
                  Good day, {data.userName}
                </h1>
                <p className="text-sm text-slate-500">
                  {formatTodayHeader()} · today's ward at a glance.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Checked in" value={`${data.queue.length}`} tone="amber" />
                <Stat
                  label="In consult"
                  value={`${data.queue.filter((q) => q.status === "in_progress").length}`}
                  tone="slate"
                />
                <Stat label="Patients" value={`${data.patients.length}`} tone="slate" />
              </div>

              <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-5">
                <Card
                  title="OPD queue"
                  action={<Badge tone="amber">{data.queue.length} waiting</Badge>}
                  className="lg:col-span-3"
                >
                  <div className="max-h-[420px] overflow-y-auto">
                    {data.queue.length === 0 ? (
                      <Empty>No one is checked in right now.</Empty>
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

                <div className="flex flex-col gap-4 lg:col-span-2">
                  <Card title="Quick actions">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: "search", label: "Find patient" },
                        { key: "vitals", label: "Record vitals" },
                        { key: "notes", label: "Nursing note" },
                        { key: "timeline", label: "Patient chart" },
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
