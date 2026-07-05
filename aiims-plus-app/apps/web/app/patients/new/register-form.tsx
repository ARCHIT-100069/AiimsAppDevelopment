"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { createPatientRequestSchema, type CreatePatientRequest } from "@aiims/api-contracts";
import { Button, Card, Field, Select, TextInput } from "@aiims/ui-web";

/** Registration form: RHF + the SAME Zod schema the API validates with
 *  (FEDR-0011). Client validation is UX only — the server is authoritative. */
export function RegisterForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreatePatientRequest>({ defaultValues: { requestAbha: true, gender: "unknown" } });
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(values: CreatePatientRequest) {
    setServerError(null);
    const parsed = createPatientRequestSchema.safeParse({
      ...values,
      phone: values.phone || undefined,
      email: values.email || undefined,
    });
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    const res = await fetch("/api/bff/patients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (res.status === 201 || res.status === 200) {
      const patient = await res.json();
      window.location.href = `/patients/${patient.id}`;
      return;
    }
    const problem = await res.json().catch(() => ({}));
    setServerError(problem.detail ?? problem.title ?? "Registration failed");
  }

  return (
    <Card className="max-w-2xl p-6 sm:p-8">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {serverError ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {serverError}
          </p>
        ) : null}

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-800">Demographics</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Given name" error={errors.nameGiven?.message}>
              <TextInput {...register("nameGiven", { required: "Required" })} autoComplete="off" />
            </Field>
            <Field label="Family name" error={errors.nameFamily?.message}>
              <TextInput {...register("nameFamily", { required: "Required" })} autoComplete="off" />
            </Field>
            <Field label="Gender" error={errors.gender?.message}>
              <Select {...register("gender")}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="unknown">Unknown</option>
              </Select>
            </Field>
            <Field label="Date of birth" error={errors.birthDate?.message}>
              <TextInput type="date" {...register("birthDate", { required: "Required" })} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-800">
            Contact (encrypted at rest)
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Phone"
              hint="Stored encrypted; searchable by exact match"
              error={errors.phone?.message}
            >
              <TextInput type="tel" {...register("phone")} placeholder="+91…" autoComplete="off" />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <TextInput type="email" {...register("email")} autoComplete="off" />
            </Field>
          </div>
        </fieldset>

        <label className="flex items-center gap-2.5 rounded-lg bg-teal-50/60 px-3 py-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-teal-600"
            {...register("requestAbha")}
          />
          Create an ABHA number for this patient{" "}
          <span className="text-xs text-slate-400">(mock)</span>
        </label>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Registering…" : "Register patient"}
          </Button>
          <a href="/patients">
            <Button variant="ghost" type="button">
              Cancel
            </Button>
          </a>
        </div>
      </form>
    </Card>
  );
}
