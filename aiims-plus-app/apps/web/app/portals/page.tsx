import { redirect } from "next/navigation";
import { readSession } from "../lib/session";
import { homeFor } from "../lib/roles";
import { canAccessPortal, PORTALS } from "../lib/portals";

export const dynamic = "force-dynamic";

// Modules wired to the real backend end-to-end (vs. designed previews).
const LIVE = new Set(["pharmacy", "laboratory", "radiology", "billing", "management"]);

export default async function PortalsHub() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (session.roles.includes("patient")) redirect("/portal");
  // Only show what this role can actually open — no dead-end tiles.
  const visible = PORTALS.filter((p) => canAccessPortal(p.slug, session.roles));

  return (
    <div className="app-bg min-h-screen">
      <header className="border-b border-slate-200 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-lg font-semibold text-teal-700">AIIMS+</div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Department Portals</div>
          </div>
          <a
            href={homeFor(session.roles)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Back to my console
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Hospital portals</h1>
        <p className="mt-1 text-sm text-slate-500">
          Open any department&apos;s workspace. Each portal covers what that team runs day to day.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...visible]
            .sort((a, b) => Number(LIVE.has(b.slug)) - Number(LIVE.has(a.slug)))
            .map((p) => {
              const live = LIVE.has(p.slug);
              return (
                <a
                  key={p.slug}
                  href={`/portals/${p.slug}`}
                  className="card group flex flex-col p-5 transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-sm font-bold text-teal-700">
                      {p.name
                        .replace(/\(.*?\)/g, "")
                        .split(" ")
                        .filter((w) => /^[a-z]/i.test(w) && w.toLowerCase() !== "portal")
                        .slice(0, 2)
                        .map((w) => w[0]!.toUpperCase())
                        .join("")}
                    </div>
                    {live ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Live
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        Preview
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 font-semibold text-slate-800 group-hover:text-teal-700">
                    {p.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">{p.tagline}</p>
                  <span className="mt-3 text-xs font-medium text-teal-700">
                    {live ? "Open workspace →" : `${p.nav.length} sections →`}
                  </span>
                </a>
              );
            })}
        </div>
      </main>
    </div>
  );
}
