"use client";

import { useEffect, useState } from "react";
import { AppShell, Badge, Card, Empty, Stat, type NavItem } from "../../lib/app-shell";
import { formatDayMonthTime } from "../../lib/date";
import type { InvoiceListItem } from "@aiims/api-contracts";

const PAY_METHODS = [
  { code: "cash", label: "Cash" },
  { code: "upi", label: "UPI" },
  { code: "card", label: "Card" },
] as const;

const inr = (n: string | number) =>
  "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = formatDayMonthTime;

export function BillingPortal({
  userName,
  greeting,
  canManage,
}: {
  userName: string;
  greeting: string;
  /** billing:manage — front desk is the cashier (decision D-6.5). Admin has
   *  billing:read (oversight) but not this, so it sees the same numbers
   *  read-only instead of a "Take payment" button that would 403. */
  canManage: boolean;
}) {
  const nav: NavItem[] = [
    { key: "dashboard", label: "Dashboard", group: "Overview" },
    { key: "unpaid", label: canManage ? "Collect Payment" : "Pending Payments", group: "Cashier" },
    { key: "paid", label: "Paid Invoices", group: "Cashier" },
  ];
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const d = await fetch("/api/bff/invoices").then((r) => (r.ok ? r.json() : { data: [] }));
    setInvoices(d.data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  const unpaid = invoices.filter((i) => i.status === "issued");
  const paid = invoices.filter((i) => i.status === "paid");
  const collected = paid.reduce((a, i) => a + Number(i.total), 0);
  const outstanding = unpaid.reduce((a, i) => a + Number(i.total), 0);

  const render = (key: string) => {
    if (loading) return <Card>Loading…</Card>;
    switch (key) {
      case "dashboard":
        return (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Collected" value={inr(collected)} tone="teal" />
              <Stat
                label="Outstanding"
                value={inr(outstanding)}
                tone={outstanding ? "amber" : "slate"}
              />
              <Stat
                label="Unpaid bills"
                value={`${unpaid.length}`}
                tone={unpaid.length ? "amber" : "slate"}
              />
              <Stat label="Paid today" value={`${paid.length}`} tone="slate" />
            </div>
            <Card title="Awaiting payment">
              {unpaid.length === 0 ? (
                <Empty>All invoices are settled. 🎉</Empty>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {unpaid.slice(0, 6).map((i) => (
                    <li key={i.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-slate-800">{i.patientName}</p>
                        <p className="text-sm text-slate-500">
                          {i.invoiceNumber} · {fmt(i.issuedAt)}
                        </p>
                      </div>
                      <p className="font-semibold text-slate-900">{inr(i.total)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        );
      case "unpaid":
        if (unpaid.length === 0) {
          return (
            <Card>
              <Empty>No pending payments.</Empty>
            </Card>
          );
        }
        if (!canManage) {
          return (
            <div className="space-y-3">
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Read-only — taking payment is a front-desk action. This view is for oversight.
              </p>
              {unpaid.map((i) => (
                <Card key={i.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">{i.patientName}</p>
                      <p className="text-sm text-slate-500">
                        {i.invoiceNumber} · {fmt(i.issuedAt)}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-slate-900">{inr(i.total)}</p>
                  </div>
                </Card>
              ))}
            </div>
          );
        }
        return (
          <div className="space-y-3">
            {unpaid.map((i) => (
              <PayRow key={i.id} inv={i} onDone={load} />
            ))}
          </div>
        );
      case "paid":
        return (
          <Card title="Paid invoices">
            {paid.length === 0 ? (
              <Empty>No paid invoices yet.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {paid.map((i) => (
                  <li key={i.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-slate-800">{i.patientName}</p>
                      <p className="text-sm text-slate-500">
                        {i.invoiceNumber}
                        {i.paymentMethod ? ` · ${i.paymentMethod.toUpperCase()}` : ""}
                        {i.paidAt ? ` · ${fmt(i.paidAt)}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{inr(i.total)}</p>
                      <Badge tone="green">paid</Badge>
                    </div>
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
      appName="AIIMS+ Billing"
      roleLabel="Billing"
      userName={userName}
      greeting={greeting}
      nav={nav}
      renderSection={render}
    />
  );
}

function PayRow({ inv, onDone }: { inv: InvoiceListItem; onDone: () => void }) {
  const [method, setMethod] = useState<string>("cash");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pay() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/bff/invoices/${inv.id}/pay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method }),
      });
      if (!res.ok) throw new Error(`Payment failed (${res.status})`);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Payment failed");
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-800">{inv.patientName}</p>
          <p className="text-sm text-slate-500">
            {inv.invoiceNumber} · {fmt(inv.issuedAt)}
          </p>
        </div>
        <p className="text-lg font-bold text-slate-900">{inr(inv.total)}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {PAY_METHODS.map((m) => (
          <button
            key={m.code}
            type="button"
            onClick={() => setMethod(m.code)}
            className={`rounded-full border px-3 py-1 text-sm ${
              method === m.code
                ? "border-teal-600 bg-teal-50 font-medium text-teal-700"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {m.label}
          </button>
        ))}
        <button
          type="button"
          onClick={pay}
          disabled={busy}
          className="ml-auto rounded-full bg-teal-700 px-4 py-2 text-sm font-medium tracking-wide text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {busy ? "Processing…" : `Take payment · ${inr(inv.total)}`}
        </button>
      </div>
      {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
    </Card>
  );
}
