import { redirect } from "next/navigation";
import { IconChevronLeft } from "@aiims/ui-web";
import { AppShell, canManagePractitioners } from "../../patients/shell";
import { RegisterForm } from "./register-form";

export default async function NewPractitionerPage() {
  if (!(await canManagePractitioners())) redirect("/practitioners"); // server-authoritative (FEDR-0008)
  return (
    <AppShell active="Practitioners">
      <a
        href="/practitioners"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700"
      >
        <IconChevronLeft width={16} height={16} /> Back to practitioners
      </a>
      <h1 className="mb-6 mt-3 text-2xl font-bold text-slate-900">Add practitioner</h1>
      <RegisterForm />
    </AppShell>
  );
}
