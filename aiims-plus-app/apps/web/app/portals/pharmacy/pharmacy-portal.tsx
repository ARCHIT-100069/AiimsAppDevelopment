"use client";

import { useEffect, useState } from "react";
import { AppShell, Badge, Card, Empty, Row, Stat, type NavItem } from "../../lib/app-shell";
import type { DrugResponse, PrescriptionResponse } from "@aiims/api-contracts";

const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", group: "Overview" },
  { key: "inventory", label: "Drug Inventory", group: "Stock" },
  { key: "add", label: "Add Drug", group: "Stock" },
  { key: "queue", label: "Prescription Queue", group: "Dispensing" },
  { key: "dispensed", label: "Dispensed", group: "Dispensing" },
];

export function PharmacyPortal({ userName, greeting }: { userName: string; greeting: string }) {
  const [drugs, setDrugs] = useState<DrugResponse[]>([]);
  const [rx, setRx] = useState<PrescriptionResponse[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [d, p] = await Promise.all([
      fetch("/api/bff/drugs").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/bff/prescriptions").then((r) => (r.ok ? r.json() : { data: [] })),
    ]);
    setDrugs(d.data ?? []);
    setRx(p.data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  const active = rx.filter((r) => r.status === "active");
  const dispensed = rx.filter((r) => r.status === "dispensed");
  const low = drugs.filter((d) => d.totalQty <= d.reorderLevel);

  const render = (key: string) => {
    if (loading) return <Card>Loading…</Card>;
    switch (key) {
      case "dashboard":
        return (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Drugs" value={`${drugs.length}`} />
              <Stat
                label="Low / out"
                value={`${low.length}`}
                tone={low.length ? "amber" : "slate"}
              />
              <Stat
                label="Queue"
                value={`${active.length}`}
                tone={active.length ? "amber" : "slate"}
              />
              <Stat label="Dispensed" value={`${dispensed.length}`} tone="slate" />
            </div>
            <Card title="Low / out of stock">
              {low.length === 0 ? (
                <Empty>All drugs above reorder level.</Empty>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {low.map((d) => (
                    <Row
                      key={d.id}
                      title={`${d.name} ${d.strength}`}
                      sub={`${d.form} · reorder at ${d.reorderLevel}`}
                      right={
                        <Badge tone={d.totalQty === 0 ? "red" : "amber"}>{d.totalQty} left</Badge>
                      }
                    />
                  ))}
                </ul>
              )}
            </Card>
          </>
        );
      case "inventory":
        return <Inventory drugs={drugs} onChanged={load} />;
      case "add":
        return <AddDrug onAdded={load} />;
      case "queue":
        return <Queue prescriptions={active} onDispensed={load} />;
      case "dispensed":
        return (
          <Card title="Dispensed prescriptions">
            {dispensed.length === 0 ? (
              <Empty>Nothing dispensed yet.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {dispensed.map((p) => (
                  <Row
                    key={p.id}
                    title={p.items.map((i) => `${i.drugName} ${i.dose}`).join(", ")}
                    sub={`${p.items.length} item(s) · ${new Date(p.createdAt).toLocaleDateString("en-IN")}`}
                    right={<Badge tone="green">dispensed</Badge>}
                  />
                ))}
              </ul>
            )}
          </Card>
        );
      default:
        return <Card>Section not found.</Card>;
    }
  };

  return (
    <AppShell
      appName="AIIMS+"
      roleLabel="Pharmacy Portal"
      greeting={greeting}
      userName={userName}
      nav={NAV}
      renderSection={render}
    />
  );
}

function Inventory({ drugs, onChanged }: { drugs: DrugResponse[]; onChanged: () => void }) {
  return (
    <Card title="Drug inventory">
      {drugs.length === 0 ? (
        <Empty>No drugs in the formulary. Add one from “Add Drug”.</Empty>
      ) : (
        <ul className="divide-y divide-slate-100">
          {drugs.map((d) => (
            <li key={d.id} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">
                    {d.name} {d.strength}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {d.form}
                    {d.category ? ` · ${d.category}` : ""}
                  </p>
                </div>
                <Badge
                  tone={d.totalQty === 0 ? "red" : d.totalQty <= d.reorderLevel ? "amber" : "green"}
                >
                  {d.totalQty} in stock
                </Badge>
              </div>
              <AddStock drugId={d.id} onAdded={onChanged} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AddStock({ drugId, onAdded }: { drugId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [batchNo, setBatchNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/bff/drugs/${drugId}/stock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ batchNo, expiryDate, quantity: Number(quantity), mrp: "0" }),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setBatchNo("");
      setExpiryDate("");
      setQuantity("");
      onAdded();
    } else {
      setMsg("Could not add stock.");
    }
  }

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-sm font-medium text-teal-700 hover:underline"
      >
        + Receive stock
      </button>
    );
  return (
    <form onSubmit={submit} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <input
        required
        placeholder="Batch no"
        value={batchNo}
        onChange={(e) => setBatchNo(e.target.value)}
        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      <input
        required
        type="date"
        value={expiryDate}
        onChange={(e) => setExpiryDate(e.target.value)}
        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      <input
        required
        type="number"
        min={1}
        placeholder="Qty"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      <button
        disabled={busy}
        className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {busy ? "…" : "Add"}
      </button>
      {msg ? <p className="col-span-full text-sm text-red-600">{msg}</p> : null}
    </form>
  );
}

const FORMS = ["tablet", "capsule", "syrup", "injection", "ointment", "drops", "other"];
function AddDrug({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState("");
  const [form, setForm] = useState("tablet");
  const [strength, setStrength] = useState("");
  const [category, setCategory] = useState("");
  const [reorderLevel, setReorderLevel] = useState("50");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/bff/drugs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        form,
        strength,
        category: category || undefined,
        reorderLevel: Number(reorderLevel) || 0,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, t: `${name} added to the formulary.` });
      setName("");
      setStrength("");
      setCategory("");
      onAdded();
    } else {
      const b = (await res.json().catch(() => ({}))) as { detail?: string };
      setMsg({ ok: false, t: b.detail ?? "Could not add drug." });
    }
  }

  return (
    <Card title="Add a drug to the formulary">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-slate-500">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-500">Strength</span>
          <input
            required
            placeholder="e.g. 500 mg"
            value={strength}
            onChange={(e) => setStrength(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-500">Form</span>
          <select
            value={form}
            onChange={(e) => setForm(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 capitalize"
          >
            {FORMS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-500">Category (optional)</span>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-500">Reorder level</span>
          <input
            type="number"
            min={0}
            value={reorderLevel}
            onChange={(e) => setReorderLevel(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <div className="flex items-end">
          <button
            disabled={busy}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add drug"}
          </button>
        </div>
        {msg ? (
          <p
            className={`col-span-full rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
          >
            {msg.t}
          </p>
        ) : null}
      </form>
    </Card>
  );
}

function Queue({
  prescriptions,
  onDispensed,
}: {
  prescriptions: PrescriptionResponse[];
  onDispensed: () => void;
}) {
  return (
    <Card title="Prescription queue">
      {prescriptions.length === 0 ? (
        <Empty>Queue is empty.</Empty>
      ) : (
        <ul className="divide-y divide-slate-100">
          {prescriptions.map((p) => (
            <DispenseRow key={p.id} p={p} onDispensed={onDispensed} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function DispenseRow({ p, onDispensed }: { p: PrescriptionResponse; onDispensed: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function dispense() {
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/bff/prescriptions/${p.id}/dispense`, { method: "POST" });
    setBusy(false);
    if (res.ok) onDispensed();
    else {
      const b = (await res.json().catch(() => ({}))) as { detail?: string };
      setErr(b.detail ?? "Dispense failed.");
    }
  }
  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-800">
            {p.items.map((i) => `${i.drugName} ${i.dose} × ${i.quantity}`).join(", ")}
          </p>
          <p className="truncate text-sm text-slate-500">
            {p.items.map((i) => i.frequency).join(", ")} ·{" "}
            {new Date(p.createdAt).toLocaleString("en-IN")}
          </p>
        </div>
        <button
          type="button"
          onClick={dispense}
          disabled={busy}
          className="shrink-0 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {busy ? "…" : "Dispense"}
        </button>
      </div>
      {err ? <p className="mt-1 text-sm text-red-600">{err}</p> : null}
    </li>
  );
}
