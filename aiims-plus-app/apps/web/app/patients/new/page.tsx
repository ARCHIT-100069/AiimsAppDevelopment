import { redirect } from "next/navigation";
import { IconChevronLeft } from "@aiims/ui-web";
import { AppShell, canRegisterPatients } from "../shell";
import { RegisterForm } from "./register-form";

export default async function NewPatientPage() {
  if (!(await canRegisterPatients())) redirect("/patients"); // server-authoritative (FEDR-0008)
  return (
    <AppShell>
      <a
        href="/patients"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700"
      >
        <IconChevronLeft width={16} height={16} /> Back to patients
      </a>
      <h1 className="mb-6 mt-3 text-2xl font-bold text-slate-900">Register patient</h1>
      <RegisterForm />
    </AppShell>
  );
}
