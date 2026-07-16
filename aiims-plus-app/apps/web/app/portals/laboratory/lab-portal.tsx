"use client";

import { useEffect, useState } from "react";
import { AppShell, Badge, Card, Empty, Stat, type NavItem } from "../../lib/app-shell";
import type { LabWorklistItem } from "@aiims/api-contracts";

const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", group: "Overview" },
  { key: "pending", label: "Pending Tests", group: "Worklist" },
  { key: "resulted", label: "Resulted", group: "Worklist" },
];

const FLAGS = ["normal", "high", "low", "critical"] as const;
type Flag = (typeof FLAGS)[number];
interface Line {
  analyte: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: Flag;
}
const blankLine = (): Line => ({
  analyte: "",
  value: "",
  unit: "",
  referenceRange: "",
  flag: "normal",
});

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

export function LabPortal({ userName, greeting }: { userName: string; greeting: string }) {
  const [items, setItems] = useState<LabWorklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const d = await fetch("/api/bff/lab/worklist").then((r) => (r.ok ? r.json() : { data: [] }));
    setItems(d.data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  const pending = items.filter((i) => i.reportId === null);
  const resulted = items.filter((i) => i.reportId !== null);
  const urgent = pending.filter((i) => i.priority !== "routine");

  const render = (key: string) => {
    if (loading) return <Card>Loading…</Card>;
    switch (key) {
      case "dashboard":
        return (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                label="Pending"
                value={`${pending.length}`}
                tone={pending.length ? "amber" : "slate"}
              />
              <Stat
                label="Urgent / STAT"
                value={`${urgent.length}`}
                tone={urgent.length ? "amber" : "slate"}
              />
              <Stat label="Resulted" value={`${resulted.length}`} tone="slate" />
              <Stat label="Total orders" value={`${items.length}`} tone="slate" />
            </div>
            <Card title="Pending tests">
              {pending.length === 0 ? (
                <Empty>No pending lab orders. 🎉</Empty>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {pending.slice(0, 5).map((i) => (
                    <li key={i.orderId} className="flex items-center justify-between py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{i.display}</p>
                        <p className="truncate text-sm text-slate-500">
                          {i.patientName} · ordered {fmt(i.orderedAt)}
                        </p>
                      </div>
                      <PriorityBadge priority={i.priority} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        );
      case "pending":
        return pending.length === 0 ? (
          <Card>
            <Empty>No pending lab orders.</Empty>
          </Card>
        ) : (
          <div className="space-y-4">
            {pending.map((i) => (
              <ResultEntry key={i.orderId} item={i} onDone={load} />
            ))}
          </div>
        );
      case "resulted":
        return (
          <Card title="Resulted tests">
            {resulted.length === 0 ? (
              <Empty>No results filed yet.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {resulted.map((i) => (
                  <li key={i.orderId} className="py-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-slate-800">{i.display}</p>
                      <Badge tone={i.reportStatus === "final" ? "green" : "amber"}>
                        {i.reportStatus}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500">
                      {i.patientName}
                      {i.issuedAt ? ` · ${fmt(i.issuedAt)}` : ""}
                    </p>
                    {i.conclusion ? (
                      <p className="mt-1 text-sm text-slate-700">{i.conclusion}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <AppShell
      appName="AIIMS+ Laboratory"
      roleLabel="Laboratory"
      userName={userName}
      greeting={greeting}
      nav={NAV}
      renderSection={render}
    />
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const tone = priority === "stat" ? "red" : priority === "urgent" ? "amber" : "slate";
  return <Badge tone={tone}>{priority}</Badge>;
}

function ResultEntry({ item, onDone }: { item: LabWorklistItem; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [conclusion, setConclusion] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function setLine(idx: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function submit() {
    if (!conclusion.trim() || busy) return;
    setBusy(true);
    setErr(null);
    const payload = {
      status: "final",
      conclusion: conclusion.trim(),
      lines: lines
        .filter((l) => l.analyte.trim() && l.value.trim())
        .map((l) => ({
          analyte: l.analyte.trim(),
          value: l.value.trim(),
          unit: l.unit.trim() || undefined,
          referenceRange: l.referenceRange.trim() || undefined,
          flag: l.flag,
        })),
    };
    try {
      const res = await fetch(`/api/bff/lab/orders/${item.orderId}/result`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Could not file result (${res.status})`);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not file result");
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-800">{item.display}</p>
          <p className="truncate text-sm text-slate-500">
            {item.patientName} · ordered {fmt(item.orderedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PriorityBadge priority={item.priority} />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="shrink-0 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            {open ? "Close" : "Enter result"}
          </button>
        </div>
      </div>

      {open ? (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Analytes</p>
            <div className="hidden grid-cols-[2fr_1fr_1fr_1.4fr_1fr] gap-2 text-xs text-slate-400 sm:grid">
              <span>Test</span>
              <span>Value</span>
              <span>Unit</span>
              <span>Reference range</span>
              <span>Flag</span>
            </div>
            {lines.map((l, idx) => (
              <div
                key={idx}
                className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_1.4fr_1fr]"
              >
                <input
                  value={l.analyte}
                  onChange={(e) => setLine(idx, { analyte: e.target.value })}
                  placeholder="Haemoglobin"
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
                <input
                  value={l.value}
                  onChange={(e) => setLine(idx, { value: e.target.value })}
                  placeholder="13.4"
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
                <input
                  value={l.unit}
                  onChange={(e) => setLine(idx, { unit: e.target.value })}
                  placeholder="g/dL"
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
                <input
                  value={l.referenceRange}
                  onChange={(e) => setLine(idx, { referenceRange: e.target.value })}
                  placeholder="12.0–15.5"
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
                <select
                  value={l.flag}
                  onChange={(e) => setLine(idx, { flag: e.target.value as Flag })}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                >
                  {FLAGS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLines((ls) => [...ls, blankLine()])}
              className="text-sm font-medium text-teal-700 hover:underline"
            >
              + Add analyte
            </button>
          </div>

          <textarea
            value={conclusion}
            onChange={(e) => setConclusion(e.target.value)}
            rows={2}
            placeholder="Impression / conclusion…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />

          {err ? <p className="text-sm text-red-600">{err}</p> : null}

          <button
            type="button"
            onClick={submit}
            disabled={!conclusion.trim() || busy}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {busy ? "Filing…" : "File result"}
          </button>
        </div>
      ) : null}
    </Card>
  );
}
