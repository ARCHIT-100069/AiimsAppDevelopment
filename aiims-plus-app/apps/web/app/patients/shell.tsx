import type { ReactNode } from "react";
import {
  Avatar,
  Badge,
  IconBilling,
  IconCalendar,
  IconClipboard,
  IconCross,
  IconLogout,
  IconPatients,
  IconStethoscope,
} from "@aiims/ui-web";
import { readSession } from "../lib/session";

const NAV = [
  { label: "Patients", href: "/patients", icon: IconPatients },
  { label: "Practitioners", href: "/practitioners", icon: IconStethoscope },
  { label: "Appointments", href: "/appointments", icon: IconCalendar },
  { label: "Encounters", href: "#", icon: IconClipboard, soon: true },
  { label: "Billing", href: "#", icon: IconBilling, soon: true },
];

/** Authenticated shell (FEDR-0005): sidebar nav + top bar with user context. */
export async function AppShell({ active, children }: { active?: string; children: ReactNode }) {
  const session = await readSession();
  const role = session?.roles.find((r) => ["admin", "doctor", "nurse", "front_desk"].includes(r));

  return (
    <div className="app-bg flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200/70 bg-white/70 backdrop-blur md:flex">
        <div className="flex items-center gap-2 px-6 py-5 text-teal-700">
          <IconCross width={24} height={24} />
          <span className="text-lg font-bold tracking-tight">AIIMS+</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map(({ label, href, icon: Icon, soon }) => {
            const isActive = active === label;
            return (
              <a
                key={label}
                href={soon ? undefined : href}
                aria-current={isActive ? "page" : undefined}
                aria-disabled={soon}
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                  isActive
                    ? "bg-teal-50 text-teal-700"
                    : soon
                      ? "cursor-default text-slate-400"
                      : "text-slate-600 hover:bg-slate-100",
                ].join(" ")}
              >
                <Icon width={18} height={18} />
                <span className="flex-1">{label}</span>
                {soon ? (
                  <span className="text-[10px] uppercase tracking-wide text-slate-300">Soon</span>
                ) : null}
              </a>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 p-4 text-xs text-slate-400">
          Demo environment · synthetic data
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/70 bg-white/80 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-2 text-teal-700 md:hidden">
            <IconCross width={20} height={20} />
            <span className="font-bold">AIIMS+</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-slate-800">{session?.displayName}</div>
              <div className="text-xs text-slate-400">{prettyRole(role)}</div>
            </div>
            <Avatar name={session?.displayName ?? "User"} size="sm" />
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                title="Sign out"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <IconLogout width={18} height={18} />
                <span className="sr-only">Sign out</span>
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}

function prettyRole(role?: string): string {
  return role ? role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Staff";
}

export { Badge };

/** Server-authoritative capability checks for UI affordances (FEDR-0008). */
export async function canRegisterPatients(): Promise<boolean> {
  const session = await readSession();
  return session?.roles.some((r) => r === "front_desk") ?? false;
}

/** Practitioner directory is managed by admins (decision e). */
export async function canManagePractitioners(): Promise<boolean> {
  const session = await readSession();
  return session?.roles.some((r) => r === "admin") ?? false;
}

/** Reception owns the OPD desk: booking through check-in (decision D-4.7). */
export async function canManageAppointments(): Promise<boolean> {
  const session = await readSession();
  return session?.roles.some((r) => r === "front_desk") ?? false;
}

/** Clinicians document the encounter; nurse may add vitals (decision D-5.6). */
export async function canDocumentEncounter(): Promise<boolean> {
  const session = await readSession();
  return session?.roles.some((r) => r === "doctor" || r === "nurse") ?? false;
}

/** Constitution: only a doctor signs an encounter (decision D-5.6). */
export async function canSignEncounter(): Promise<boolean> {
  const session = await readSession();
  return session?.roles.some((r) => r === "doctor") ?? false;
}
