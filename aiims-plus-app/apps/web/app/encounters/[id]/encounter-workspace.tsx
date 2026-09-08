"use client";

import { useState } from "react";
import type {
  ConditionResponse,
  EncounterResponse,
  InvoiceResponse,
  NoteResponse,
  ObservationResponse,
  OrderResponse,
  ResultResponse,
} from "@aiims/api-contracts";
import { Badge, Button, Card, Field, Select, TextInput } from "@aiims/ui-web";
import { formatDayMonthTime } from "../../lib/date";

/** Curated subset of seeded reference codes for the demo pickers. */
const VITALS = [
  { system: "loinc", code: "8867-4", display: "Heart rate", unit: "bpm" },
  { system: "loinc", code: "8310-5", display: "Body temperature", unit: "Cel" },
  { system: "loinc", code: "8480-6", display: "Systolic blood pressure", unit: "mmHg" },
  { system: "loinc", code: "2708-6", display: "Oxygen saturation", unit: "%" },
  { system: "loinc", code: "29463-7", display: "Body weight", unit: "kg" },
];
const DIAGNOSES = [
  { system: "icd-10", code: "R50.9", display: "Fever, unspecified" },
  { system: "icd-10", code: "I10", display: "Essential (primary) hypertension" },
  { system: "icd-10", code: "E11.9", display: "Type 2 diabetes mellitus" },
  { system: "icd-10", code: "J06.9", display: "Acute upper respiratory infection" },
];
const ORDERABLE = [
  { system: "loinc", code: "718-7", display: "Hemoglobin", category: "lab" as const },
  { system: "loinc", code: "2345-7", display: "Glucose", category: "lab" as const },
  { system: "loinc", code: "36643-5", display: "Chest X-Ray", category: "imaging" as const },
];

const emr = (path: string) => `/api/bff/emr/${path}`;

