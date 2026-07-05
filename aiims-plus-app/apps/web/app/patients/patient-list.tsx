"use client";

import { useState } from "react";
import type { PatientResponse } from "@aiims/api-contracts";
import { Button, DataTable, TextInput } from "@aiims/ui-web";

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
      <div className="flex items-center justify-between">
        <h1 id="worklist-heading" className="text-xl font-bold">
          Patients
        </h1>
        {canCreate ? (
          <a href="/patients/new">
            <Button>Register patient</Button>
          </a>
        ) : null}
      </div>

      <form onSubmit={runSearch} className="mt-4 flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Search by name or MRN
        </label>
        <TextInput
          id="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or MRN"
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-2">
        <DataTable
          rows={rows}
          rowKey={(p) => p.id}
          empty="No patients found"
          columns={[
            { header: "MRN", cell: (p) => p.mrn },
            {
              header: "Name",
              cell: (p) => (
                <a className="text-sky-800 hover:underline" href={`/patients/${p.id}`}>
                  {p.nameGiven} {p.nameFamily}
                </a>
              ),
            },
            { header: "Gender", cell: (p) => p.gender },
            { header: "Birth date", cell: (p) => p.birthDate },
            { header: "ABHA", cell: (p) => p.abhaAddress ?? "—" },
          ]}
        />
      </div>
    </section>
  );
}
