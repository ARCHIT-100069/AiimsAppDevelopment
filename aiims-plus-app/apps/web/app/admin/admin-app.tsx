"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, Empty, MockSection, Row, Splash, Stat, sectionIcon } from "../lib/app-shell";
import { formatDayMonthTime, formatTodayHeader } from "../lib/date";
import { adminMock } from "../lib/mock";

interface Org {
  id: string;
  name: string;
  type: string;
}
interface StaffUser {
  id: string;
  displayName: string;
  status: string;
  version: number;
  roles: string[];
}
interface Practitioner {
  id: string;
  nameGiven: string;
  nameFamily: string;
  registrationNo: string;
  status: string;
  version: number;
}
interface Appt {
  id: string;
  startAt: string;
  status: string;
  appointmentType: string;
}
interface ManagementOverview {
  opd: {
    total: number;
    booked: number;
    waiting: number;
    inProgress: number;
    completed: number;
    cancelled: number;
  };
  revenue: { paidTotal: string; outstandingTotal: string; paidCount: number };
  lab: { pending: number; resulted: number };
  pharmacy: { activeRx: number; dispensedRx: number; lowStock: number };
  satisfaction: { avgRating: number; count: number };
}

export interface AdminData {
  userName: string;
  roles: string[];
  organizations: Org[];
  staff: StaffUser[];
  practitioners: Practitioner[];
  appointments: Appt[];
  overview: ManagementOverview | null;
}

interface AdminNavItem {
  key: string;
  label: string;
  group: string;
  /** When set, this is a plain link to a REAL working page (e.g. the actual
   *  Pharmacy Portal) instead of a section rendered in-app — used so a fake
   *  MockSection is never offered where a real one already exists. */
  href?: string;
}

const NAV: AdminNavItem[] = [
  { key: "dashboard", label: "Dashboard", group: "Overview" },
  { key: "patients", label: "Patient Management", group: "People" },
  { key: "staff", label: "Staff Management", group: "People" },
  { key: "roles", label: "Roles & Permissions", group: "People" },
  { key: "departments", label: "Department Management", group: "Operations" },
  { key: "appointments", label: "Appointment Management", group: "Operations" },
  { key: "beds", label: "Bed & Ward Management", group: "Operations" },
  { key: "records", label: "Medical Records Management", group: "Operations" },
  {
    key: "pharmacy",
    label: "Pharmacy Management",
    group: "Clinical Services",
    href: "/portals/pharmacy",
  },
  {
    key: "lab",
    label: "Laboratory Management",
    group: "Clinical Services",
    href: "/portals/laboratory",
  },
  {
    key: "radiology",
    label: "Radiology Management",
    group: "Clinical Services",
    href: "/portals/radiology",
  },
  { key: "billing", label: "Billing & Payments", group: "Finance", href: "/portals/billing" },
  { key: "insurance", label: "Insurance Management", group: "Finance" },
  { key: "inventory", label: "Inventory & Supplies", group: "Resources" },
  { key: "ambulance", label: "Ambulance Management", group: "Resources" },
  { key: "reports", label: "Reports & Analytics", group: "System", href: "/portals/management" },
  { key: "notifications", label: "Notifications & Announcements", group: "System" },
  { key: "audit", label: "Audit Logs", group: "System" },
  { key: "integrations", label: "Integrations", group: "System" },
  { key: "settings", label: "Hospital Settings", group: "System" },
  { key: "portals", label: "Department Portals", group: "System" },
  { key: "profile", label: "My Profile", group: "Account" },
];

const inr = (n: string | number) =>
  "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const DEPT_PORTALS: [string, string][] = [
  ["billing", "Billing & Accounts"],
  ["pharmacy", "Pharmacy"],
  ["laboratory", "Laboratory"],
  ["radiology", "Radiology"],
  ["er", "Emergency (ER)"],
  ["beds", "Bed & Ward"],
  ["ambulance", "Ambulance"],
  ["inventory", "Inventory & Store"],
  ["procurement", "Procurement"],
  ["ot", "Operation Theatre"],
  ["bloodbank", "Blood Bank"],
  ["cssd", "CSSD (Sterilization)"],
  ["mrd", "Medical Records (MRD)"],
  ["management", "Management Dashboard"],
  ["superadmin", "Super Admin"],
];

