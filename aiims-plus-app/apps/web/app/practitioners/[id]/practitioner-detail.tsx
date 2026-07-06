"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import type { PractitionerResponse, UpdatePractitionerRequest } from "@aiims/api-contracts";
import { Avatar, Badge, Button, Card, Field, IconEdit, Select, TextInput } from "@aiims/ui-web";

/** View + edit with optimistic-concurrency reconcile (FEDR-0011, DDR-0009).
 *  The linked user (appUserId) is shown read-only — it is immutable. */
export function PractitionerDetail({
  practitioner,
  roleWarning,
}: {
  practitioner: PractitionerResponse;
  roleWarning: boolean;
}) {
  const [current, setCurrent] = useState(practitioner);
  const [editing, setEditing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<UpdatePractitionerRequest>({
    defaultValues: {
      nameGiven: practitioner.nameGiven,
      nameFamily: practitioner.nameFamily,
      status: practitioner.status,
    },
  });

  async function onSubmit(values: UpdatePractitionerRequest) {
    setError(null);
    setConflict(false);
    const res = await fetch(`/api/bff/practitioners/${current.id}`, {
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
    const res = await fetch(`/api/bff/practitioners/${current.id}`);
    if (res.ok) {
      const fresh = await res.json();
      setCurrent(fresh);
      reset({ nameGiven: fresh.nameGiven, nameFamily: fresh.nameFamily, status: fresh.status });
      setConflict(false);
    }
  }

  const fullName = `${current.nameGiven} ${current.nameFamily}`;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 bg-slate-50/50 p-6">
        <Avatar name={fullName} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-slate-900">{fullName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="font-mono text-xs">{current.registrationNo}</span>
            {current.specialties[0] ? (
              <Badge tone="sky">{current.specialties[0].display}</Badge>
            ) : null}
            {current.status === "active" ? (
              <Badge tone="green">Active</Badge>
            ) : (
              <Badge tone="slate">Inactive</Badge>
            )}
          </div>
        </div>
        {!editing ? (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <IconEdit width={16} height={16} /> Edit
          </Button>
        ) : null}
      </div>

      <div className="p-6">
        {roleWarning ? (
          <div
            role="alert"
            className="mb-4 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
          >
            The linked user has <strong>no clinical role</strong> (doctor/nurse). This practitioner
            was created anyway — verify this is intended.
          </div>
        ) : null}
        {conflict ? (
          <div
            role="alert"
            className="mb-4 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
          >
            This record was changed by someone else.{" "}
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
            <Detail label="Registration" value={current.registrationNo} mono />
            <Detail label="Specialty" value={current.specialties[0]?.display ?? "—"} />
            <Detail label="Status" value={current.status} />
            <Detail label="Linked user (immutable)" value={current.appUserId} mono />
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
              <Field label="Status">
                <Select {...register("status")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </Field>
            </div>
            <p className="text-xs text-slate-400">
              The linked user cannot be changed. To reassign, deactivate this profile and create a
              new one.
            </p>
            <div className="flex gap-3 pt-2">
              <Button type="submit">Save changes</Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setEditing(false);
                  reset({
                    nameGiven: current.nameGiven,
                    nameFamily: current.nameFamily,
                    status: current.status,
                  });
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
