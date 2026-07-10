"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Ripple } from "@/components/ui/ripple";

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

/* --------------------------------- icons ---------------------------------- */
const ICON_PATHS: Record<string, string> = {
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  money: "M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  shield: "M12 3l7 3v6c0 5-3 7-7 9-4-2-7-4-7-9V6z",
  pill: "M10.5 13.5l3-3M8 16a4 4 0 010-6l2-2a4 4 0 116 6l-2 2a4 4 0 01-6 0z",
  box: "M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10",
  flask: "M9 3h6M10 3v6l-5 9a1 1 0 001 1h12a1 1 0 001-1l-5-9V3",
  image: "M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6",
  alert: "M12 3l10 18H2zM12 9v5M12 18h.01",
  bed: "M3 7v10M3 12h13a4 4 0 014 4v1M3 17h18M7 12a2 2 0 100-4 2 2 0 000 4",
  truck: "M3 6h11v9H3zM14 9h4l3 3v3h-7zM7 18a2 2 0 100-4 2 2 0 000 4M17 18a2 2 0 100-4 2 2 0 000 4",
  drop: "M12 3s6 6 6 11a6 6 0 01-12 0c0-5 6-11 6-11z",
  cycle: "M4 12a8 8 0 0114-5M20 12a8 8 0 01-14 5M17 4v3h-3M7 20v-3h3",
  doc: "M6 2h9l5 5v15H6zM14 2v6h6M9 13h6M9 17h6",
  users:
    "M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M8 10a3 3 0 100-6 3 3 0 000 6M20 20v-2a3 3 0 00-2-2.8",
  chart: "M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-7",
  bell: "M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6M10 21h4",
  calendar: "M7 2v3M17 2v3M3 8h18M4 6h16v15H4z",
  gear: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M4 12H1M23 12h-3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2",
  building: "M4 21V5a1 1 0 011-1h6a1 1 0 011 1v16M12 21V9h7v12M7 8h2M7 12h2M15 13h2M15 17h2",
  cart: "M3 3h2l2 12h11l2-8H6M9 21a1 1 0 100-2 1 1 0 000 2M18 21a1 1 0 100-2 1 1 0 000 2",
  heart: "M3 12h4l2 5 3-10 2 5h4",
  plug: "M9 2v5M15 2v5M8 7h8v3a4 4 0 01-8 0zM12 14v6",
  list: "M4 6h16M4 12h16M4 18h16",
};
const ICON_RULES: [RegExp, string][] = [
  [/dashboard|overview/, "grid"],
  [/invoice|payment|ledger|collection|refund|outstanding|revenue|billing/, "money"],
  [/claim|insurance/, "shield"],
  [/prescription|pharmacy|dispens|medicine|drug/, "pill"],
  [/hospital|tenant|licens/, "building"],
  [/inventory|stock|store|supplies|asset|indent|grn|issue/, "box"],
  [/vendor|procurement|supplier|purchase|quotation|approval|contract|requisition/, "cart"],
  [/blood|donation|donor|cross-?match|camp/, "drop"],
  [/steriliz|autoclave|instrument|cssd|cycle/, "cycle"],
  [/lab|test|sample|result|catalog|\bqc\b/, "flask"],
  [/radiolog|imaging|pacs|modality|x-ray|scan/, "image"],
  [/triage|emergency|\ber\b|alert|critical/, "alert"],
  [/surgery|theatre|\bot\b|consumable|preop|handover|vitals|encounter|diagnos/, "heart"],
  [/bed|ward|occupancy|admission|discharge|transfer|housekeep/, "bed"],
  [/ambulance|fleet|dispatch|trip|driver/, "truck"],
  [/record|coding|retrieval|digit|retention|release|mrd|certificate|note/, "doc"],
  [/integration|\bapi\b/, "plug"],
  [/setting|config/, "gear"],
  [/audit|log|security|health/, "shield"],
  [/report|analytic|quality|utilis|flow/, "chart"],
  [/notification|announcement/, "bell"],
  [/schedule|appointment|queue|availab|arrival|admission/, "calendar"],
  [/staff|user|doctor|patient|people|team/, "users"],
];
function sectionIcon(label: string, size = 20) {
  const key = ICON_RULES.find(([re]) => re.test(label.toLowerCase()))?.[1] ?? "list";
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={ICON_PATHS[key]} />
    </svg>
  );
}

/* -------------------------------- greeting -------------------------------- */
export function Splash({ greeting }: { greeting: string }) {
  const [gone, setGone] = useState(false);
  const [fade, setFade] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setFade(true), 1150);
    const t2 = setTimeout(() => setGone(true), 1700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  if (gone) return null;
  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center overflow-hidden hero-gradient transition-opacity duration-500 ${
        fade ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <Ripple mainCircleSize={240} numCircles={8} />
      <div className="relative z-10 text-center">
        <p className="text-sm font-medium text-teal-900/70">Welcome back</p>
        <h1 className="mt-2 text-4xl font-bold text-slate-900">Hey {greeting}</h1>
        <div className="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-2 border-white/70 border-t-teal-700" />
      </div>
    </div>
  );
}

/* --------------------------------- shell ---------------------------------- */
export interface NavItem {
  key: string;
  label: string;
  group: string;
  hint?: string;
}

export function AppShell({
  appName,
  roleLabel,
  userName,
  greeting,
  nav,
  renderSection,
}: {
  appName: string;
  roleLabel: string;
  userName: string;
  greeting?: string;
  nav: NavItem[];
  renderSection: (key: string) => ReactNode;
}) {
  const [active, setActive] = useState<string | null>(null);
  const groups = [...new Set(nav.map((n) => n.group))];
  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  const activeItem = nav.find((n) => n.key === active);
  const hello = greeting ?? userName.split(" ")[0] ?? "there";

  return (
    <div className="app-bg min-h-screen">
      {greeting ? <Splash greeting={greeting} /> : null}

      <header className="sticky top-0 z-20 border-b border-white/40 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <button type="button" onClick={() => setActive(null)} className="text-left">
            <div className="text-lg font-semibold text-teal-700">{appName}</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">{roleLabel}</div>
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:block">{userName}</span>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
              {initials}
            </div>
            <form action="/api/auth/logout" method="post">
              <button className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl p-6">
        {active === null ? (
          <>
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-slate-900">Hey {hello}</h1>
              <p className="mt-1 text-sm text-slate-500">{roleLabel} · tap a section to open it.</p>
            </div>
            {groups.map((g) => (
              <div key={g} className="mb-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {g}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {nav
                    .filter((n) => n.group === g)
                    .map((n) => (
                      <button
                        type="button"
                        key={n.key}
                        onClick={() => setActive(n.key)}
                        className="qa-tile group flex items-center gap-3 p-4 text-left"
                      >
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 transition-colors group-hover:bg-teal-600 group-hover:text-white">
                          {sectionIcon(n.label)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-800">
                            {n.label}
                          </span>
                          <span className="block truncate text-xs text-slate-400">
                            {n.hint ?? "Open"}
                          </span>
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setActive(null)}
              className="mb-4 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-teal-700 hover:bg-teal-50"
            >
              ← All sections
            </button>
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-600 text-white">
                {sectionIcon(activeItem?.label ?? "", 22)}
              </span>
              <h1 className="text-2xl font-bold text-slate-900">{activeItem?.label}</h1>
            </div>
            <div className="space-y-5">{renderSection(active)}</div>
          </>
        )}
      </main>
    </div>
  );
}
