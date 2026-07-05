import { redirect } from "next/navigation";
import { AppShell, canRegisterPatients } from "../shell";
import { RegisterForm } from "./register-form";

export default async function NewPatientPage() {
  if (!(await canRegisterPatients())) redirect("/patients"); // server-authoritative (FEDR-0008)
  return (
    <AppShell>
      <h1 className="mb-6 text-xl font-bold">Register patient</h1>
      <RegisterForm />
    </AppShell>
  );
}
