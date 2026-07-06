"use client";

import { useState } from "react";
import type { PractitionerResponse } from "@aiims/api-contracts";
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  IconPlus,
  IconSearch,
  IconStethoscope,
} from "@aiims/ui-web";

/** Practitioner directory: search + table. */
export function PractitionerList({
  initial,
  canManage,
}: {
  initial: PractitionerResponse[];
  canManage: boolean;
}) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/bff/practitioners?q=${encodeURIComponent(q)}`);
    const body = res.ok ? await res.json() : { data: [] };
    setRows(body.data ?? []);
    setLoading(false);
  }

  return (
    <section aria-labelledby="practitioners-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="practitioners-heading" className="text-2xl font-bold text-slate-900">
            Practitioners
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {rows.length} {rows.length === 1 ? "clinician" : "clinicians"} · staff directory
          </p>
        </div>
        {canManage ? (
          <a href="/practitioners/new">
            <Button>
              <IconPlus width={18} height={18} /> Add practitioner
            </Button>
          </a>
        ) : null}
      </div>

      <Card className="mt-6 overflow-hidden">
        <form
          onSubmit={runSearch}
          role="search"
          className="flex gap-2 border-b border-slate-100 p-4"
        >
          <label htmlFor="pq" className="sr-only">
            Search practitioners by name
          </label>
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <IconSearch width={18} height={18} />
            </span>
            <input
              id="pq"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm focus:border-teal-500"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </Button>
        </form>

        <DataTable
          rows={rows}
          rowKey={(p) => p.id}
          empty={
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <IconStethoscope width={32} height={32} />
              <p className="text-sm text-slate-500">No practitioners found</p>
              {canManage ? (
                <p className="text-xs">Use “Add practitioner” to register one.</p>
              ) : null}
            </div>
          }
          columns={[
            {
              header: "Practitioner",
              cell: (p) => (
                <a href={`/practitioners/${p.id}`} className="group flex items-center gap-3">
                  <Avatar name={`${p.nameGiven} ${p.nameFamily}`} size="sm" />
                  <span className="font-medium text-slate-900 group-hover:text-teal-700">
                    {p.nameGiven} {p.nameFamily}
                  </span>
                </a>
              ),
            },
            {
              header: "Registration",
              cell: (p) => (
                <span className="font-mono text-xs text-slate-600">{p.registrationNo}</span>
              ),
            },
            {
              header: "Specialty",
              cell: (p) =>
                p.specialties[0] ? <Badge tone="sky">{p.specialties[0].display}</Badge> : "—",
            },
            {
              header: "Status",
              cell: (p) =>
                p.status === "active" ? (
                  <Badge tone="green">Active</Badge>
                ) : (
                  <Badge tone="slate">Inactive</Badge>
                ),
            },
          ]}
        />
      </Card>
    </section>
  );
}
