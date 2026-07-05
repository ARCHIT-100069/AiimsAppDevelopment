import type { ReactNode } from "react";
import { readSession } from "../lib/session";

/** Authenticated shell (FEDR-0005): tenant/user context + capability-aware nav. */
export async function AppShell({ children }: { children: ReactNode }) {
  const session = await readSession();
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <a href="/patients" className="font-bold text-sky-800">
            AIIMS+
          </a>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600">{session?.displayName}</span>
            <form action="/api/auth/logout" method="post">
              <button className="text-sky-800 hover:underline" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}

/** Server-authoritative capability check for UI affordances (FEDR-0008). */
export async function canRegisterPatients(): Promise<boolean> {
  const session = await readSession();
  // Mirrors the S2-d matrix; the API PEP remains the real gate.
  return session?.roles.some((r) => r === "front_desk") ?? false;
}
