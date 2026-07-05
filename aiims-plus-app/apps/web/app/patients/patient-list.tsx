"use client";

import { useState } from "react";
import type { PatientResponse } from "@aiims/api-contracts";
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  IconPatients,
  IconPlus,
  IconSearch,
} from "@aiims/ui-web";

/** Client worklist: search + table. PHI lives only in component state, never
 *  persisted (FEDR-0013); a fresh fetch replaces it each search. */
export function PatientList({
  initial,
  canCreate,
}: {
  initial: PatientResponse[];
  canCreate: boolean;
}) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/bff/patients?q=${encodeURIComponent(q)}`);
    const body = res.ok ? await res.json() : { data: [] };
    setRows(body.data ?? []);
    setLoading(false);
  }

  return (
    <section aria-labelledby="worklist-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="worklist-heading" className="text-2xl font-bold text-slate-900">
            Patients
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {rows.length} {rows.length === 1 ? "record" : "records"} · outpatient registry
          </p>
        </div>
        {canCreate ? (
          <a href="/patients/new">
            <Button>
              <IconPlus width={18} height={18} /> Register patient
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
          <label htmlFor="q" className="sr-only">
            Search by name or MRN
          </label>
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <IconSearch width={18} height={18} />
            </span>
            <input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or MRN…"
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
              <IconPatients width={32} height={32} />
              <p className="text-sm text-slate-500">No patients found</p>
              {canCreate ? (
                <p className="text-xs">Use “Register patient” to add the first record.</p>
              ) : null}
            </div>
          }
          columns={[
            {
              header: "Patient",
              cell: (p) => (
                <a href={`/patients/${p.id}`} className="flex items-center gap-3 group">
                  <Avatar name={`${p.nameGiven} ${p.nameFamily}`} size="sm" />
                  <div>
                    <div className="font-medium text-slate-900 group-hover:text-teal-700">
                      {p.nameGiven} {p.nameFamily}
                    </div>
                    <div className="text-xs text-slate-400">{p.birthDate}</div>
                  </div>
                </a>
              ),
            },
            {
              header: "MRN",
              cell: (p) => <span className="font-mono text-xs text-slate-600">{p.mrn}</span>,
            },
            {
              header: "Gender",
              cell: (p) => <Badge tone="slate">{p.gender}</Badge>,
            },
            {
              header: "ABHA",
              cell: (p) =>
                p.abhaAddress ? <Badge tone="green">Linked</Badge> : <Badge tone="slate">—</Badge>,
            },
          ]}
        />
      </Card>
    </section>
  );
}