export function EncounterWorkspace({
  encounter: initialEncounter,
  attendingName,
  initialNotes,
  initialObservations,
  initialConditions,
  initialOrders,
  initialResults,
  initialInvoice,
  canDocument,
  canSign,
  canBill,
  canShare,
  canReview,
}: {
  encounter: EncounterResponse;
  /** Who this encounter actually belongs to — shown so any doctor/nurse
   *  opening it from a shared OPD queue always knows whose patient it is,
   *  even though documentation isn't hard-restricted to the assigned doctor. */
  attendingName: string | null;
  initialNotes: NoteResponse[];
  initialObservations: ObservationResponse[];
  initialConditions: ConditionResponse[];
  initialOrders: OrderResponse[];
  initialResults: ResultResponse[];
  initialInvoice: InvoiceResponse | null;
  canDocument: boolean;
  canSign: boolean;
  canBill: boolean;
  canShare: boolean;
  /** Only the ordering clinician releases a result to the patient. */
  canReview: boolean;
}) {
  const id = initialEncounter.id;
  const [encounter, setEncounter] = useState(initialEncounter);
  const [notes, setNotes] = useState(initialNotes);
  const [observations, setObservations] = useState(initialObservations);
  const [conditions, setConditions] = useState(initialConditions);
  const [orders, setOrders] = useState(initialOrders);
  const [results, setResults] = useState(initialResults);
  const [invoice, setInvoice] = useState<InvoiceResponse | null>(initialInvoice);
  const [shared, setShared] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // One flag for every mutating action on this page — a slow response
  // shouldn't let a doctor's second click file a duplicate diagnosis, order,
  // or payment while the first is still in flight.
  const [busy, setBusy] = useState(false);

  const signed = encounter.status === "finished" || encounter.signedAt !== null;
  const editable = canDocument && !signed;

  async function reload<T>(path: string, set: (v: T[]) => void) {
    const res = await fetch(emr(path));
    if (res.ok) set(((await res.json()).data ?? []) as T[]);
  }
  async function reloadEncounter() {
    const res = await fetch(emr(`encounters/${id}`));
    if (res.ok) setEncounter(await res.json());
  }
  async function post(
    path: string,
    body: unknown,
    headers: Record<string, string> = {},
    method: "POST" | "PATCH" = "POST",
  ) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(emr(path), {
        method,
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const p = await res.json().catch(() => ({}));
        setError(p.detail ?? p.title ?? "Request failed");
        return false;
      }
      return true;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="encounter-heading" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 id="encounter-heading" className="text-2xl font-bold text-slate-900">
            OPD encounter
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {encounter.class} · started {formatDayMonthTime(encounter.periodStart)}
          </p>
          <p className="mt-1 text-sm font-medium text-teal-700">
            Attending: {attendingName ?? "Unknown practitioner"}
          </p>
        </div>
        {signed ? (
          <Badge tone="green">Signed</Badge>
        ) : (
          <Badge tone="sky">{encounter.status.replace("_", " ")}</Badge>
        )}
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <ChiefComplaint
        encounter={encounter}
        editable={editable}
        busy={busy}
        onSave={async (text) => {
          if (
            await post(
              `encounters/${id}`,
              { chiefComplaint: text },
              { "if-match": String(encounter.version) },
              "PATCH",
            )
          ) {
            await reloadEncounter();
          }
        }}
      />

      <VitalsPanel
        observations={observations}
        editable={editable}
        busy={busy}
        onAdd={async (code, value) => {
          const v = VITALS.find((x) => x.code === code)!;
          if (
            await post(`encounters/${id}/observations`, {
              code: { system: v.system, code: v.code, display: v.display },
              valueNumeric: value,
              unit: v.unit,
            })
          )
            await reload(`encounters/${id}/observations`, setObservations);
        }}
      />

      <DiagnosisPanel
        conditions={conditions}
        editable={editable}
        busy={busy}
        onAdd={async (code) => {
          const d = DIAGNOSES.find((x) => x.code === code)!;
          if (
            await post(`encounters/${id}/conditions`, {
              code: { system: d.system, code: d.code, display: d.display },
              category: "diagnosis",
              clinicalStatus: "active",
            })
          )
            await reload(`encounters/${id}/conditions`, setConditions);
        }}
      />

      <NotesPanel
        notes={notes}
        canDocument={canDocument}
        editable={editable}
        busy={busy}
        onAdd={async (body) => {
          if (await post(`encounters/${id}/notes`, { body, noteType: "progress" }))
            await reload(`encounters/${id}/notes`, setNotes);
        }}
        onAmend={async (noteId, body, reason) => {
          if (await post(`notes/${noteId}/amend`, { body, reason }))
            await reload(`encounters/${id}/notes`, setNotes);
        }}
      />

      <OrdersPanel
        orders={orders}
        results={results}
        editable={editable}
        canReview={canReview}
        busy={busy}
        onAdd={async (code) => {
          const o = ORDERABLE.find((x) => x.code === code)!;
          if (
            await post(`encounters/${id}/orders`, {
              code: { system: o.system, code: o.code, display: o.display },
              category: o.category,
              priority: "routine",
            })
          )
            await reload(`encounters/${id}/orders`, setOrders);
        }}
        onReview={async (resultId, version) => {
          const ok = await post(
            `encounters/${id}/results/${resultId}/review`,
            {},
            { "if-match": String(version) },
          );
          if (ok) await reload(`encounters/${id}/results`, setResults);
        }}
      />

      {canSign && !signed ? (
        <SignPanel
          busy={busy}
          onSign={async () => {
            if (
              await post(
                `encounters/${id}/sign`,
                { attestation: true },
                { "if-match": String(encounter.version) },
              )
            )
              await reloadEncounter();
          }}
        />
      ) : null}

      <BillingPanel
        invoice={invoice}
        shared={shared}
        canBill={canBill}
        canShare={canShare}
        busy={busy}
        onGenerate={async () => {
          setError(null);
          setBusy(true);
          try {
            const res = await fetch(emr(`encounters/${id}/invoice`), {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: "{}",
            });
            if (res.ok) setInvoice(await res.json());
            else
              setError((await res.json().catch(() => ({}))).detail ?? "Could not generate invoice");
          } finally {
            setBusy(false);
          }
        }}
        onPay={async () => {
          if (!invoice) return;
          setError(null);
          setBusy(true);
          try {
            const res = await fetch(emr(`invoices/${invoice.id}/pay`), {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "idempotency-key": crypto.randomUUID(),
              },
              body: JSON.stringify({ method: "mock" }),
            });
            if (res.ok) setInvoice(await res.json());
            else setError((await res.json().catch(() => ({}))).detail ?? "Payment failed");
          } finally {
            setBusy(false);
          }
        }}
        onShare={async () => {
          setError(null);
          setBusy(true);
          try {
            const res = await fetch(emr(`encounters/${id}/share`), {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: "{}",
            });
            if (res.ok) {
              const body = await res.json();
              setShared(body.careContextRef);
            } else setError((await res.json().catch(() => ({}))).detail ?? "Share failed");
          } finally {
            setBusy(false);
          }
        }}
      />
    </section>
  );
}

