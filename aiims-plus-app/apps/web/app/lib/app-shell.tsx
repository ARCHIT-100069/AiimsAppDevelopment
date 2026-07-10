"use client";

import { useState, type ReactNode } from "react";

/* ------------------------------ shared primitives ------------------------- */
export function Card({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
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

export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="py-6 text-center text-sm text-slate-400">{children}</p>
);

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: string }) {
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

export function Row({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-800">{title}</p>
        {sub ? <p className="truncate text-sm text-slate-500">{sub}</p> : null}
      </div>
      {right}
    </li>
  );
}

export function Stat({
  label,
  value,
  tone = "teal",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  const tones: Record<string, string> = {
    teal: "text-teal-700",
    amber: "text-amber-600",
    slate: "text-slate-700",
  };
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

/** A section that has no backend yet — clean, honest placeholder. */
export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <Card title={title}>
      <Empty>{note}</Empty>
    </Card>
  );
}

export interface MockItem {
  title: string;
  sub?: string;
  badge?: string;
  tone?: string;
}
export interface MockSectionData {
  stats?: [string, string][];
  items?: MockItem[];
}

/** Renders example data (stat tiles + a list) for a section without a backend. */
export function MockSection({
  title,
  data,
  note = "Coming soon.",
}: {
  title: string;
  data?: MockSectionData;
  note?: string;
}) {
  if (!data || (!data.stats?.length && !data.items?.length)) {
    return <Placeholder title={title} note={note} />;
  }
  return (
    <>
      {data.stats?.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.stats.map(([label, value]) => (
            <Stat key={label} label={label} value={value} tone="slate" />
          ))}
        </div>
      ) : null}
      <Card title={title}>
        {data.items?.length ? (
          <ul className="divide-y divide-slate-100">
            {data.items.map((it, i) => (
              <Row
                key={i}
                title={it.title}
                sub={it.sub}
                right={it.badge ? <Badge tone={it.tone}>{it.badge}</Badge> : undefined}
              />
            ))}
          </ul>
        ) : (
          <Empty>{note}</Empty>
        )}
      </Card>
    </>
  );
}

/* --------------------------------- shell ---------------------------------- */
export interface NavItem {
  key: string;
  label: string;
  group: string;
}

export function AppShell({
  appName,
  roleLabel,
  userName,
  nav,
  renderSection,
}: {
  appName: string;
  roleLabel: string;
  userName: string;
  nav: NavItem[];
  renderSection: (key: string) => ReactNode;
}) {
  const [active, setActive] = useState<string>(nav[0]?.key ?? "");
  const groups = [...new Set(nav.map((n) => n.group))];
  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="app-bg min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="px-5 py-4">
          <div className="text-lg font-semibold text-teal-700">{appName}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">{roleLabel}</div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {groups.map((g) => (
            <div key={g} className="mb-1 mt-3">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {g}
              </p>
              {nav
                .filter((n) => n.group === g)
                .map((n) => (
                  <button
                    key={n.key}
                    type="button"
                    onClick={() => setActive(n.key)}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
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

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur">
          <select
            value={active}
            onChange={(e) => setActive(e.target.value)}
            className="max-w-[60%] rounded-lg border border-slate-200 px-2 py-1 text-sm lg:hidden"
          >
            {nav.map((n) => (
              <option key={n.key} value={n.key}>
                {n.label}
              </option>
            ))}
          </select>
          <h1 className="hidden text-lg font-semibold text-slate-800 lg:block">
            {nav.find((n) => n.key === active)?.label}
          </h1>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:block">{userName}</span>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
              {initials}
            </div>
            <form action="/api/auth/logout" method="post">
              <button className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
                Log out
              </button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 p-6">
          {renderSection(active)}
        </main>
      </div>
    </div>
  );
}
