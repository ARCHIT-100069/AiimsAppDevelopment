"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import type { PatientResponse, UpdatePatientRequest } from "@aiims/api-contracts";
import { Avatar, Badge, Button, Card, Field, IconEdit, Select, TextInput } from "@aiims/ui-web";

/** View + edit with optimistic-concurrency reconcile (FEDR-0011, DDR-0009).
 *  A 409 tells the clinician the record changed and offers a refresh. */
export function PatientDetail({ patient }: { patient: PatientResponse }) {
  const [current, setCurrent] = useState(patient);
  const [editing, setEditing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<UpdatePatientRequest>({
    defaultValues: fields(patient),
  });

  async function onSubmit(values: UpdatePatientRequest) {
    setError(null);
    setConflict(false);
    const res = await fetch(`/api/bff/patients/${current.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "if-match": String(current.version) },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      setCurrent(await res.json());
      setEditing(false);
      return;
    }
    if (res.status === 409) return setConflict(true);
    const problem = await res.json().catch(() => ({}));
    setError(problem.detail ?? "Update failed");
  }

  async function refresh() {
    const res = await fetch(`/api/bff/patients/${current.id}`);
    if (res.ok) {
      const fresh = await res.json();
      setCurrent(fresh);
      reset(fields(fresh));
      setConflict(false);
    }
  }

  const fullName = `${current.nameGiven} ${current.nameFamily}`;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 bg-slate-50/50 p-6">
        <Avatar name={fullName} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-slate-900">{fullName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="font-mono text-xs">{current.mrn}</span>
            <span aria-hidden>·</span>
            <Badge tone="slate">{current.gender}</Badge>
            {current.abhaAddress ? <Badge tone="green">ABHA linked</Badge> : null}
          </div>
        </div>
        {!editing ? (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <IconEdit width={16} height={16} /> Edit
          </Button>
        ) : null}
      </div>

      <div className="p-6">
        {conflict ? (
          <div
            role="alert"
            className="mb-4 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
          >
            This patient was changed by someone else.{" "}
            <button type="button" className="font-semibold underline" onClick={refresh}>
              Load the latest version
            </button>{" "}
            before editing.
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {!editing ? (
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <Detail label="Date of birth" value={current.birthDate} />
            <Detail label="Gender" value={current.gender} />
            <Detail label="Phone" value={current.phone ?? "—"} />
            <Detail label="Email" value={current.email ?? "—"} />
            <Detail label="ABHA address" value={current.abhaAddress ?? "—"} />
            <Detail label="ABHA number" value={current.abhaNumber ?? "—"} mono />
          </dl>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Given name">
                <TextInput {...register("nameGiven")} />
              </Field>
              <Field label="Family name">
                <TextInput {...register("nameFamily")} />
              </Field>
              <Field label="Gender">
                <Select {...register("gender")}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="unknown">Unknown</option>
                </Select>
              </Field>
              <Field label="Phone">
                <TextInput type="tel" {...register("phone")} />
              </Field>
              <Field label="Email">
                <TextInput type="email" {...register("email")} />
              </Field>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit">Save changes</Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setEditing(false);
                  reset(fields(current));
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}

function fields(p: PatientResponse): UpdatePatientRequest {
  return {
    nameGiven: p.nameGiven,
    nameFamily: p.nameFamily,
    gender: p.gender,
    phone: p.phone ?? "",
    email: p.email ?? "",
  };
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-0.5 font-medium text-slate-800 ${mono ? "font-mono text-sm" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
