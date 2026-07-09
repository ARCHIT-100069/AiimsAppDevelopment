"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BookablePractitioner, MySummaryResponse } from "@aiims/api-contracts";

/* ---------------------------------- utils --------------------------------- */
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

type SectionKey =
  | "dashboard"
  | "profile"
  | "appointments"
  | "doctors"
  | "records"
  | "medications"
  | "labs"
  | "imaging"
  | "vitals"
  | "billing"
  | "documents"
  | "notifications"
  | "emergency"
  | "privacy"
  | "feedback"
  | "settings";

const NAV: { key: SectionKey; label: string; icon: string; group: string }[] = [
  { key: "dashboard", label: "Home Dashboard", icon: "🏠", group: "Overview" },
  { key: "profile", label: "My Profile", icon: "👤", group: "Overview" },
  { key: "appointments", label: "Appointments", icon: "📅", group: "Care" },
  { key: "doctors", label: "My Doctors", icon: "🩺", group: "Care" },
  { key: "records", label: "Medical Records", icon: "📋", group: "Care" },
  { key: "medications", label: "Medications", icon: "💊", group: "Care" },
  { key: "labs", label: "Lab Reports", icon: "🧪", group: "Results" },
  { key: "imaging", label: "Imaging", icon: "🩻", group: "Results" },
  { key: "vitals", label: "Vitals", icon: "❤️", group: "Results" },
  { key: "billing", label: "Billing", icon: "🧾", group: "Admin" },
  { key: "documents", label: "Documents", icon: "📎", group: "Admin" },
  { key: "notifications", label: "Notifications", icon: "🔔", group: "Admin" },
  { key: "emergency", label: "Emergency", icon: "🚑", group: "More" },
  { key: "privacy", label: "Privacy & Consent", icon: "🔒", group: "More" },
  { key: "feedback", label: "Feedback", icon: "💬", group: "More" },
  { key: "settings", label: "Settings", icon: "⚙️", group: "More" },
];

