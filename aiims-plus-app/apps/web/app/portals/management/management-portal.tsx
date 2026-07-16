"use client";

import { useEffect, useState } from "react";
import { AppShell, Card, type NavItem } from "../../lib/app-shell";
import type { ManagementOverview } from "@aiims/api-contracts";

const NAV: NavItem[] = [
  { key: "dashboard", label: "Overview", group: "Analytics" },
  { key: "opd", label: "OPD & Clinical", group: "Analytics" },
  { key: "quality", label: "Quality (NABH)", group: "Analytics" },
];

// Categorical hues (validated, dataviz reference palette). Each segment is also
// text-labelled, so identity is never colour-alone.
const OPD_SEGMENTS = [
  { key: "booked", label: "Booked", color: "#2a78d6" },
  { key: "waiting", label: "Waiting", color: "#eda100" },
  { key: "inProgress", label: "In consult", color: "#1baf7a" },
  { key: "completed", label: "Completed", color: "#008300" },
  { key: "cancelled", label: "Cancelled / no-show", color: "#e34948" },
] as const;

const inr = (n: string | number) =>
  "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export function ManagementPortal({ userName, greeting }: { userName: string; greeting: string }) {
  const [ov, setOv] = useState<ManagementOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/bff/management/overview")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setOv(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const render = (key: string) => {
    if (loading) return <Card>Loading…</Card>;
    if (!ov) return <Card>Could not load analytics.</Card>;

    if (key === "opd")
      return (
        <>
          <OpdSection ov={ov} />
          <div className="grid gap-4 lg:grid-cols-2">
            <LabCard ov={ov} />
            <PharmacyCard ov={ov} />
          </div>
        </>
      );
    if (key === "quality") return <QualitySection ov={ov} />;

    // dashboard
    return (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="OPD today" value={`${ov.opd.total}`} sub={`${ov.opd.waiting} waiting now`} />
          <Kpi
            label="Revenue collected"
            value={inr(ov.revenue.paidTotal)}
            sub={`${ov.revenue.paidCount} invoices`}
            tone="teal"
          />
          <Kpi
            label="Outstanding"
            value={inr(ov.revenue.outstandingTotal)}
            sub="unpaid invoices"
            tone={Number(ov.revenue.outstandingTotal) > 0 ? "amber" : "slate"}
          />
          <Kpi
            label="Satisfaction"
            value={ov.satisfaction.count ? `${ov.satisfaction.avgRating}★` : "—"}
            sub={`${ov.satisfaction.count} responses`}
            tone="teal"
          />
        </div>
        <OpdSection ov={ov} />
        <div className="grid gap-4 lg:grid-cols-2">
          <LabCard ov={ov} />
          <PharmacyCard ov={ov} />
        </div>
      </>
    );
  };

  return (
    <AppShell
      appName="AIIMS+ Management"
      roleLabel="Management"
      userName={userName}
      greeting={greeting}
      nav={NAV}
      renderSection={render}
    />
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = "slate",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "slate" | "teal" | "amber";
}) {
  const tones = { slate: "text-slate-800", teal: "text-teal-700", amber: "text-amber-600" };
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

function OpdSection({ ov }: { ov: ManagementOverview }) {
  const segs = OPD_SEGMENTS.map((s) => ({
    ...s,
    n: ov.opd[s.key as keyof ManagementOverview["opd"]] as number,
  }));
  const total = segs.reduce((a, s) => a + s.n, 0);
  return (
    <Card title="Today's OPD">
      {total === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">No appointments scheduled today.</p>
      ) : (
        <>
          <div className="flex h-6 w-full gap-[2px] overflow-hidden rounded-lg">
            {segs
              .filter((s) => s.n > 0)
              .map((s) => (
                <div
                  key={s.key}
                  style={{ width: `${(s.n / total) * 100}%`, backgroundColor: s.color }}
                  title={`${s.label}: ${s.n}`}
                />
              ))}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            {segs.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-slate-600">{s.label}</span>
                <span className="ml-auto font-semibold text-slate-800">{s.n}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function SplitBar({
  a,
  b,
  aLabel,
  bLabel,
}: {
  a: number;
  b: number;
  aLabel: string;
  bLabel: string;
}) {
  const total = a + b || 1;
  return (
    <>
      <div className="flex h-6 w-full gap-[2px] overflow-hidden rounded-lg">
        {a > 0 ? (
          <div style={{ width: `${(a / total) * 100}%`, backgroundColor: "#eda100" }} />
        ) : null}
        {b > 0 ? (
          <div style={{ width: `${(b / total) * 100}%`, backgroundColor: "#008300" }} />
        ) : null}
      </div>
      <div className="mt-2 flex justify-between text-sm">
        <span className="flex items-center gap-2 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#eda100" }} />
          {aLabel} <span className="font-semibold text-slate-800">{a}</span>
        </span>
        <span className="flex items-center gap-2 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#008300" }} />
          {bLabel} <span className="font-semibold text-slate-800">{b}</span>
        </span>
      </div>
    </>
  );
}

function LabCard({ ov }: { ov: ManagementOverview }) {
  return (
    <Card title="Laboratory throughput">
      <SplitBar a={ov.lab.pending} b={ov.lab.resulted} aLabel="Pending" bLabel="Resulted" />
    </Card>
  );
}

function PharmacyCard({ ov }: { ov: ManagementOverview }) {
  return (
    <Card title="Pharmacy">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-2xl font-bold text-amber-600">{ov.pharmacy.activeRx}</p>
          <p className="text-xs text-slate-500">In queue</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-teal-700">{ov.pharmacy.dispensedRx}</p>
          <p className="text-xs text-slate-500">Dispensed</p>
        </div>
        <div>
          <p
            className={`text-2xl font-bold ${ov.pharmacy.lowStock ? "text-red-600" : "text-slate-800"}`}
          >
            {ov.pharmacy.lowStock}
          </p>
          <p className="text-xs text-slate-500">Low stock</p>
        </div>
      </div>
    </Card>
  );
}

function QualitySection({ ov }: { ov: ManagementOverview }) {
  const s = ov.satisfaction;
  return (
    <Card title="Patient satisfaction (NABH)">
      {s.count === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">No feedback yet.</p>
      ) : (
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-4xl font-bold text-teal-700">{s.avgRating}</p>
            <p className="text-amber-400">
              {"★".repeat(Math.round(s.avgRating))}
              <span className="text-slate-200">{"★".repeat(5 - Math.round(s.avgRating))}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">{s.count} responses</p>
          </div>
          <p className="text-sm text-slate-600">
            Average rating across all patient feedback. Quality teams review individual comments in
            the feedback log to close the loop on complaints.
          </p>
        </div>
      )}
    </Card>
  );
}
