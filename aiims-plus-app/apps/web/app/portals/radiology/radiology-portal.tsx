"use client";

import { useEffect, useState } from "react";
import { AppShell, Badge, Card, Empty, Stat, type NavItem } from "../../lib/app-shell";
import { formatDayMonthTime } from "../../lib/date";
import type { LabWorklistItem } from "@aiims/api-contracts";

const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", group: "Overview" },
  { key: "pending", label: "Pending Studies", group: "Worklist" },
  { key: "reported", label: "Reported", group: "Worklist" },
];

const fmt = formatDayMonthTime;

export function RadiologyPortal({ userName, greeting }: { userName: string; greeting: string }) {
  const [items, setItems] = useState<LabWorklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const d = await fetch("/api/bff/lab/worklist?category=imaging").then((r) =>
      r.ok ? r.json() : { data: [] },
    );
    setItems(d.data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  const pending = items.filter((i) => i.reportId === null);
  const reported = items.filter((i) => i.reportId !== null);
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
              <Stat label="Reported" value={`${reported.length}`} tone="slate" />
              <Stat label="Total studies" value={`${items.length}`} tone="slate" />
            </div>
            <Card title="Pending studies">
              {pending.length === 0 ? (
                <Empty>No pending imaging studies. 🎉</Empty>
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
            <Empty>No pending imaging studies.</Empty>
          </Card>
        ) : (
          <div className="space-y-4">
            {pending.map((i) => (
              <ReportEntry key={i.orderId} item={i} onDone={load} />
            ))}
          </div>
        );
      case "reported":
        return (
          <Card title="Reported studies">
            {reported.length === 0 ? (
              <Empty>No reports filed yet.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {reported.map((i) => (
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
      appName="AIIMS+ Radiology"
      roleLabel="Radiology"
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

function ReportEntry({ item, onDone }: { item: LabWorklistItem; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [findings, setFindings] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!findings.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/bff/lab/orders/${item.orderId}/result`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "final", conclusion: findings.trim(), lines: [] }),
      });
      if (!res.ok) throw new Error(`Could not file report (${res.status})`);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not file report");
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
            className="shrink-0 rounded-full bg-teal-700 px-4 py-2 text-sm font-medium tracking-wide text-white hover:bg-teal-800"
          >
            {open ? "Close" : "Report study"}
          </button>
        </div>
      </div>

      {open ? (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <label className="block text-sm font-medium text-slate-700">Findings & impression</label>
          <textarea
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            rows={5}
            placeholder="Technique, findings, and radiological impression…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          <button
            type="button"
            onClick={submit}
            disabled={!findings.trim() || busy}
            className="rounded-full bg-teal-700 px-4 py-2 text-sm font-medium tracking-wide text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {busy ? "Filing…" : "File report"}
          </button>
        </div>
      ) : null}
    </Card>
  );
}