function BillingPanel({
  invoice,
  shared,
  canBill,
  canShare,
  busy,
  onGenerate,
  onPay,
  onShare,
}: {
  invoice: InvoiceResponse | null;
  shared: string | null;
  canBill: boolean;
  canShare: boolean;
  busy: boolean;
  onGenerate: () => Promise<void>;
  onPay: () => Promise<void>;
  onShare: () => Promise<void>;
}) {
  const paid = invoice?.status === "paid";
  return (
    <Card className="p-6">
      <h2 className="text-sm font-semibold text-slate-700">Billing</h2>
      {!invoice ? (
        <div className="mt-3">
          {canBill ? (
            <Button type="button" variant="secondary" onClick={onGenerate} disabled={busy}>
              Generate invoice
            </Button>
          ) : (
            <p className="text-sm text-slate-400">No invoice yet.</p>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-slate-600">{invoice.invoiceNumber}</span>
            <Badge tone={paid ? "green" : "sky"}>{invoice.status}</Badge>
          </div>
          <ul className="space-y-1 text-sm text-slate-600">
            {invoice.lines.map((l) => (
              <li key={l.id} className="flex justify-between">
                <span>{l.description}</span>
                <span className="font-mono">
                  {invoice.currency} {l.lineAmount}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-semibold text-slate-800">
            <span>Total</span>
            <span className="font-mono">
              {invoice.currency} {invoice.total}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {!paid && canBill ? (
              <Button type="button" onClick={onPay} disabled={busy}>
                Take payment (mock)
              </Button>
            ) : null}
            {paid ? (
              <span className="text-xs text-slate-500">Paid · ref {invoice.paymentRef}</span>
            ) : null}
            {paid && canShare && !shared ? (
              <Button type="button" variant="secondary" onClick={onShare} disabled={busy}>
                Share on consent (ABDM)
              </Button>
            ) : null}
          </div>
          {shared ? (
            <p role="status" className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
              Care context shared · {shared}
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function ChiefComplaint({
  encounter,
  editable,
  busy,
  onSave,
}: {
  encounter: EncounterResponse;
  editable: boolean;
  busy: boolean;
  onSave: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState(encounter.chiefComplaint ?? "");
  return (
    <Card className="p-6">
      <h2 className="text-sm font-semibold text-slate-700">Chief complaint</h2>
      {editable ? (
        <div className="mt-3 flex gap-3">
          <div className="flex-1">
            <label htmlFor="cc" className="sr-only">
              Chief complaint
            </label>
            <TextInput
              id="cc"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. fever for 3 days"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onSave(text)}
            disabled={!text.trim() || busy}
          >
            Save
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-600">{encounter.chiefComplaint ?? "—"}</p>
      )}
    </Card>
  );
}

function VitalsPanel({
  observations,
  editable,
  busy,
  onAdd,
}: {
  observations: ObservationResponse[];
  editable: boolean;
  busy: boolean;
  onAdd: (code: string, value: number) => Promise<void>;
}) {
  const [code, setCode] = useState(VITALS[0]!.code);
  const [value, setValue] = useState("");
  return (
    <Card className="p-6">
      <h2 className="text-sm font-semibold text-slate-700">Vitals</h2>
      <ul className="mt-3 space-y-1 text-sm text-slate-600">
        {observations.length === 0 ? <li className="text-slate-400">No vitals recorded</li> : null}
        {observations.map((o) => (
          <li key={o.id}>
            {o.code.display}: <span className="font-medium">{o.valueNumeric ?? o.valueText}</span>{" "}
            {o.unit ?? ""}
          </li>
        ))}
      </ul>
      {editable ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Vital">
            <Select value={code} onChange={(e) => setCode(e.target.value)}>
              {VITALS.map((v) => (
                <option key={v.code} value={v.code}>
                  {v.display} ({v.unit})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Value">
            <TextInput
              type="number"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
          <Button
            type="button"
            variant="secondary"
            disabled={value === "" || busy}
            onClick={async () => {
              await onAdd(code, Number(value));
              setValue("");
            }}
          >
            Record
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function DiagnosisPanel({
  conditions,
  editable,
  busy,
  onAdd,
}: {
  conditions: ConditionResponse[];
  editable: boolean;
  busy: boolean;
  onAdd: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState(DIAGNOSES[0]!.code);
  return (
    <Card className="p-6">
      <h2 className="text-sm font-semibold text-slate-700">Diagnoses</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {conditions.length === 0 ? <li className="text-sm text-slate-400">None</li> : null}
        {conditions.map((c) => (
          <li key={c.id}>
            <Badge tone="amber">
              {c.code.display} ({c.code.code})
            </Badge>
          </li>
        ))}
      </ul>
      {editable ? (
        <div className="mt-4 flex items-end gap-3">
          <Field label="Diagnosis (ICD-10)">
            <Select value={code} onChange={(e) => setCode(e.target.value)}>
              {DIAGNOSES.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.display}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="button" variant="secondary" onClick={() => onAdd(code)} disabled={busy}>
            Add diagnosis
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function NotesPanel({
  notes,
  canDocument,
  editable,
  busy,
  onAdd,
  onAmend,
}: {
  notes: NoteResponse[];
  canDocument: boolean;
  editable: boolean;
  busy: boolean;
  onAdd: (body: string) => Promise<void>;
  onAmend: (noteId: string, body: string, reason: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  return (
    <Card className="p-6">
      <h2 className="text-sm font-semibold text-slate-700">Clinical notes</h2>
      <ul className="mt-3 space-y-3">
        {notes.length === 0 ? <li className="text-sm text-slate-400">No notes yet</li> : null}
        {notes.map((n) => (
          <li key={n.id} className="rounded-lg border border-slate-100 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-slate-400">
                {n.noteType} · v{n.version}
              </span>
              {canDocument ? (
                <AmendControl busy={busy} onAmend={(b, r) => onAmend(n.noteId, b, r)} />
              ) : null}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{n.body}</p>
          </li>
        ))}
      </ul>
      {editable ? (
        <div className="mt-4">
          <label htmlFor="note" className="sr-only">
            New note
          </label>
          <textarea
            id="note"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Progress note…"
            className="w-full rounded-lg border border-slate-200 p-3 text-sm shadow-sm focus:border-teal-500"
          />
          <div className="mt-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!body.trim() || busy}
              onClick={async () => {
                await onAdd(body);
                setBody("");
              }}
            >
              Add note
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function AmendControl({
  busy,
  onAmend,
}: {
  busy: boolean;
  onAmend: (body: string, reason: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [reason, setReason] = useState("");
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-teal-700"
      >
        Amend
      </button>
    );
  return (
    <div className="w-full max-w-sm space-y-2">
      <label htmlFor="amend-body" className="sr-only">
        Amended note
      </label>
      <textarea
        id="amend-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Corrected text…"
        className="w-full rounded border border-slate-200 p-2 text-sm"
      />
      <label htmlFor="amend-reason" className="sr-only">
        Amendment reason
      </label>
      <input
        id="amend-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason"
        className="w-full rounded border border-slate-200 p-2 text-sm"
      />
      <Button
        type="button"
        size="sm"
        disabled={!body.trim() || !reason.trim() || busy}
        onClick={async () => {
          await onAmend(body, reason);
          setOpen(false);
        }}
      >
        Save amendment
      </Button>
    </div>
  );
}

function OrdersPanel({
  orders,
  results,
  editable,
  canReview,
  busy,
  onAdd,
  onReview,
}: {
  orders: OrderResponse[];
  results: ResultResponse[];
  editable: boolean;
  /** Only the ordering clinician releases a result to the patient. */
  canReview: boolean;
  busy: boolean;
  onAdd: (code: string) => Promise<void>;
  onReview: (resultId: string, version: number) => Promise<void>;
}) {
  const [code, setCode] = useState(ORDERABLE[0]!.code);
  return (
    <Card className="p-6">
      <h2 className="text-sm font-semibold text-slate-700">Orders &amp; results</h2>
      <ul className="mt-3 space-y-3 text-sm text-slate-600">
        {orders.length === 0 ? <li className="text-slate-400">No orders</li> : null}
        {orders.map((o) => {
          const result = results.find((r) => r.serviceRequestId === o.id);
          return (
            <li key={o.id}>
              <div className="flex items-center justify-between">
                <span>
                  {o.code.display} <span className="text-xs text-slate-400">({o.status})</span>
                </span>
                {!result ? <span className="text-xs text-slate-400">awaiting result</span> : null}
              </div>
              {result ? (
                <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                  <p className="text-sm text-slate-700">{result.conclusion}</p>
                  {result.lines.length > 0 ? (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="uppercase text-slate-400">
                            <th className="py-1 pr-3 font-medium">Test</th>
                            <th className="py-1 pr-3 font-medium">Result</th>
                            <th className="py-1 pr-3 font-medium">Reference</th>
                            <th className="py-1 font-medium">Flag</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.lines.map((l, i) => (
                            <tr key={i} className="border-t border-slate-200/70">
                              <td className="py-1 pr-3">{l.analyte}</td>
                              <td className="py-1 pr-3 font-mono">
                                {l.value} {l.unit ?? ""}
                              </td>
                              <td className="py-1 pr-3 text-slate-500">
                                {l.referenceRange ?? "—"}
                              </td>
                              <td className="py-1">
                                <Badge tone={l.flag === "normal" ? "green" : "amber"}>
                                  {l.flag}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between border-t border-slate-200/70 pt-2">
                    {result.reviewedAt ? (
                      <span className="text-xs text-slate-400">
                        Reviewed {formatDayMonthTime(result.reviewedAt)} — visible to the patient
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600">
                        Not yet reviewed — the patient can't see this result
                      </span>
                    )}
                    {!result.reviewedAt && canReview ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => onReview(result.id, result.version)}
                      >
                        Mark reviewed
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {editable ? (
        <div className="mt-4 flex items-end gap-3">
          <Field label="Order (lab / imaging)">
            <Select value={code} onChange={(e) => setCode(e.target.value)}>
              {ORDERABLE.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.display}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="button" variant="secondary" onClick={() => onAdd(code)} disabled={busy}>
            Place order
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function SignPanel({ busy, onSign }: { busy: boolean; onSign: () => Promise<void> }) {
  const [attest, setAttest] = useState(false);
  return (
    <Card className="border-teal-200 bg-teal-50/40 p-6">
      <h2 className="text-sm font-semibold text-slate-800">Sign &amp; finalize</h2>
      <p className="mt-1 text-sm text-slate-600">
        Signing locks this encounter. Corrections after signing are recorded as amendments.
      </p>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} />I
        attest this documentation is accurate and complete.
      </label>
      <div className="mt-3">
        <Button type="button" disabled={!attest || busy} onClick={onSign}>
          Sign encounter
        </Button>
      </div>
    </Card>
  );
}
