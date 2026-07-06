"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type {
  CreatePractitionerRequest,
  DepartmentResponse,
  ReferenceCodeResponse,
  UserResponse,
} from "@aiims/api-contracts";
import { Button, Card, Field, Select, TextInput } from "@aiims/ui-web";

interface FormValues {
  appUserId: string;
  registrationNo: string;
  departmentId: string;
  specialtyCode: string;
}

/** Practitioner registration: link an existing user, department, specialty.
 *  Surfaces the non-blocking role warning (decision i) on success. */
export function RegisterForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [specialties, setSpecialties] = useState<ReferenceCodeResponse[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [u, d, s] = await Promise.all([
        fetch("/api/bff/users?limit=100").then((r) => (r.ok ? r.json() : { data: [] })),
        fetch("/api/bff/departments?limit=100").then((r) => (r.ok ? r.json() : { data: [] })),
        fetch("/api/bff/specialties").then((r) => (r.ok ? r.json() : { data: [] })),
      ]);
      setUsers(u.data ?? []);
      setDepartments(d.data ?? []);
      setSpecialties(s.data ?? []);
    })();
  }, []);

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const specialty = specialties.find((s) => s.code === values.specialtyCode);
    const body: CreatePractitionerRequest = {
      appUserId: values.appUserId,
      registrationNo: values.registrationNo,
      ...(values.departmentId ? { departmentId: values.departmentId } : {}),
      specialties: specialty
        ? [{ system: "specialty", code: specialty.code, display: specialty.display }]
        : [],
    };

    const res = await fetch("/api/bff/practitioners", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 201) {
      const created = await res.json();
      const warn = created.warnings?.[0]?.code;
      const suffix = warn ? "?warning=LINKED_USER_NOT_CLINICAL" : "";
      window.location.href = `/practitioners/${created.id}${suffix}`;
      return;
    }
    const problem = await res.json().catch(() => ({}));
    setServerError(problem.detail ?? problem.title ?? "Could not create practitioner");
  }

  return (
    <Card className="max-w-2xl p-6 sm:p-8">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {serverError ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {serverError}
          </p>
        ) : null}

        <div>
          <Field label="Linked user" error={errors.appUserId?.message}>
            <Select {...register("appUserId", { required: "Select a user" })} defaultValue="">
              <option value="" disabled>
                Select a user…
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName} ({u.roles.join(", ") || "no role"})
                </option>
              ))}
            </Select>
          </Field>
          <p className="mt-1 text-xs text-slate-400">
            The staff login this clinical profile belongs to — cannot be changed later.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Registration number" error={errors.registrationNo?.message}>
            <TextInput
              {...register("registrationNo", { required: "Required" })}
              placeholder="e.g. MCI-12345"
              autoComplete="off"
            />
          </Field>
          <Field label="Department">
            <Select {...register("departmentId")} defaultValue="">
              <option value="">— None —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Specialty">
            <Select {...register("specialtyCode")} defaultValue="">
              <option value="">— None —</option>
              {specialties.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.display}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Adding…" : "Add practitioner"}
          </Button>
          <a href="/practitioners">
            <Button variant="ghost" type="button">
              Cancel
            </Button>
          </a>
        </div>
      </form>
    </Card>
  );
}
