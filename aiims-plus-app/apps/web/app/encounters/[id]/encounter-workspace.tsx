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
  { system: "loinc", code: "718-7", display: "Hemoglobin" },
  { system: "loinc", code: "2345-7", display: "Glucose" },
];

const emr = (path: string) => `/api/bff/emr/${path}`;

export function EncounterWorkspace({
  encounter: initialEncounter,
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
}: {
  encounter: EncounterResponse;
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
}) {
  const id = initialEncounter.id;
  const [encounter, setEncounter] = useState(initialEncounter);
  const [notes, setNotes] = useState(initialNotes);
  const [observations, setObservations] = useState(initialObservations);
  const [conditions, setConditions] = useState(initialConditions);
  const [orders, setOrders] = useState(initialOrders);
  const [results] = useState(initialResults);
  const [invoice, setInvoice] = useState<InvoiceResponse | null>(initialInvoice);
  const [shared, setShared] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
    setError(null);
    const res = await fetch(emr(path), {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const p = await res.json().catch(() => ({}));
      setError(p.detail ?? p.title ?? "Request failed");
      return false;
    }
    return true;
  }

  return (
    <section aria-labelledby="encounter-heading" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 id="encounter-heading" className="text-2xl font-bold text-slate-900">
            OPD encounter
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {encounter.class} · started {new Date(encounter.periodStart).toLocaleString()}
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
        onSave={async (text) => {
          if (
            await post(
              `encounters/${id}`,
              { chiefComplaint: text },
              { "if-match": String(encounter.version) },
            )
          ) {
            await reloadEncounter();
          }
        }}
      />

      <VitalsPanel
        observations={observations}
        editable={editable}
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
        onAdd={async (code) => {
          const o = ORDERABLE.find((x) => x.code === code)!;
          if (
            await post(`encounters/${id}/orders`, {
              code: { system: o.system, code: o.code, display: o.display },
              priority: "routine",
            })
          )
            await reload(`encounters/${id}/orders`, setOrders);
        }}
      />

      {canSign && !signed ? (
        <SignPanel
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
        onGenerate={async () => {
          setError(null);
          const res = await fetch(emr(`encounters/${id}/invoice`), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
          });
          if (res.ok) setInvoice(await res.json());
          else
            setError((await res.json().catch(() => ({}))).detail ?? "Could not generate invoice");
        }}
        onPay={async () => {
          if (!invoice) return;
          setError(null);
          const res = await fetch(emr(`invoices/${invoice.id}/pay`), {
            method: "POST",
            headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
            body: JSON.stringify({ method: "mock" }),
          });
          if (res.ok) setInvoice(await res.json());
          else setError((await res.json().catch(() => ({}))).detail ?? "Payment failed");
        }}
        onShare={async () => {
          setError(null);
          const res = await fetch(emr(`encounters/${id}/share`), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
          });
          if (res.ok) {
            const body = await res.json();
            setShared(body.careContextRef);
          } else setError((await res.json().catch(() => ({}))).detail ?? "Share failed");
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
  onGenerate,
  onPay,
  onShare,
}: {
  invoice: InvoiceResponse | null;
  shared: string | null;
  canBill: boolean;
  canShare: boolean;
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
            <Button type="button" variant="secondary" onClick={onGenerate}>
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
              <Button type="button" onClick={onPay}>
                Take payment (mock)
              </Button>
            ) : null}
            {paid ? (
              <span className="text-xs text-slate-500">Paid · ref {invoice.paymentRef}</span>
            ) : null}
            {paid && canShare && !shared ? (
              <Button type="button" variant="secondary" onClick={onShare}>
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
  onSave,
}: {
  encounter: EncounterResponse;
  editable: boolean;
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
            disabled={!text.trim()}
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
  onAdd,
}: {
  observations: ObservationResponse[];
  editable: boolean;
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
            disabled={value === ""}
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
  onAdd,
}: {
  conditions: ConditionResponse[];
  editable: boolean;
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
          <Button type="button" variant="secondary" onClick={() => onAdd(code)}>
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
  onAdd,
  onAmend,
}: {
  notes: NoteResponse[];
  canDocument: boolean;
  editable: boolean;
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
              {canDocument ? <AmendControl onAmend={(b, r) => onAmend(n.noteId, b, r)} /> : null}
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
              disabled={!body.trim()}
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

function AmendControl({ onAmend }: { onAmend: (body: string, reason: string) => Promise<void> }) {
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
        disabled={!body.trim() || !reason.trim()}
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
  onAdd,
}: {
  orders: OrderResponse[];
  results: ResultResponse[];
  editable: boolean;
  onAdd: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState(ORDERABLE[0]!.code);
  return (
    <Card className="p-6">
      <h2 className="text-sm font-semibold text-slate-700">Orders &amp; results</h2>
      <ul className="mt-3 space-y-1 text-sm text-slate-600">
        {orders.length === 0 ? <li className="text-slate-400">No orders</li> : null}
        {orders.map((o) => {
          const result = results.find((r) => r.serviceRequestId === o.id);
          return (
            <li key={o.id} className="flex items-center justify-between">
              <span>
                {o.code.display} <span className="text-xs text-slate-400">({o.status})</span>
              </span>
              {result ? (
                <Badge tone="green">{result.conclusion}</Badge>
              ) : (
                <span className="text-xs text-slate-400">awaiting result</span>
              )}
            </li>
          );
        })}
      </ul>
      {editable ? (
        <div className="mt-4 flex items-end gap-3">
          <Field label="Order (lab)">
            <Select value={code} onChange={(e) => setCode(e.target.value)}>
              {ORDERABLE.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.display}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="button" variant="secondary" onClick={() => onAdd(code)}>
            Place order
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function SignPanel({ onSign }: { onSign: () => Promise<void> }) {
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
        <Button type="button" disabled={!attest} onClick={onSign}>
          Sign encounter
        </Button>
      </div>
    </Card>
  );
}
