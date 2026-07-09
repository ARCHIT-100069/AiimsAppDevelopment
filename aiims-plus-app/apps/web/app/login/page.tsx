import { IconCross, IconShield } from "@aiims/ui-web";

/** Login — split-panel: brand story + sign-in card. Starts BFF PKCE (SDR-0001). */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="auth-panel relative hidden flex-col justify-between p-12 text-white lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <IconCross width={26} height={26} />
          AIIMS+
        </div>
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight">
            The operating system for modern hospitals.
          </h1>
          <p className="mt-4 text-white/80">
            Register patients, run the OPD, and share records securely — with tenant isolation,
            encrypted identifiers, and a complete audit trail built in.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/90">
            {[
              "Encrypted patient identifiers (ABHA, phone, email)",
              "Every action audited, tamper-evident",
              "Role-based access, isolated per hospital",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <IconShield width={18} height={18} /> {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/60">India-first · ABDM &amp; DPDP aligned</p>
      </aside>

      {/* Sign-in card */}
      <main className="app-bg flex items-center justify-center p-6">
        <div className="card w-full max-w-sm p-8">
          <div className="mb-6 flex items-center gap-2 text-teal-700 lg:hidden">
            <IconCross width={24} height={24} />
            <span className="text-lg font-semibold">AIIMS+</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">
            Use your hospital account to continue — staff or patient.
          </p>

          {error ? (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Sign-in failed. Please try again.
            </p>
          ) : null}

          <a
            href="/api/auth/login"
            className="mt-6 flex w-full items-center justify-center rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700"
          >
            Sign in with Keycloak
          </a>

          <p className="mt-6 text-center text-xs text-slate-400">
            Protected by single sign-on. Accounts are provisioned by your administrator.
          </p>
        </div>
      </main>
    </div>
  );
}