const fmt = formatDayMonthTime;

const ROLE_SUMMARY: [string, string][] = [
  [
    "admin",
    "Organisation, facilities, departments, staff & schedules. No patient-data access (separation of duties).",
  ],
  ["doctor", "Consultations, clinical documentation, sign-off, orders, results. Read patients."],
  ["nurse", "Vitals & clinical documentation (no sign-off, no orders)."],
  ["front_desk", "Patient registration, appointment booking, check-in, billing & payments."],
  ["patient", "Reads only their own record; books their own appointments (self-service portal)."],
];

const STAFF_ROLES = [
  { code: "doctor", label: "Doctor" },
  { code: "nurse", label: "Nurse" },
  { code: "front_desk", label: "Front Desk" },
  { code: "admin", label: "Admin" },
] as const;

/** Create a staff login + record (Keycloak user + app_user + role + practitioner). */
function AddStaff() {
  const router = useRouter();
  const [f, setF] = useState({
    nameGiven: "",
    nameFamily: "",
    role: "doctor",
    username: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((s) => ({ ...s, [k]: e.target.value }));
  const field = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/bff/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(f),
      });
      if (res.ok) {
        const label = STAFF_ROLES.find((r) => r.code === f.role)?.label ?? "Staff";
        setMsg({ ok: true, t: `${label} account created for ${f.nameGiven} ${f.nameFamily}.` });
        setF({ nameGiven: "", nameFamily: "", role: f.role, username: "", password: "" });
        router.refresh();
      } else {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        const errs: Record<string, string> = {
          taken: "That username is already taken.",
          missing: "Please fill in all fields (password ≥ 4 chars).",
          keycloak: "Could not create the login. Try again.",
          user: "Login created, but the staff record failed. Check the directory.",
        };
        setMsg({ ok: false, t: errs[b.error ?? ""] ?? "Could not create the account." });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Add staff member">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-slate-500">First name</span>
          <input required value={f.nameGiven} onChange={set("nameGiven")} className={field} />
        </label>
        <label className="text-sm">
          <span className="text-slate-500">Last name</span>
          <input required value={f.nameFamily} onChange={set("nameFamily")} className={field} />
        </label>
        <label className="text-sm">
          <span className="text-slate-500">Role</span>
          <select value={f.role} onChange={set("role")} className={field}>
            {STAFF_ROLES.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-500">Username</span>
          <input
            required
            value={f.username}
            onChange={set("username")}
            placeholder="e.g. dr.mehta"
            className={field}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="text-slate-500">Temporary password</span>
          <div className="relative mt-1">
            <input
              required
              type={showPassword ? "text" : "password"}
              minLength={4}
              value={f.password}
              onChange={set("password")}
              placeholder="Share securely; staff can change it later"
              className={`${field} mt-0 pr-16`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-2 text-xs font-medium text-teal-700 hover:text-teal-800"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>
        {msg ? (
          <p
            className={`sm:col-span-2 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
          >
            {msg.t}
          </p>
        ) : null}
        <div className="sm:col-span-2">
          <button
            disabled={busy}
            className="rounded-full bg-teal-700 px-4 py-2 text-sm font-medium tracking-wide text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create staff account"}
          </button>
          <p className="mt-2 text-xs text-slate-400">
            Creates a login + directory record. Doctors &amp; nurses also get a practitioner profile
            so they&apos;re immediately bookable.
          </p>
        </div>
      </form>
    </Card>
  );
}

/** Deactivate/reactivate a staff login or practitioner profile — a real
 *  write against the actual backend (blocks/restores session resolution for
 *  staff logins; RBAC-gated to admin). Self-contained: no self-deactivation. */
function StatusToggle({
  kind,
  id,
  status,
  version,
  isSelf,
}: {
  kind: "staff" | "practitioner";
  id: string;
  status: string;
  version: number;
  isSelf?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const active = status === "active";
  const nextStatus = active ? (kind === "staff" ? "disabled" : "inactive") : "active";
  const url = kind === "staff" ? `/api/bff/staff/${id}/status` : `/api/bff/practitioners/${id}`;

  async function toggle() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "content-type": "application/json", "if-match": String(version) },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        router.refresh();
      } else if (res.status === 409) {
        setErr("Changed elsewhere — refresh and retry.");
      } else {
        setErr("Couldn't update status.");
      }
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (isSelf) {
    return <span className="text-xs text-slate-400">This is you</span>;
  }

  return (
    <div className="flex items-center gap-2">
      {err ? <span className="text-xs text-red-600">{err}</span> : null}
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`text-xs font-medium hover:underline disabled:opacity-50 ${
          active ? "text-red-600" : "text-teal-700"
        }`}
      >
        {busy ? "…" : active ? "Deactivate" : "Reactivate"}
      </button>
    </div>
  );
}

export function AdminApp({ data }: { data: AdminData }) {
  const doctors = data.practitioners.length;

  const render = (key: string) => {
    switch (key) {
      case "staff":
        return (
          <>
            <AddStaff />
            <Card title="Staff accounts">
              {data.staff.length === 0 ? (
                <Empty>No staff accounts.</Empty>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.staff.map((u) => (
                    <Row
                      key={u.id}
                      title={u.displayName}
                      sub={u.roles.join(", ") || "no role"}
                      right={
                        <div className="flex items-center gap-3">
                          <Badge tone={u.status === "active" ? "green" : "slate"}>{u.status}</Badge>
                          <StatusToggle
                            kind="staff"
                            id={u.id}
                            status={u.status}
                            version={u.version}
                            isSelf={u.displayName === data.userName}
                          />
                        </div>
                      }
                    />
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Practitioners">
              {data.practitioners.length === 0 ? (
                <Empty>No practitioners.</Empty>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.practitioners.map((p) => (
                    <Row
                      key={p.id}
                      title={`${p.nameGiven} ${p.nameFamily}`}
                      sub={`Reg. ${p.registrationNo}`}
                      right={
                        <div className="flex items-center gap-3">
                          <Badge tone={p.status === "active" ? "green" : "slate"}>{p.status}</Badge>
                          <StatusToggle
                            kind="practitioner"
                            id={p.id}
                            status={p.status}
                            version={p.version}
                          />
                        </div>
                      }
                    />
                  ))}
                </ul>
              )}
            </Card>
          </>
        );
      case "roles":
        return (
          <Card title="Roles & permissions">
            <ul className="divide-y divide-slate-100">
              {ROLE_SUMMARY.map(([role, desc]) => (
                <li key={role} className="py-3">
                  <div className="flex items-center gap-2">
                    <Badge tone="teal">{role}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{desc}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-400">
              Enforced server-side by RBAC + row-level security on every request.
            </p>
          </Card>
        );
      case "departments":
        return (
          <Card title="Organisations & facilities">
            {data.organizations.length === 0 ? (
              <Empty>No organisations yet.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.organizations.map((o) => (
                  <Row key={o.id} title={o.name} sub={`Type: ${o.type}`} />
                ))}
              </ul>
            )}
          </Card>
        );
      case "appointments":
        return (
          <Card title="Appointments">
            {data.appointments.length === 0 ? (
              <Empty>No appointments scheduled.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.appointments.map((a) => (
                  <Row
                    key={a.id}
                    title={fmt(a.startAt)}
                    sub={a.appointmentType.replace("_", " ")}
                    right={<Badge tone="teal">{a.status.replace("_", " ")}</Badge>}
                  />
                ))}
              </ul>
            )}
          </Card>
        );
      case "profile":
        return (
          <Card title="My profile">
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase text-slate-400">Name</dt>
                <dd className="text-slate-800">{data.userName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-400">Roles</dt>
                <dd className="text-slate-800">{data.roles.join(", ")}</dd>
              </div>
            </dl>
          </Card>
        );
      case "portals":
        return (
          <Card title="Department Portals">
            <p className="mb-4 text-sm text-slate-600">
              Open any hospital department&apos;s workspace. Each portal covers what that team runs
              day to day.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {DEPT_PORTALS.map(([slug, label]) => (
                <a
                  key={slug}
                  href={`/portals/${slug}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700"
                >
                  {label}
                  <span aria-hidden>→</span>
                </a>
              ))}
            </div>
          </Card>
        );
      case "patients":
        return <MockSection title="Patient Management" data={adminMock.patients} />;
      default: {
        const label = NAV.find((n) => n.key === key)?.label ?? "Section";
        return <MockSection title={label} data={adminMock[key]} />;
      }
    }
  };

  const [active, setActive] = useState<string | null>(null);
  const activeItem = NAV.find((n) => n.key === active);
  const groups = [...new Set(NAV.map((n) => n.group))];
  const ov = data.overview;

  return (
    <div className="app-bg flex h-screen flex-col overflow-hidden">
      <Splash greeting="Admin" />

      {/* Persistent top bar */}
      <header className="z-20 flex shrink-0 items-center gap-4 border-b border-white/40 bg-white/75 px-5 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={() => setActive(null)}
          className="flex shrink-0 items-center gap-1.5 text-teal-700"
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M10 2h4v8h8v4h-8v8h-4v-8H2v-4h8z" />
          </svg>
          <span className="font-display text-base tracking-tight">AIIMS+</span>
        </button>
        <div className="hidden text-sm text-slate-500 sm:block">Admin Console</div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActive("staff")}
            className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3.5 py-1.5 text-sm font-medium text-teal-700 hover:border-teal-300 sm:flex"
          >
            <svg
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add staff
          </button>
          <button
            type="button"
            title="Notifications"
            className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6M10 21h4" />
            </svg>
          </button>
          <span className="hidden text-sm text-slate-600 sm:block">{data.userName}</span>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-full px-3.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
              Log out
            </button>
          </form>
        </div>
      </header>

      {/* Mobile section picker — the rail below is desktop/tablet-only (lg+); a
          narrow phone gets a plain dropdown instead of a squeezed sidebar. */}
      <div className="shrink-0 border-b border-white/40 bg-white/60 px-4 py-2 lg:hidden">
        <label htmlFor="admin-mobile-nav" className="sr-only">
          Section
        </label>
        <select
          id="admin-mobile-nav"
          value={active ?? "dashboard"}
          onChange={(e) => {
            const target = NAV.find((n) => n.key === e.target.value);
            if (target?.href) window.location.href = target.href;
            else setActive(e.target.value === "dashboard" ? null : e.target.value);
          }}
          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
        >
          {NAV.map((n) => (
            <option key={n.key} value={n.key}>
              {n.label}
              {n.href ? " (live)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Persistent left rail — same pattern as the doctor workspace, for a
            consistent navigation feel across roles. */}
        <nav className="hidden w-[276px] shrink-0 overflow-y-auto border-r border-white/40 bg-white/45 px-3 py-4 lg:block">
          {groups.map((g, gi) => (
            <div key={g} className={gi === 0 ? "mb-5" : "mb-5 mt-1"}>
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {g}
              </p>
              <div className="space-y-0.5">
                {NAV.filter((n) => n.group === g).map((n) => {
                  const isDashboard = n.key === "dashboard";
                  const isActive = isDashboard ? active === null : active === n.key;
                  const content = (
                    <>
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                          isActive ? "bg-white/15" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {sectionIcon(n.label, 16)}
                      </span>
                      <span className="min-w-0 flex-1 leading-tight">{n.label}</span>
                      {n.href ? <Badge tone="green">Live</Badge> : null}
                    </>
                  );
                  const cls = `flex w-full items-center gap-3 rounded-full px-2.5 py-2 text-left text-[13px] font-medium transition-colors ${
                    isActive
                      ? "bg-teal-700 text-white"
                      : "text-slate-600 hover:bg-teal-50 hover:text-teal-700"
                  }`;
                  return n.href ? (
                    <a key={n.key} href={n.href} className={cls}>
                      {content}
                    </a>
                  ) : (
                    <button
                      type="button"
                      key={n.key}
                      onClick={() => setActive(isDashboard ? null : n.key)}
                      className={cls}
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Main workspace */}
        <main className="flex-1 overflow-y-auto p-6">
          {active === null ? (
            <div className="flex h-full flex-col gap-4">
              <div>
                <h1 className="font-display text-xl font-normal tracking-tight text-slate-900">
                  Hey Admin
                </h1>
                <p className="text-sm text-slate-500">
                  {formatTodayHeader()} · hospital-wide snapshot.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Organisations" value={`${data.organizations.length}`} />
                <Stat label="Staff" value={`${data.staff.length}`} tone="slate" />
                <Stat label="Practitioners" value={`${doctors}`} tone="slate" />
                <Stat label="Appointments" value={`${data.appointments.length}`} tone="slate" />
              </div>

              {ov ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="OPD waiting now" value={`${ov.opd.waiting}`} tone="amber" />
                  <Stat label="Revenue collected" value={inr(ov.revenue.paidTotal)} />
                  <Stat label="Outstanding" value={inr(ov.revenue.outstandingTotal)} tone="amber" />
                  <Stat label="Lab pending" value={`${ov.lab.pending}`} tone="slate" />
                </div>
              ) : (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Hospital operations data (revenue, OPD activity, lab) is unavailable right now.
                </p>
              )}

              <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-5">
                <Card
                  title="Facilities"
                  action={<Badge tone="teal">{data.organizations.length}</Badge>}
                >
                  <div className="max-h-[360px] overflow-y-auto">
                    {data.organizations.length === 0 ? (
                      <Empty>No organisations configured.</Empty>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {data.organizations.map((o) => (
                          <Row key={o.id} title={o.name} sub={o.type} />
                        ))}
                      </ul>
                    )}
                  </div>
                </Card>

                <div className="flex flex-col gap-4 lg:col-span-2">
                  {ov ? (
                    <Card title="Today's OPD activity">
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-xs uppercase text-slate-400">Booked</dt>
                          <dd className="font-semibold text-slate-800">{ov.opd.booked}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase text-slate-400">In consult</dt>
                          <dd className="font-semibold text-slate-800">{ov.opd.inProgress}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase text-slate-400">Completed</dt>
                          <dd className="font-semibold text-slate-800">{ov.opd.completed}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase text-slate-400">Cancelled / no-show</dt>
                          <dd className="font-semibold text-slate-800">{ov.opd.cancelled}</dd>
                        </div>
                      </dl>
                    </Card>
                  ) : null}

                  <Card title="Quick actions">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: "staff", label: "Add staff" },
                        { key: "departments", label: "Departments" },
                        { key: "roles", label: "Roles" },
                        { key: "portals", label: "All portals" },
                      ].map((qa) => (
                        <button
                          key={qa.key}
                          type="button"
                          onClick={() => setActive(qa.key)}
                          className="qa-tile flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-700"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-700">
                            {sectionIcon(qa.label, 15)}
                          </span>
                          {qa.label}
                        </button>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="mb-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium text-teal-800 hover:bg-teal-50"
              >
                ← Dashboard
              </button>
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-teal-800 text-white">
                  {sectionIcon(activeItem?.label ?? "", 22)}
                </span>
                <h1 className="font-display text-2xl font-normal tracking-tight text-slate-900">
                  {activeItem?.label}
                </h1>
              </div>
              <div className="space-y-5 pb-6">{render(active)}</div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
