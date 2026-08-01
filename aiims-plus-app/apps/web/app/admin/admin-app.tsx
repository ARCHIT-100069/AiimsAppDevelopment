"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AppShell,
  Badge,
  Card,
  Empty,
  MockSection,
  Row,
  Stat,
  type NavItem,
} from "../lib/app-shell";
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
  roles: string[];
}
interface Practitioner {
  id: string;
  nameGiven: string;
  nameFamily: string;
  registrationNo: string;
  status: string;
}
interface Appt {
  id: string;
  startAt: string;
  status: string;
  appointmentType: string;
}

export interface AdminData {
  userName: string;
  roles: string[];
  organizations: Org[];
  staff: StaffUser[];
  practitioners: Practitioner[];
  appointments: Appt[];
}

const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", group: "Overview" },
  { key: "patients", label: "Patient Management", group: "People" },
  { key: "staff", label: "Staff Management", group: "People" },
  { key: "roles", label: "Roles & Permissions", group: "People" },
  { key: "departments", label: "Department Management", group: "Operations" },
  { key: "appointments", label: "Appointment Management", group: "Operations" },
  { key: "beds", label: "Bed & Ward Management", group: "Operations" },
  { key: "records", label: "Medical Records Management", group: "Operations" },
  { key: "pharmacy", label: "Pharmacy Management", group: "Clinical Services" },
  { key: "lab", label: "Laboratory Management", group: "Clinical Services" },
  { key: "radiology", label: "Radiology Management", group: "Clinical Services" },
  { key: "billing", label: "Billing & Payments", group: "Finance" },
  { key: "insurance", label: "Insurance Management", group: "Finance" },
  { key: "inventory", label: "Inventory & Supplies", group: "Resources" },
  { key: "ambulance", label: "Ambulance Management", group: "Resources" },
  { key: "reports", label: "Reports & Analytics", group: "System" },
  { key: "notifications", label: "Notifications & Announcements", group: "System" },
  { key: "audit", label: "Audit Logs", group: "System" },
  { key: "integrations", label: "Integrations", group: "System" },
  { key: "settings", label: "Hospital Settings", group: "System" },
  { key: "portals", label: "Department Portals", group: "System" },
  { key: "profile", label: "My Profile", group: "Account" },
];

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

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

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
          <input
            required
            type="text"
            minLength={4}
            value={f.password}
            onChange={set("password")}
            placeholder="Share securely; staff can change it later"
            className={field}
          />
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
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
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

export function AdminApp({ data }: { data: AdminData }) {
  const doctors = data.practitioners.length;

  const render = (key: string) => {
    switch (key) {
      case "dashboard":
        return (
          <>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Hospital overview</h2>
              <p className="mt-1 text-sm text-slate-500">
                Administrative snapshot for your hospital.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Organisations" value={`${data.organizations.length}`} />
              <Stat label="Staff" value={`${data.staff.length}`} tone="slate" />
              <Stat label="Practitioners" value={`${doctors}`} tone="slate" />
              <Stat label="Appointments" value={`${data.appointments.length}`} tone="slate" />
            </div>
            <Card title="Facilities">
              {data.organizations.length === 0 ? (
                <Empty>No organisations configured.</Empty>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.organizations.map((o) => (
                    <Row key={o.id} title={o.name} sub={o.type} />
                  ))}
                </ul>
              )}
            </Card>
          </>
        );
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
                        <Badge tone={u.status === "active" ? "green" : "slate"}>{u.status}</Badge>
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
                        <Badge tone={p.status === "active" ? "green" : "slate"}>{p.status}</Badge>
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
                    sub={a.appointmentType}
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

  return (
    <AppShell
      appName="AIIMS+"
      roleLabel="Admin Console"
      greeting="Admin"
      userName={data.userName}
      nav={NAV}
      renderSection={render}
    />
  );
}
