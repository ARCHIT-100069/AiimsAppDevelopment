"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import type { PatientResponse, UpdatePatientRequest } from "@aiims/api-contracts";
import { Button, Field, Select, TextInput } from "@aiims/ui-web";

/** View + edit with optimistic-concurrency reconcile (FEDR-0011, DDR-0009).
 *  A 409 tells the clinician the record changed and offers a refresh. */
export function PatientDetail({ patient }: { patient: PatientResponse }) {
  const [current, setCurrent] = useState(patient);
  const [editing, setEditing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<UpdatePatientRequest>({
    defaultValues: {
      nameGiven: patient.nameGiven,
      nameFamily: patient.nameFamily,
      gender: patient.gender,
      phone: patient.phone ?? "",
      email: patient.email ?? "",
    },
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
    if (res.status === 409) {
      setConflict(true);
      return;
    }
    const problem = await res.json().catch(() => ({}));
    setError(problem.detail ?? "Update failed");
  }

  async function refresh() {
    const res = await fetch(`/api/bff/patients/${current.id}`);
    if (res.ok) {
      const fresh = await res.json();
      setCurrent(fresh);
      reset({
        nameGiven: fresh.nameGiven,
        nameFamily: fresh.nameFamily,
        gender: fresh.gender,
        phone: fresh.phone ?? "",
        email: fresh.email ?? "",
      });
      setConflict(false);
    }
  }

  if (!editing) {
    return (
      <article aria-labelledby="patient-name">
        <div className="flex items-center justify-between">
          <h1 id="patient-name" className="text-xl font-bold">
            {current.nameGiven} {current.nameFamily}
          </h1>
          <Button onClick={() => setEditing(true)}>Edit</Button>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <Detail label="MRN" value={current.mrn} />
          <Detail label="Gender" value={current.gender} />
          <Detail label="Birth date" value={current.birthDate} />
          <Detail label="Phone" value={current.phone ?? "—"} />
          <Detail label="Email" value={current.email ?? "—"} />
          <Detail label="ABHA address" value={current.abhaAddress ?? "—"} />
          <Detail label="ABHA number" value={current.abhaNumber ?? "—"} />
        </dl>
      </article>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-4" noValidate>
      {conflict ? (
        <div role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This patient was changed by someone else.{" "}
          <button type="button" className="font-semibold underline" onClick={refresh}>
            Load the latest version
          </button>{" "}
          before editing.
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-4">
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
      <div className="flex gap-3">
        <Button type="submit">Save</Button>
        <Button variant="ghost" type="button" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
