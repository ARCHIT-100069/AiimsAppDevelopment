"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BookablePractitioner,
  MyQueuePosition,
  MySummaryResponse,
} from "@aiims/api-contracts";
import { MockSection, Splash } from "../lib/app-shell";
import { patientMock } from "../lib/mock";

/* ---------------------------------- utils --------------------------------- */
// A FIXED timeZone keeps these strings identical on the server and the client,
// so they never trigger a React hydration mismatch (which would silently kill
// interactivity in the App Router).
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
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

const NAV: { key: SectionKey; label: string; group: string }[] = [
  { key: "dashboard", label: "Home Dashboard", group: "Overview" },
  { key: "profile", label: "My Profile", group: "Overview" },
  { key: "appointments", label: "Appointments", group: "Care" },
  { key: "doctors", label: "My Doctors", group: "Care" },
  { key: "records", label: "Medical Records", group: "Care" },
  { key: "medications", label: "Medications", group: "Care" },
  { key: "labs", label: "Lab Reports", group: "Results" },
  { key: "imaging", label: "Imaging", group: "Results" },
  { key: "vitals", label: "Vitals", group: "Results" },
  { key: "billing", label: "Billing", group: "Admin" },
  { key: "documents", label: "Documents", group: "Admin" },
  { key: "notifications", label: "Notifications", group: "Admin" },
  { key: "emergency", label: "Emergency", group: "More" },
  { key: "privacy", label: "Privacy & Consent", group: "More" },
  { key: "feedback", label: "Feedback", group: "More" },
  { key: "settings", label: "Settings", group: "More" },
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
  // Start at 0 so the FIRST render (server + client hydration) is identical;
  // switch to the real clock only after mount. This avoids a hydration mismatch
  // in the upcoming/past split that would otherwise break interactivity.
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), []);

  const upcoming = me.appointments
    .filter((a) => +new Date(a.startAt) >= now && a.status !== "cancelled")
    .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
  const outstanding = me.invoices.filter((i) => i.status !== "paid");

  const groups = [...new Set(NAV.map((n) => n.group))];

  return (
    <div className="app-bg min-h-screen lg:flex">
      <Splash greeting="Patient" />
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex items-center gap-2 px-5 py-4 text-lg font-semibold text-teal-700">
          AIIMS+
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
                  {n.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex min-h-screen flex-1 flex-col">
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
          {active === "medications" && <Prescriptions me={me} />}
          {active === "labs" && <Labs me={me} />}
          {active === "imaging" && <Imaging me={me} />}
          {active === "vitals" && <Vitals me={me} />}
          {active === "billing" && <Billing me={me} />}
          {active === "documents" && <MockSection title="Documents" data={patientMock.documents} />}
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

/* --------------------------- live OPD token ------------------------------- */
function LiveToken() {
  const [pos, setPos] = useState<MyQueuePosition | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/bff/me/queue-position")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => alive && setPos(d))
        .catch(() => {});
    void load();
    // Refresh every 30s so the token count stays live while waiting.
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!pos || !pos.active) return null;
  const ahead = pos.ahead ?? 0;
  return (
    <div className="flex items-center justify-between rounded-[26px] bg-teal-600 p-5 text-white shadow-lg">
      <div>
        <p className="text-sm font-medium text-teal-50/80">You&apos;re checked in</p>
        <p className="mt-1 text-lg font-semibold">
          {ahead === 0
            ? "You're next — please be ready"
            : `${ahead} patient${ahead > 1 ? "s" : ""} ahead of you`}
        </p>
        {pos.practitionerName ? (
          <p className="text-sm text-teal-50/80">with Dr. {pos.practitionerName}</p>
        ) : null}
      </div>
      <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-white/15 text-center">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-teal-50/80">Token</p>
          <p className="text-3xl font-bold leading-none">{pos.token}</p>
        </div>
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
  const next = upcoming[0];
  const quick: { key: SectionKey; label: string; icon: keyof typeof ICONS }[] = [
    { key: "medications", label: "Medicines", icon: "pill" },
    { key: "appointments", label: "My Queue", icon: "ticket" },
    { key: "labs", label: "Lab Reports", icon: "flask" },
    { key: "billing", label: "Billing", icon: "receipt" },
  ];
  return (
    <>
      <SearchBar onGo={onGo} />

      <LiveToken />

      {/* Hero appointment */}
      <div className="hero-gradient rounded-[26px] p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-teal-900/70">
              {next ? "Your Appointment" : `Hello, ${me.profile.nameGiven}`}
            </p>
            <h2 className="mt-1 text-2xl font-bold leading-tight text-slate-900">
              {next ? (next.reasonText ?? "Consultation") : "No upcoming visit"}
            </h2>
          </div>
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/50 text-lg font-bold text-teal-700">
            {me.profile.nameGiven[0]}
            {me.profile.nameFamily[0]}
          </div>
        </div>
        {next ? (
          <div className="mt-4 space-y-1 rounded-2xl bg-slate-900/85 p-3 text-sm text-white">
            <div className="flex items-center gap-2">
              {ICONS.cal}
              {fmtDateTime(next.startAt)}
            </div>
            <div className="flex items-center gap-2 text-white/75">
              {ICONS.ticket}
              A-03 · APT-{next.id.slice(0, 8).toUpperCase()}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onGo("appointments")}
            className="mt-4 rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white"
          >
            Book an appointment
          </button>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-3">
        {quick.map((q) => (
          <button
            type="button"
            key={q.label}
            onClick={() => onGo(q.key)}
            className="qa-tile flex flex-col items-center gap-2 px-2 py-4"
          >
            <span className="text-teal-700">{ICONS[q.icon]}</span>
            <span className="text-xs font-medium text-slate-600">{q.label}</span>
          </button>
        ))}
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Upcoming" value={`${upcoming.length}`} />
        <Stat label="Diagnoses" value={`${me.diagnoses.length}`} tone="slate" />
        <Stat label="Lab reports" value={`${me.reports.length}`} tone="slate" />
        <Stat
          label="Due bills"
          value={`${outstanding.length}`}
          tone={outstanding.length ? "amber" : "slate"}
        />
      </div>

      <HealthTips />
    </>
  );
}

/* --------------------------------- icons ---------------------------------- */
const ICONS = {
  search: svg("M11 4a7 7 0 105 12l4 4 1.5-1.5-4-4A7 7 0 0011 4z"),
  cal: svg("M7 2v2M17 2v2M3 8h18M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z"),
  ticket: svg("M4 7h16v4a2 2 0 000 4v2H4v-2a2 2 0 000-4V7z"),
  pill: svg("M10.5 13.5l3-3M8 16a4 4 0 010-6l2-2a4 4 0 116 6l-2 2a4 4 0 01-6 0z"),
  flask: svg("M9 3h6M10 3v6l-5 9a1 1 0 001 1h12a1 1 0 001-1l-5-9V3"),
  receipt: svg("M6 3h12v18l-2-1.2L14 21l-2-1.2L10 21l-2-1.2L6 21V3zM9 8h6M9 12h6"),
} as const;

function svg(d: string) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

/* Interactive search that jumps to a section. */
function SearchBar({ onGo }: { onGo: (s: SectionKey) => void }) {
  const [q, setQ] = useState("");
  const matches = q
    ? NAV.filter((n) => n.label.toLowerCase().includes(q.toLowerCase())).slice(0, 5)
    : [];
  return (
    <div className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (matches[0]) {
            onGo(matches[0].key);
            setQ("");
          }
        }}
        className="search-field flex items-center gap-3 px-5 py-3"
      >
        <span className="text-slate-400">{ICONS.search}</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Need help?"
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </form>
      {matches.length > 0 ? (
        <div className="glass absolute z-20 mt-2 w-full overflow-hidden rounded-2xl p-1">
          {matches.map((m) => (
            <button
              type="button"
              key={m.key}
              onMouseDown={() => {
                onGo(m.key);
                setQ("");
              }}
              className="block w-full rounded-xl px-4 py-2 text-left text-sm text-slate-700 hover:bg-white/70"
            >
              {m.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const TIPS = [
  {
    tag: "Article",
    title: "Recovery Fuel",
    short: "Refuel with protein + carbs within 60 mins.",
    body: "After illness or exertion, a balanced snack within an hour helps your body repair. Aim for a mix of protein (eggs, dal, curd) and complex carbs (roti, rice, fruit), and stay hydrated with water or ORS.",
    img: "/images/tip-food.jpg",
  },
  {
    tag: "Article",
    title: "Protect Your Health",
    short: "Vaccinations and routine check-ups keep you healthy.",
    body: "Staying up to date on vaccines and annual check-ups helps catch issues early. Speak to your doctor about the flu shot, and screenings appropriate for your age and history.",
    img: "/images/tip-checkup.jpg",
  },
  {
    tag: "Tip",
    title: "Hydration Matters",
    short: "Aim for 6–8 glasses of water a day.",
    body: "Good hydration supports temperature control, digestion and energy. In fever or hot weather, increase fluids and watch for signs of dehydration like dark urine or dizziness.",
    img: "/images/tip-wellness.jpg",
  },
];

function HealthTips() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div>
      <h3 className="mb-3 text-lg font-bold text-slate-900">Health Tips</h3>
      <div className="space-y-3">
        {TIPS.map((t, i) => (
          <button
            type="button"
            key={t.title}
            onClick={() => setOpen(open === i ? null : i)}
            className="card flex w-full items-start gap-4 p-4 text-left"
          >
            <img src={t.img} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
            <div className="min-w-0">
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                {t.tag}
              </span>
              <p className="mt-1 font-semibold text-slate-800">{t.title}</p>
              <p className="text-sm text-slate-500">{open === i ? t.body : t.short}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ageFrom(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate font-medium text-slate-800">{value}</p>
    </div>
  );
}

function Profile({ me }: { me: MySummaryResponse }) {
  const p = me.profile;
  const age = ageFrom(p.birthDate);
  const initials = `${p.nameGiven[0] ?? ""}${p.nameFamily[0] ?? ""}`;
  const activeDx = me.diagnoses.filter((d) => d.clinicalStatus === "active").length;
  const meds = me.medications.length;
  const lastVisit = me.visits[0];

  const chips = [age !== null ? `${age} yrs` : null, p.gender, "Blood group O+"].filter(
    Boolean,
  ) as string[];

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="card overflow-hidden p-0">
        <div className="hero-gradient relative h-28" />
        <div className="px-6 pb-6">
          <div className="-mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-end">
            <div className="relative">
              <div className="grid h-24 w-24 place-items-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-400 text-2xl font-bold text-white shadow-lg ring-4 ring-white">
                {initials.toUpperCase()}
              </div>
              {/* verified badge */}
              <span
                title="ABHA verified"
                className="absolute -bottom-1.5 -right-1.5 grid h-7 w-7 place-items-center rounded-full bg-white text-teal-600 shadow ring-1 ring-slate-100"
              >
                <svg
                  viewBox="0 0 24 24"
                  width={16}
                  height={16}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
            </div>
            <div className="min-w-0 pb-1">
              <h2 className="text-2xl font-bold text-slate-900">
                {p.nameGiven} {p.nameFamily}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {p.mrn} · {p.abhaAddress ?? "ABHA not linked"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map((c) => (
              <span
                key={c}
                className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium capitalize text-teal-700"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Details */}
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Personal details
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <InfoTile label="Full name" value={`${p.nameGiven} ${p.nameFamily}`} />
          <InfoTile label="MRN" value={p.mrn} />
          <InfoTile
            label="Date of birth"
            value={`${fmtDate(p.birthDate)}${age !== null ? ` · ${age} yrs` : ""}`}
          />
          <InfoTile label="Gender" value={p.gender} />
          <InfoTile label="ABHA address" value={p.abhaAddress ?? "Not linked"} />
          <InfoTile label="Contact" value="Protected (encrypted)" />
        </div>
      </div>

      {/* Health snapshot */}
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Health snapshot
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Blood group" value="O+" tone="slate" />
          <Stat
            label="Active conditions"
            value={`${activeDx}`}
            tone={activeDx ? "amber" : "slate"}
          />
          <Stat label="Medications" value={`${meds}`} tone="slate" />
          <Stat label="Last visit" value={lastVisit ? fmtDate(lastVisit.date) : "—"} tone="slate" />
        </div>
        <Card title="Allergies & alerts">
          <ul className="divide-y divide-slate-100">
            <Row
              title="No known drug allergies"
              sub="Self-reported"
              right={<Badge tone="green">Clear</Badge>}
            />
            <Row
              title="Emergency contact"
              sub="Not on file"
              right={<Badge tone="amber">Add</Badge>}
            />
          </ul>
        </Card>
      </div>

      <p className="px-1 text-xs text-slate-400">
        Contact details are encrypted at rest. To update your profile, contact the front desk.
      </p>
    </div>
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

interface Slot {
  startAt: string;
  endAt: string;
}
const timeIST = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
/** Next 14 days as {value:yyyy-mm-dd, label} for the date chips. */
function nextDays(n: number): { value: string; label: string; dow: string }[] {
  const out: { value: string; label: string; dow: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.now() + i * 864e5);
    const value = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // yyyy-mm-dd
    out.push({
      value,
      label: d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      }),
      dow: d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }),
    });
  }
  return out;
}

function BookCard({ practitioners }: { practitioners: BookablePractitioner[] }) {
  const router = useRouter();
  const days = nextDays(14);
  const [pracId, setPracId] = useState(practitioners[0]?.practitionerId ?? "");
  const [date, setDate] = useState(days[0]?.value ?? "");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState<string>("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!pracId || !date) return;
    setLoadingSlots(true);
    setSlot("");
    fetch(`/api/bff/me/slots?practitionerId=${pracId}&date=${date}`)
      .then((r) => (r.ok ? r.json() : { slots: [] }))
      .then((d) => setSlots(d.slots ?? []))
      .finally(() => setLoadingSlots(false));
  }, [pracId, date]);

  async function confirm() {
    const prac = practitioners.find((p) => p.practitionerId === pracId);
    if (!prac || !slot) return;
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
          startAt: slot,
          reasonText: reason || undefined,
        }),
      });
      if (res.ok) {
        setMsg({ ok: true, text: `Appointment confirmed for ${timeIST(slot)}.` });
        setSlot("");
        setReason("");
        // refresh available slots + the rest of the portal
        fetch(`/api/bff/me/slots?practitionerId=${pracId}&date=${date}`)
          .then((r) => (r.ok ? r.json() : { slots: [] }))
          .then((d) => setSlots(d.slots ?? []));
        router.refresh();
      } else {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        setMsg({ ok: false, text: body.detail ?? "That slot is no longer available." });
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
  const prac = practitioners.find((p) => p.practitionerId === pracId);
  return (
    <Card title="Book an appointment">
      {/* Step 1 — doctor */}
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        1 · Doctor
      </p>
      <select
        value={pracId}
        onChange={(e) => setPracId(e.target.value)}
        className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      >
        {practitioners.map((p) => (
          <option key={p.practitionerId} value={p.practitionerId}>
            {p.name} · {p.departmentName}
            {p.specialty ? ` (${p.specialty})` : ""}
          </option>
        ))}
      </select>

      {/* Step 2 — date chips */}
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">2 · Date</p>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => (
          <button
            type="button"
            key={d.value}
            onClick={() => setDate(d.value)}
            className={`shrink-0 rounded-xl border px-3 py-2 text-center text-sm ${
              date === d.value
                ? "border-teal-600 bg-teal-600 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-teal-300"
            }`}
          >
            <span className="block text-[11px] opacity-80">{d.dow}</span>
            <span className="font-medium">{d.label}</span>
          </button>
        ))}
      </div>

      {/* Step 3 — slots */}
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        3 · Available time
      </p>
      {loadingSlots ? (
        <p className="py-4 text-sm text-slate-400">Checking availability…</p>
      ) : slots.length === 0 ? (
        <p className="py-4 text-sm text-slate-400">
          No free slots for {prac?.name} on this day. Try another date.
        </p>
      ) : (
        <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots.map((s) => (
            <button
              type="button"
              key={s.startAt}
              onClick={() => setSlot(s.startAt)}
              className={`rounded-lg border px-2 py-2 text-sm ${
                slot === s.startAt
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-teal-300"
              }`}
            >
              {timeIST(s.startAt)}
            </button>
          ))}
        </div>
      )}

      {/* Step 4 — reason + confirm */}
      {slot ? (
        <>
          <input
            type="text"
            value={reason}
            maxLength={200}
            placeholder="Reason (optional) — e.g. fever and cough"
            onChange={(e) => setReason(e.target.value)}
            className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={confirm}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {busy ? "Confirming…" : `Confirm ${timeIST(slot)} with ${prac?.name}`}
          </button>
        </>
      ) : null}
      {msg ? (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </p>
      ) : null}
    </Card>
  );
}

function Doctors({ practitioners }: { practitioners: BookablePractitioner[] }) {
  const [filter, setFilter] = useState<"all" | "general" | "specialist">("all");
  const isGeneral = (p: BookablePractitioner) =>
    !p.specialty || /general|medicine|opd/i.test(`${p.departmentName} ${p.specialty ?? ""}`);
  const shown = practitioners.filter((p) =>
    filter === "all" ? true : filter === "general" ? isGeneral(p) : !isGeneral(p),
  );
  const chips: [typeof filter, string, number][] = [
    ["all", "All", practitioners.length],
    ["general", "General", practitioners.filter(isGeneral).length],
    ["specialist", "Specialist", practitioners.filter((p) => !isGeneral(p)).length],
  ];
  return (
    <>
      <div className="flex gap-2">
        {chips.map(([key, label, count]) => (
          <button
            type="button"
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === key ? "bg-white text-slate-900 shadow" : "bg-white/50 text-slate-500"
            }`}
          >
            {label}
            <span
              className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs ${
                filter === key ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-600"
              }`}
            >
              {count}
            </span>
          </button>
        ))}
      </div>
      <Card title="My doctors">
        {shown.length === 0 ? (
          <Empty>No doctors in this category.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((p) => (
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
    </>
  );
}

function Prescriptions({ me }: { me: MySummaryResponse }) {
  const meds = me.medications;
  const dx = me.diagnoses[0];
  if (meds.length === 0) {
    return (
      <Card title="Medications">
        <Empty>No medications prescribed yet. Your prescriptions will appear here.</Empty>
      </Card>
    );
  }
  return (
    <div className="receipt p-6">
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-teal-50 to-sky-50 p-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-white text-sm font-bold text-teal-700">
          MR
        </div>
        <div>
          <p className="font-semibold text-slate-800">Dr. Meera Rao</p>
          <p className="text-xs text-slate-500">Internal Medicine · 15 min · Standard Check</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-teal-500" />
        <h3 className="font-semibold text-slate-800">Diagnosis</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {dx
          ? `${dx.display} (${dx.code}). Treated symptomatically; continue monitoring and complete the full course.`
          : "Acute upper respiratory infection (J06.9). Treated symptomatically; rest, fluids, and monitor temperature."}
      </p>

      <div className="my-4 border-t border-dashed border-slate-200" />

      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-teal-500" />
        <h3 className="font-semibold text-slate-800">Prescriptions</h3>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
        {meds.map((m) => (
          <div key={m.id}>
            <p className="text-sm font-medium text-slate-800">{m.name}</p>
            <p className="text-xs text-slate-500">
              {m.dose} · {m.frequency} · {m.duration}
              {m.status === "dispensed" ? " · dispensed" : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
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

function Imaging({ me }: { me: MySummaryResponse }) {
  const studies = me.reports.filter((r) => r.category === "imaging");
  if (studies.length === 0) return <MockSection title="Imaging" data={patientMock.imaging} />;
  return (
    <Card title="Imaging studies">
      <ul className="space-y-4">
        {studies.map((r) => (
          <li key={r.id} className="rounded-xl border border-slate-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-slate-800">{r.conclusion}</p>
              <Badge tone={r.status === "final" ? "green" : "amber"}>{r.status}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">Reported {fmtDate(r.issuedAt)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Labs({ me }: { me: MySummaryResponse }) {
  const labs = me.reports.filter((r) => r.category !== "imaging");
  if (labs.length === 0) return <MockSection title="Lab reports" data={patientMock.labs} />;
  const flagTone: Record<string, string> = {
    normal: "slate",
    high: "amber",
    low: "amber",
    critical: "red",
  };
  return (
    <Card title="Lab reports">
      <ul className="space-y-4">
        {labs.map((r) => (
          <li key={r.id} className="rounded-xl border border-slate-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-slate-800">{r.conclusion}</p>
              <Badge tone={r.status === "final" ? "green" : "amber"}>{r.status}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">Issued {fmtDate(r.issuedAt)}</p>
            {r.lines.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400">
                      <th className="pb-1 font-medium">Test</th>
                      <th className="pb-1 font-medium">Result</th>
                      <th className="pb-1 font-medium">Reference</th>
                      <th className="pb-1 font-medium">Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {r.lines.map((l, i) => (
                      <tr key={i}>
                        <td className="py-1.5 text-slate-700">{l.analyte}</td>
                        <td className="py-1.5 font-medium text-slate-800">
                          {l.value}
                          {l.unit ? ` ${l.unit}` : ""}
                        </td>
                        <td className="py-1.5 text-slate-500">{l.referenceRange ?? "—"}</td>
                        <td className="py-1.5">
                          {l.flag === "normal" ? (
                            <span className="text-slate-400">normal</span>
                          ) : (
                            <Badge tone={flagTone[l.flag] ?? "slate"}>{l.flag}</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
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
          Call 108
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

const FEEDBACK_CATEGORIES = [
  ["overall", "Overall"],
  ["doctor", "Doctor"],
  ["nursing", "Nursing"],
  ["cleanliness", "Cleanliness"],
  ["billing", "Billing"],
  ["facilities", "Facilities"],
] as const;

function Feedback() {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [category, setCategory] = useState<string>("overall");
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bff/me/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating,
          category,
          comment: text.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`Could not send feedback (${res.status})`);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send feedback");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Card title="Share feedback">
        <p className="rounded-lg bg-green-50 px-3 py-3 text-sm text-green-700">
          Thank you — your feedback helps us improve care for everyone. 💚
        </p>
      </Card>
    );
  }

  return (
    <Card title="Share feedback">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">How was your experience?</p>
          <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                onMouseEnter={() => setHover(n)}
                onClick={() => setRating(n)}
                className="text-3xl leading-none transition-transform hover:scale-110"
              >
                <span className={(hover || rating) >= n ? "text-amber-400" : "text-slate-300"}>
                  ★
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">What is this about?</p>
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_CATEGORIES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  category === value
                    ? "border-teal-600 bg-teal-50 font-medium text-teal-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Tell us more (optional)…"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          disabled={!rating || busy}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send feedback"}
        </button>
      </form>
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
          Manage account &amp; password
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
function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button
      type="button"
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
