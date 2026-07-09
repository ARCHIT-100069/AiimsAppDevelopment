import { redirect } from "next/navigation";
import type { MySummaryResponse } from "@aiims/api-contracts";
import { IconCross } from "@aiims/ui-web";
import { apiFetch } from "../lib/api";
import { readSession } from "../lib/session";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function PortalPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const res = await apiFetch("/v1/me/summary");
  if (!res.ok) {
    // Not a patient token (or no record) → send staff to their app.
    if (res.status === 403) redirect("/patients");
    redirect("/login");
  }
  const me: MySummaryResponse = await res.json();
  const upcoming = me.appointments
    .filter((a) => new Date(a.startAt) >= new Date() && a.status !== "cancelled")
    .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
  const past = me.appointments.filter((a) => !upcoming.includes(a));

  return (
    <div className="app-bg min-h-screen">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2 font-semibold text-teal-700">
            <IconCross width={24} height={24} />
            AIIMS+ <span className="font-normal text-slate-400">· My Health</span>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
              Log out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-5 py-8">
        {/* Greeting + profile */}
        <section className="card p-6">
          <h1 className="text-2xl font-bold text-slate-900">Hello, {me.profile.nameGiven}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your health record at Demo Multispeciality Hospital.
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <Field label="Name" value={`${me.profile.nameGiven} ${me.profile.nameFamily}`} />
            <Field label="MRN" value={me.profile.mrn} />
            <Field label="Date of birth" value={fmtDate(me.profile.birthDate)} />
            <Field label="Gender" value={me.profile.gender} />
            <Field label="ABHA" value={me.profile.abhaAddress ?? "—"} />
          </dl>
        </section>

        {/* Upcoming appointments */}
        <Card title="Upcoming appointments">
          {upcoming.length === 0 ? (
            <Empty>No upcoming appointments.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-slate-800">{fmtDateTime(a.startAt)}</p>
                    <p className="text-sm text-slate-500">{a.reasonText ?? "Consultation"}</p>
                  </div>
                  <Badge tone="teal">{a.status.replace("_", " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Diagnoses */}
        <Card title="Diagnoses & conditions">
          {me.diagnoses.length === 0 ? (
            <Empty>No recorded diagnoses.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {me.diagnoses.map((d, i) => (
                <li key={i} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-slate-800">{d.display}</p>
                    <p className="text-sm text-slate-500">
                      {d.code} · recorded {fmtDate(d.recordedAt)}
                    </p>
                  </div>
                  <Badge tone={d.clinicalStatus === "active" ? "amber" : "slate"}>
                    {d.clinicalStatus}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Invoices */}
        <Card title="Bills & payments">
          {me.invoices.length === 0 ? (
            <Empty>No invoices yet.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {me.invoices.map((inv) => (
                <li key={inv.invoiceNumber} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-slate-800">{inv.invoiceNumber}</p>
                    <p className="text-sm text-slate-500">Issued {fmtDate(inv.issuedAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">₹{inv.total}</p>
                    <Badge tone={inv.status === "paid" ? "green" : "amber"}>{inv.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {past.length > 0 ? (
          <p className="px-1 text-xs text-slate-400">
            {past.length} past appointment{past.length > 1 ? "s" : ""} on file.
          </p>
        ) : null}
      </main>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{value}</dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-sm text-slate-400">{children}</p>;
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "teal" | "green" | "amber" | "slate";
}) {
  const tones: Record<string, string> = {
    teal: "bg-teal-50 text-teal-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${tones[tone]}`}>
      {children}
    </span>
  );
}