/* -------------------------------- primitives ------------------------------ */
function Card({
  title,
  action,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-6">
      {title ? (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="py-6 text-center text-sm text-slate-400">{children}</p>
);
function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    teal: "bg-teal-50 text-teal-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${tones[tone]}`}>
      {children}
    </span>
  );
}
function Row({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between py-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-800">{title}</p>
        {sub ? <p className="truncate text-sm text-slate-500">{sub}</p> : null}
      </div>
      {right}
    </li>
  );
}
function Stat({ label, value, tone = "teal" }: { label: string; value: string; tone?: string }) {
  const tones: Record<string, string> = {
    teal: "text-teal-700",
    amber: "text-amber-600",
    slate: "text-slate-700",
  };
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

/* --------------------------------- portal --------------------------------- */
export function PortalApp({
  me,
  practitioners,
}: {
  me: MySummaryResponse;
  practitioners: BookablePractitioner[];
}) {
  const [active, setActive] = useState<SectionKey>("dashboard");
  const now = Date.now();
  const upcoming = me.appointments
    .filter((a) => +new Date(a.startAt) >= now && a.status !== "cancelled")
    .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
  const outstanding = me.invoices.filter((i) => i.status !== "paid");

  const groups = [...new Set(NAV.map((n) => n.group))];

  return (
    <div className="app-bg min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="hidden border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="flex items-center gap-2 px-5 py-4 text-lg font-semibold text-teal-700">
          <span aria-hidden>✚</span> AIIMS+
          <span className="text-sm font-normal text-slate-400">Portal</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {groups.map((g) => (
            <div key={g} className="mb-1 mt-3">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {g}
              </p>
              {NAV.filter((n) => n.group === g).map((n) => (
                <button
                  key={n.key}
                  onClick={() => setActive(n.key)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                    active === n.key
                      ? "bg-teal-50 font-medium text-teal-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span aria-hidden>{n.icon}</span>
                  {n.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur">
          {/* Mobile section picker */}
          <select
            value={active}
            onChange={(e) => setActive(e.target.value as SectionKey)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm lg:hidden"
          >
            {NAV.map((n) => (
              <option key={n.key} value={n.key}>
                {n.label}
              </option>
            ))}
          </select>
          <h1 className="hidden text-lg font-semibold text-slate-800 lg:block">
            {NAV.find((n) => n.key === active)?.label}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              {me.profile.nameGiven} {me.profile.nameFamily}
            </span>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
              {me.profile.nameGiven[0]}
              {me.profile.nameFamily[0]}
            </div>
            <form action="/api/auth/logout" method="post">
              <button className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
                Log out
              </button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 p-6">
          {active === "dashboard" && (
            <Dashboard me={me} upcoming={upcoming} outstanding={outstanding} onGo={setActive} />
          )}
          {active === "profile" && <Profile me={me} />}
          {active === "appointments" && (
            <Appointments me={me} upcoming={upcoming} practitioners={practitioners} />
          )}
          {active === "doctors" && <Doctors practitioners={practitioners} />}
          {active === "records" && <Records me={me} />}
          {active === "medications" && (
            <ComingSoon
              title="Medications"
              note="No active prescriptions on file. Medications your doctor prescribes will appear here."
            />
          )}
          {active === "labs" && <Labs me={me} />}
          {active === "imaging" && (
            <ComingSoon
              title="Imaging"
              note="No imaging studies on file. X-ray, CT, MRI and ultrasound reports will appear here."
            />
          )}
          {active === "vitals" && <Vitals me={me} />}
          {active === "billing" && <Billing me={me} />}
          {active === "documents" && (
            <ComingSoon
              title="Documents"
              note="No documents uploaded yet. Discharge summaries and uploaded files will appear here."
            />
          )}
          {active === "notifications" && (
            <Notifications me={me} upcoming={upcoming} outstanding={outstanding} />
          )}
          {active === "emergency" && <Emergency me={me} />}
          {active === "privacy" && <Privacy />}
          {active === "feedback" && <Feedback />}
          {active === "settings" && <Settings />}
        </main>
      </div>
    </div>
  );
}

/* -------------------------------- sections -------------------------------- */
function Dashboard({
  me,
  upcoming,
  outstanding,
  onGo,
}: {
  me: MySummaryResponse;
  upcoming: MySummaryResponse["appointments"];
  outstanding: MySummaryResponse["invoices"];
  onGo: (s: SectionKey) => void;
}) {
  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Hello, {me.profile.nameGiven} 👋</h2>
        <p className="mt-1 text-sm text-slate-500">Here’s a snapshot of your health.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Upcoming" value={`${upcoming.length}`} />
        <Stat label="Diagnoses" value={`${me.diagnoses.length}`} tone="slate" />
        <Stat label="Lab reports" value={`${me.reports.length}`} tone="slate" />
        <Stat
          label="Due bills"
          value={outstanding.length ? `${outstanding.length}` : "0"}
          tone={outstanding.length ? "amber" : "slate"}
        />
      </div>
      <Card
        title="Next appointment"
        action={<Link onClick={() => onGo("appointments")}>View all</Link>}
      >
        {upcoming.length === 0 ? (
          <Empty>No upcoming appointments.</Empty>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800">{fmtDateTime(upcoming[0]!.startAt)}</p>
              <p className="text-sm text-slate-500">{upcoming[0]!.reasonText ?? "Consultation"}</p>
            </div>
            <Badge tone="teal">{upcoming[0]!.status.replace("_", " ")}</Badge>
          </div>
        )}
      </Card>
      <Card title="Recent diagnosis" action={<Link onClick={() => onGo("records")}>Records</Link>}>
        {me.diagnoses.length === 0 ? (
          <Empty>No diagnoses recorded.</Empty>
        ) : (
          <p className="text-slate-800">
            {me.diagnoses[0]!.display}{" "}
            <span className="text-sm text-slate-400">({me.diagnoses[0]!.code})</span>
          </p>
        )}
      </Card>
    </>
  );
}

function Profile({ me }: { me: MySummaryResponse }) {
  const p = me.profile;
  const fields: [string, string][] = [
    ["Full name", `${p.nameGiven} ${p.nameFamily}`],
    ["MRN", p.mrn],
    ["Date of birth", fmtDate(p.birthDate)],
    ["Gender", p.gender],
    ["ABHA address", p.abhaAddress ?? "—"],
  ];
  return (
    <Card title="My profile">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
        {fields.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs uppercase tracking-wide text-slate-400">{k}</dt>
            <dd className="mt-0.5 text-slate-800">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-xs text-slate-400">
        Contact details are encrypted at rest. To update your profile, contact the front desk.
      </p>
    </Card>
  );
}

function Appointments({
  me,
  upcoming,
  practitioners,
}: {
  me: MySummaryResponse;
  upcoming: MySummaryResponse["appointments"];
  practitioners: BookablePractitioner[];
}) {
  const past = me.appointments.filter((a) => !upcoming.includes(a));
  return (
    <>
      <BookCard practitioners={practitioners} />
      <Card title="Upcoming">
        {upcoming.length === 0 ? (
          <Empty>No upcoming appointments.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {upcoming.map((a) => (
              <Row
                key={a.id}
                title={fmtDateTime(a.startAt)}
                sub={a.reasonText ?? "Consultation"}
                right={<Badge tone="teal">{a.status.replace("_", " ")}</Badge>}
              />
            ))}
          </ul>
        )}
      </Card>
      <Card title="Past appointments">
        {past.length === 0 ? (
          <Empty>No past appointments.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {past.map((a) => (
              <Row
                key={a.id}
                title={fmtDateTime(a.startAt)}
                sub={a.reasonText ?? "Consultation"}
                right={<Badge>{a.status.replace("_", " ")}</Badge>}
              />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function BookCard({ practitioners }: { practitioners: BookablePractitioner[] }) {
  const router = useRouter();
  const [pracId, setPracId] = useState(practitioners[0]?.practitionerId ?? "");
  const [when, setWhen] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const canBook = pracId && when && !busy;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const prac = practitioners.find((p) => p.practitionerId === pracId);
    if (!prac || !when) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/bff/me/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          practitionerId: prac.practitionerId,
          facilityId: prac.facilityId,
          departmentId: prac.departmentId,
          startAt: new Date(when).toISOString(),
          reasonText: reason || undefined,
        }),
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Appointment booked!" });
        setWhen("");
        setReason("");
        router.refresh();
      } else {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        setMsg({ ok: false, text: body.detail ?? "Could not book — please try another time." });
      }
    } catch {
      setMsg({ ok: false, text: "Network error — please try again." });
    } finally {
      setBusy(false);
    }
  }

  if (practitioners.length === 0) {
    return (
      <Card title="Book an appointment">
        <Empty>No doctors are available for online booking right now.</Empty>
      </Card>
    );
  }
  return (
    <Card title="Book an appointment">
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          <span className="text-slate-500">Doctor</span>
          <select
            value={pracId}
            onChange={(e) => setPracId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            {practitioners.map((p) => (
              <option key={p.practitionerId} value={p.practitionerId}>
                {p.name} · {p.departmentName}
                {p.specialty ? ` (${p.specialty})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">Date &amp; time</span>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">Reason (optional)</span>
          <input
            type="text"
            value={reason}
            maxLength={200}
            placeholder="e.g. fever and cough"
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        {msg ? (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            {msg.text}
          </p>
        ) : null}
        <button
          disabled={!canBook}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {busy ? "Booking…" : "Book appointment"}
        </button>
      </form>
    </Card>
  );
}

function Doctors({ practitioners }: { practitioners: BookablePractitioner[] }) {
  return (
    <Card title="My doctors">
      {practitioners.length === 0 ? (
        <Empty>No doctors on record yet.</Empty>
      ) : (
        <ul className="divide-y divide-slate-100">
          {practitioners.map((p) => (
            <Row
              key={p.practitionerId}
              title={p.name}
              sub={`${p.departmentName}${p.specialty ? ` · ${p.specialty}` : ""} · ${p.facilityName}`}
              right={<Badge tone="teal">Available</Badge>}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function Records({ me }: { me: MySummaryResponse }) {
  return (
    <>
      <Card title="Visits">
        {me.visits.length === 0 ? (
          <Empty>No visits on record.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {me.visits.map((v) => (
              <Row
                key={v.id}
                title={v.chiefComplaint ?? "OPD visit"}
                sub={fmtDate(v.date)}
                right={<Badge tone={v.signed ? "green" : "amber"}>{v.status}</Badge>}
              />
            ))}
          </ul>
        )}
      </Card>
      <Card title="Diagnoses & conditions">
        {me.diagnoses.length === 0 ? (
          <Empty>No diagnoses recorded.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {me.diagnoses.map((d, i) => (
              <Row
                key={i}
                title={d.display}
                sub={`${d.code} · recorded ${fmtDate(d.recordedAt)}`}
                right={
                  <Badge tone={d.clinicalStatus === "active" ? "amber" : "slate"}>
                    {d.clinicalStatus}
                  </Badge>
                }
              />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Labs({ me }: { me: MySummaryResponse }) {
  return (
    <Card title="Lab reports">
      {me.reports.length === 0 ? (
        <Empty>No lab reports yet.</Empty>
      ) : (
        <ul className="divide-y divide-slate-100">
          {me.reports.map((r) => (
            <Row
              key={r.id}
              title={r.conclusion}
              sub={`Issued ${fmtDate(r.issuedAt)}`}
              right={<Badge tone={r.status === "final" ? "green" : "amber"}>{r.status}</Badge>}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function Vitals({ me }: { me: MySummaryResponse }) {
  return (
    <Card title="Vitals">
      {me.vitals.length === 0 ? (
        <Empty>No vitals recorded yet.</Empty>
      ) : (
        <ul className="divide-y divide-slate-100">
          {me.vitals.map((v) => (
            <Row
              key={v.id}
              title={v.display}
              sub={fmtDateTime(v.effectiveAt)}
              right={
                <span className="font-semibold text-slate-800">
                  {v.valueNumeric ?? v.valueText}
                  {v.unit ? ` ${v.unit}` : ""}
                </span>
              }
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function Billing({ me }: { me: MySummaryResponse }) {
  return (
    <Card title="Bills & payments">
      {me.invoices.length === 0 ? (
        <Empty>No invoices yet.</Empty>
      ) : (
        <ul className="divide-y divide-slate-100">
          {me.invoices.map((inv) => (
            <Row
              key={inv.invoiceNumber}
              title={inv.invoiceNumber}
              sub={`Issued ${fmtDate(inv.issuedAt)}`}
              right={
                <div className="text-right">
                  <p className="font-semibold text-slate-900">₹{inv.total}</p>
                  <Badge tone={inv.status === "paid" ? "green" : "amber"}>{inv.status}</Badge>
                </div>
              }
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function Notifications({
  me,
  upcoming,
  outstanding,
}: {
  me: MySummaryResponse;
  upcoming: MySummaryResponse["appointments"];
  outstanding: MySummaryResponse["invoices"];
}) {
  const items: { text: string; when: string; tone: string }[] = [];
  upcoming.forEach((a) =>
    items.push({ text: `Upcoming appointment`, when: fmtDateTime(a.startAt), tone: "teal" }),
  );
  outstanding.forEach((i) =>
    items.push({
      text: `Payment due — ${i.invoiceNumber} (₹${i.total})`,
      when: "Action needed",
      tone: "amber",
    }),
  );
  me.reports
    .slice(0, 3)
    .forEach((r) =>
      items.push({ text: `New report: ${r.conclusion}`, when: fmtDate(r.issuedAt), tone: "green" }),
    );
  return (
    <Card title="Notifications">
      {items.length === 0 ? (
        <Empty>You’re all caught up.</Empty>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((n, i) => (
            <Row key={i} title={n.text} sub={n.when} right={<Badge tone={n.tone}>new</Badge>} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function Emergency({ me }: { me: MySummaryResponse }) {
  return (
    <>
      <div className="card border-l-4 border-l-red-500 p-6">
        <h2 className="text-lg font-semibold text-slate-900">In an emergency</h2>
        <p className="mt-1 text-sm text-slate-500">
          Call the national ambulance helpline immediately.
        </p>
        <a
          href="tel:108"
          className="mt-4 inline-block rounded-lg bg-red-600 px-5 py-2.5 font-semibold text-white"
        >
          📞 Call 108
        </a>
      </div>
      <Card title="Emergency card">
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase text-slate-400">Patient</dt>
            <dd className="text-slate-800">
              {me.profile.nameGiven} {me.profile.nameFamily}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">MRN</dt>
            <dd className="text-slate-800">{me.profile.mrn}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">ABHA</dt>
            <dd className="text-slate-800">{me.profile.abhaAddress ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-400">Emergency contact</dt>
            <dd className="text-slate-400">Not on file</dd>
          </div>
        </dl>
      </Card>
    </>
  );
}

function Privacy() {
  const [share, setShare] = useState(true);
  const [research, setResearch] = useState(false);
  return (
    <>
      <Card title="Your data rights (DPDP)">
        <ul className="space-y-2 text-sm text-slate-600">
          <li>• Your identifiers (ABHA, phone, email) are encrypted at rest.</li>
          <li>• Every access to your record is logged in a tamper-evident audit trail.</li>
          <li>
            • You may request correction or erasure of your data, subject to medical-record law.
          </li>
        </ul>
      </Card>
      <Card title="Consent preferences">
        <Toggle label="Share my records with ABDM-linked providers" on={share} set={setShare} />
        <Toggle label="Allow anonymised use for research" on={research} set={setResearch} />
        <p className="mt-3 text-xs text-slate-400">Demo — preference changes are illustrative.</p>
      </Card>
    </>
  );
}

function Feedback() {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <Card title="Share feedback">
      {sent ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Thanks for your feedback! 💚
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) setSent(true);
          }}
          className="space-y-3"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Tell us about your experience…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            disabled={!text.trim()}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            Send feedback
          </button>
        </form>
      )}
    </Card>
  );
}

function Settings() {
  const [lang, setLang] = useState("English");
  const [notify, setNotify] = useState(true);
  return (
    <>
      <Card title="Preferences">
        <label className="block text-sm">
          <span className="text-slate-500">Language</span>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            {["English", "हिन्दी", "தமிழ்", "বাংলা"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <div className="mt-3">
          <Toggle label="Appointment reminders" on={notify} set={setNotify} />
        </div>
      </Card>
      <Card title="Account">
        <a
          href="http://localhost:8080/realms/aiims/account"
          target="_blank"
          rel="noreferrer"
          className="block rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Manage account &amp; password ↗
        </a>
        <form action="/api/auth/logout" method="post" className="mt-3">
          <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
            Log out
          </button>
        </form>
      </Card>
    </>
  );
}

/* --------------------------------- helpers -------------------------------- */
function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <Card title={title}>
      <Empty>{note}</Empty>
    </Card>
  );
}
function Link({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-sm font-medium text-teal-700 hover:underline">
      {children}
    </button>
  );
}
function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button
      onClick={() => set(!on)}
      className="flex w-full items-center justify-between py-2 text-left text-sm text-slate-700"
    >
      {label}
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-teal-600" : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            on ? "left-4" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}
