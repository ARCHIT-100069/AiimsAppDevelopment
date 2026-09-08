"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { MySummaryResponse, PatientResponse } from "@aiims/api-contracts";
import type { UpdatePatientRequest } from "@aiims/api-contracts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconEdit,
  IDCard,
  Select,
  Tabs,
  TextInput,
} from "@aiims/ui-web";
import { formatDateShort, formatDayMonthTime } from "../../lib/date";

const inr = (n: string | number) =>
  "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const dateFmt = formatDateShort;

const STATUS_TONE: Record<string, "green" | "sky" | "slate" | "amber" | "teal"> = {
  active: "teal",
  resolved: "slate",
  in_progress: "sky",
  finished: "green",
  cancelled: "slate",
  paid: "green",
  issued: "amber",
  dispensed: "green",
};

function ageFromBirthDate(birthDate: string): number | null {
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const notYetBirthday =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (notYetBirthday) age -= 1;
  return age;
}

const genderLabel: Record<string, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  unknown: "Unknown",
};

/** View + edit with optimistic-concurrency reconcile (FEDR-0011, DDR-0009).
 *  A 409 tells the clinician the record changed and offers a refresh. */
export function PatientDetail({
  patient,
  chart,
}: {
  patient: PatientResponse;
  chart: MySummaryResponse | null;
}) {
  const [current, setCurrent] = useState(patient);
  const [editing, setEditing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<UpdatePatientRequest>({
    defaultValues: fields(patient),
  });

  // Warn on a hard navigation/close, not just in-app tab switches, while an
  // edit is in progress and unsaved (browser back/forward, closing the tab).
  useEffect(() => {
    if (!editing || !isDirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [editing, isDirty]);

  /** Confirms before discarding an in-progress, unsaved edit. */
  function confirmDiscard(): boolean {
    if (!editing || !isDirty) return true;
    return window.confirm("You have unsaved changes. Discard them?");
  }

  async function onSubmit(values: UpdatePatientRequest) {
    setError(null);
    setConflict(false);
    const res = await fetch(`/api/bff/patients/${current.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "if-match": String(current.version) },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      setCurrent(await res.json());
      setEditing(false);
      return;
    }
    if (res.status === 409) return setConflict(true);
    const problem = await res.json().catch(() => ({}));
    setError(problem.detail ?? "Update failed");
  }

  async function refresh() {
    const res = await fetch(`/api/bff/patients/${current.id}`);
    if (res.ok) {
      const fresh = await res.json();
      setCurrent(fresh);
      reset(fields(fresh));
      setConflict(false);
    }
  }

  const fullName = `${current.nameGiven} ${current.nameFamily}`;
  const age = ageFromBirthDate(current.birthDate);

  return (
    <div className="grid gap-6 lg:grid-cols-[368px_1fr] lg:items-start">
      <IDCard
        kind="patient"
        name={fullName}
        idLabel="MRN"
        idValue={current.mrn}
        subtitle={`${genderLabel[current.gender] ?? current.gender}${age !== null ? ` · ${age} yrs` : ""}`}
        statusLabel={current.abhaAddress ? "ABHA linked" : "Registered"}
        meta={[
          { label: "Date of birth", value: current.birthDate },
          ...(current.abhaAddress ? [{ label: "ABHA ID", value: current.abhaAddress }] : []),
        ]}
        issuedValue={formatDateShort(current.createdAt)}
      />

      <Card className="overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-6">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900">{fullName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="font-mono text-xs">{current.mrn}</span>
              <span aria-hidden>·</span>
              <Badge tone="slate">{current.gender}</Badge>
              {current.abhaAddress ? <Badge tone="green">ABHA linked</Badge> : null}
            </div>
          </div>
          {!editing && tab === "overview" ? (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <IconEdit width={16} height={16} /> Edit
            </Button>
          ) : null}
        </div>

        <Tabs
          className="px-6"
          active={tab}
          onChange={(k) => {
            if (!confirmDiscard()) return;
            setTab(k);
            setEditing(false);
            reset(fields(current));
          }}
          tabs={[
            { key: "overview", label: "Overview" },
            { key: "appointments", label: "Appointments", count: chart?.appointments.length },
            { key: "encounters", label: "Encounters", count: chart?.visits.length },
            { key: "vitals", label: "Vitals", count: chart?.vitals.length },
            { key: "diagnoses", label: "Diagnoses", count: chart?.diagnoses.length },
            { key: "medications", label: "Medications", count: chart?.medications.length },
            { key: "reports", label: "Reports", count: chart?.reports.length },
            { key: "billing", label: "Billing", count: chart?.invoices.length },
          ]}
        />

        <div className="p-6">
          {conflict ? (
            <div
              role="alert"
              className="mb-4 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
            >
              This patient was changed by someone else.{" "}
              <button type="button" className="font-semibold underline" onClick={refresh}>
                Load the latest version
              </button>{" "}
              before editing.
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {tab === "overview" &&
            (!editing ? (
              <>
                <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  <Detail label="Date of birth" value={current.birthDate} />
                  <Detail label="Gender" value={current.gender} />
                  <Detail label="Phone" value={current.phone ?? "—"} />
                  <Detail label="Email" value={current.email ?? "—"} />
                  <Detail label="ABHA address" value={current.abhaAddress ?? "—"} />
                  <Detail label="ABHA number" value={current.abhaNumber ?? "—"} mono />
                </dl>
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Allergies</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Not recorded — allergy tracking isn't part of this build yet.
                  </p>
                </div>
              </>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Given name">
                    <TextInput {...register("nameGiven")} />
                  </Field>
                  <Field label="Family name">
                    <TextInput {...register("nameFamily")} />
                  </Field>
                  <Field label="Gender">
                    <Select {...register("gender")}>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="unknown">Unknown</option>
                    </Select>
                  </Field>
                  <Field label="Phone">
                    <TextInput type="tel" {...register("phone")} />
                  </Field>
                  <Field label="Email">
                    <TextInput type="email" {...register("email")} />
                  </Field>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit">Save changes</Button>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      if (!confirmDiscard()) return;
                      setEditing(false);
                      reset(fields(current));
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ))}

          {tab === "appointments" ? <AppointmentsTab chart={chart} /> : null}
          {tab === "encounters" ? <EncountersTab chart={chart} /> : null}
          {tab === "vitals" ? <VitalsTab chart={chart} /> : null}
          {tab === "diagnoses" ? <DiagnosesTab chart={chart} /> : null}
          {tab === "medications" ? <MedicationsTab chart={chart} /> : null}
          {tab === "reports" ? <ReportsTab chart={chart} /> : null}
          {tab === "billing" ? <BillingTab chart={chart} /> : null}
        </div>
      </Card>
    </div>
  );
}

function ChartUnavailable() {
  return <EmptyState>Couldn't load this section right now. Try refreshing the page.</EmptyState>;
}

function AppointmentsTab({ chart }: { chart: MySummaryResponse | null }) {
  if (!chart) return <ChartUnavailable />;
  if (chart.appointments.length === 0) return <EmptyState>No appointments yet.</EmptyState>;
  return (
    <ul className="divide-y divide-slate-100">
      {chart.appointments.map((a) => (
        <li key={a.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="font-medium text-slate-800">{formatDayMonthTime(a.startAt)}</p>
            <p className="truncate text-sm text-slate-500">
              {a.appointmentType.replace("_", " ")}
              {a.reasonText ? ` · ${a.reasonText}` : ""}
            </p>
          </div>
          <Badge tone={STATUS_TONE[a.status] ?? "slate"}>{a.status.replace("_", " ")}</Badge>
        </li>
      ))}
    </ul>
  );
}

function EncountersTab({ chart }: { chart: MySummaryResponse | null }) {
  if (!chart) return <ChartUnavailable />;
  if (chart.visits.length === 0) return <EmptyState>No encounters recorded yet.</EmptyState>;
  return (
    <ul className="divide-y divide-slate-100">
      {chart.visits.map((v) => (
        <li key={v.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="font-medium text-slate-800">{v.chiefComplaint ?? "OPD encounter"}</p>
            <p className="text-sm text-slate-500">{dateFmt(v.date)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone={v.signed ? "green" : (STATUS_TONE[v.status] ?? "slate")}>
              {v.signed ? "Signed" : v.status.replace("_", " ")}
            </Badge>
            <a
              href={`/encounters/${v.id}`}
              className="text-sm font-medium text-teal-700 hover:underline"
            >
              Open →
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}

function VitalsTab({ chart }: { chart: MySummaryResponse | null }) {
  if (!chart) return <ChartUnavailable />;
  if (chart.vitals.length === 0) return <EmptyState>No vitals recorded yet.</EmptyState>;
  return (
    <ul className="divide-y divide-slate-100">
      {chart.vitals.map((v) => (
        <li key={v.id} className="flex items-center justify-between gap-3 py-3">
          <p className="font-medium text-slate-800">{v.display}</p>
          <div className="text-right">
            <p className="font-mono text-sm text-slate-700">
              {v.valueNumeric ?? v.valueText ?? "—"} {v.unit ?? ""}
            </p>
            <p className="text-xs text-slate-400">{dateFmt(v.effectiveAt)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function DiagnosesTab({ chart }: { chart: MySummaryResponse | null }) {
  if (!chart) return <ChartUnavailable />;
  if (chart.diagnoses.length === 0) return <EmptyState>No diagnoses recorded yet.</EmptyState>;
  return (
    <ul className="divide-y divide-slate-100">
      {chart.diagnoses.map((d, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="font-medium text-slate-800">{d.display}</p>
            <p className="font-mono text-xs text-slate-400">
              {d.system.toUpperCase()} · {d.code}
            </p>
          </div>
          <Badge tone={STATUS_TONE[d.clinicalStatus] ?? "slate"}>{d.clinicalStatus}</Badge>
        </li>
      ))}
    </ul>
  );
}

function MedicationsTab({ chart }: { chart: MySummaryResponse | null }) {
  if (!chart) return <ChartUnavailable />;
  if (chart.medications.length === 0) return <EmptyState>No medications on record.</EmptyState>;
  return (
    <ul className="divide-y divide-slate-100">
      {chart.medications.map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="font-medium text-slate-800">{m.name}</p>
            <p className="text-sm text-slate-500">
              {m.dose} · {m.frequency} · {m.duration}
            </p>
          </div>
          <Badge tone={STATUS_TONE[m.status] ?? "slate"}>{m.status}</Badge>
        </li>
      ))}
    </ul>
  );
}

function ReportsTab({ chart }: { chart: MySummaryResponse | null }) {
  if (!chart) return <ChartUnavailable />;
  if (chart.reports.length === 0) return <EmptyState>No lab or imaging reports yet.</EmptyState>;
  return (
    <ul className="space-y-4">
      {chart.reports.map((r) => (
        <li key={r.id} className="rounded-xl border border-slate-100 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Badge tone={r.category === "lab" ? "sky" : "teal"}>{r.category}</Badge>
              <span className="ml-2 text-xs uppercase tracking-wide text-slate-400">
                {r.status}
              </span>
              {!r.reviewedAt ? (
                <Badge tone="amber">Pending review — not visible to patient</Badge>
              ) : null}
            </div>
            <span className="text-xs text-slate-400">{dateFmt(r.issuedAt)}</span>
          </div>
          <p className="mt-2 text-sm text-slate-700">{r.conclusion}</p>
          {r.lines.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-slate-400">
                    <th className="py-1 pr-3 font-medium">Test</th>
                    <th className="py-1 pr-3 font-medium">Result</th>
                    <th className="py-1 pr-3 font-medium">Reference</th>
                    <th className="py-1 font-medium">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {r.lines.map((l, i) => (
                    <tr key={i} className="border-t border-slate-50">
                      <td className="py-1.5 pr-3">{l.analyte}</td>
                      <td className="py-1.5 pr-3 font-mono">
                        {l.value} {l.unit ?? ""}
                      </td>
                      <td className="py-1.5 pr-3 text-slate-500">{l.referenceRange ?? "—"}</td>
                      <td className="py-1.5">
                        <Badge tone={l.flag === "normal" ? "green" : "amber"}>{l.flag}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function BillingTab({ chart }: { chart: MySummaryResponse | null }) {
  if (!chart) return <ChartUnavailable />;
  if (chart.invoices.length === 0) return <EmptyState>No invoices yet.</EmptyState>;
  return (
    <ul className="divide-y divide-slate-100">
      {chart.invoices.map((inv) => (
        <li key={inv.invoiceNumber} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="font-mono text-sm font-medium text-slate-800">{inv.invoiceNumber}</p>
            <p className="text-sm text-slate-500">{dateFmt(inv.issuedAt)}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-slate-800">{inr(inv.total)}</p>
            <Badge tone={STATUS_TONE[inv.status] ?? "slate"}>{inv.status}</Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}

function fields(p: PatientResponse): UpdatePatientRequest {
  return {
    nameGiven: p.nameGiven,
    nameFamily: p.nameFamily,
    gender: p.gender,
    phone: p.phone ?? "",
    email: p.email ?? "",
  };
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-0.5 font-medium text-slate-800 ${mono ? "font-mono text-sm" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
