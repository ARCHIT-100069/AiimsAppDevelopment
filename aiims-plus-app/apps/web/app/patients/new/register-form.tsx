"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { createPatientRequestSchema, type CreatePatientRequest } from "@aiims/api-contracts";
import { Button, Field, Select, TextInput } from "@aiims/ui-web";

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
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-4" noValidate>
      {serverError ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Given name" error={errors.nameGiven?.message}>
          <TextInput {...register("nameGiven", { required: "Required" })} />
        </Field>
        <Field label="Family name" error={errors.nameFamily?.message}>
          <TextInput {...register("nameFamily", { required: "Required" })} />
        </Field>
        <Field label="Gender" error={errors.gender?.message}>
          <Select {...register("gender")}>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="unknown">Unknown</option>
          </Select>
        </Field>
        <Field label="Birth date" error={errors.birthDate?.message}>
          <TextInput type="date" {...register("birthDate", { required: "Required" })} />
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          <TextInput type="tel" {...register("phone")} placeholder="+91…" />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <TextInput type="email" {...register("email")} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register("requestAbha")} />
        Create a (mock) ABHA number for this patient
      </label>
      <div className="flex gap-3">
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
  );
}
