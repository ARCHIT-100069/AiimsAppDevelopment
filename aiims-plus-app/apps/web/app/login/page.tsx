import { IconCross, IconShield } from "@aiims/ui-web";
import { Ripple } from "@/components/ui/ripple";

const TRUST = [
  "Encrypted patient identifiers (ABHA, phone, email)",
  "Every action audited, tamper-evident",
  "Role-based access, isolated per hospital",
];

// One-click demo accounts — each posts the native sign-in form with preset
// credentials so you can hop between roles on the same device instantly.
const DEMO = [
  { label: "Patient", sub: "Anaya Sharma", u: "anaya", p: "patient", tone: "teal" },
  { label: "Doctor", sub: "Dr. Asha", u: "doctor.a", p: "doctor", tone: "slate" },
  { label: "Front Desk", sub: "Reception", u: "frontdesk.a", p: "frontdesk", tone: "slate" },
  { label: "Admin", sub: "Hospital admin", u: "admin.a", p: "admin", tone: "slate" },
] as const;

const ERRORS: Record<string, string> = {
  credentials: "Incorrect username or password. Please try again.",
  auth: "Sign-in was interrupted. Please try again.",
  token: "Could not complete sign-in. Please try again.",
};

/** Login — split-panel brand story + native sign-in (password grant) with a
 *  one-click demo switcher and an SSO fallback. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMsg = error ? (ERRORS[error] ?? ERRORS.auth) : null;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="auth-panel relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <Ripple mainCircleSize={280} numCircles={8} />
        <div className="relative z-10 flex items-center gap-2 text-lg font-semibold">
          <IconCross width={26} height={26} />
          AIIMS+
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-white/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            India-first Hospital OS
          </p>
          <h1 className="text-4xl font-bold leading-[1.1] xl:text-5xl">
            One secure login for your whole hospital.
          </h1>
          <p className="mt-4 max-w-md text-white/80">
            Patients, doctors, pharmacy, lab, radiology, billing and management — one platform,
            tenant-isolated, with a complete audit trail built in.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/90">
            {TRUST.map((f) => (
              <li key={f} className="flex items-center gap-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/15">
                  <IconShield width={14} height={14} />
                </span>
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/20 shadow-2xl">
            <img
              src="/images/care-hero.jpg"
              alt="A doctor consulting with a patient"
              className="h-44 w-full max-w-md object-cover"
            />
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-4 text-xs text-white/60">
          <span>ABDM aligned</span>
          <span className="h-1 w-1 rounded-full bg-white/40" />
          <span>DPDP compliant</span>
          <span className="h-1 w-1 rounded-full bg-white/40" />
          <span>256-bit encrypted</span>
        </div>
      </aside>

      {/* Sign-in side */}
      <main className="app-bg relative flex flex-col items-center justify-center gap-5 overflow-hidden p-6">
        <div className="card relative z-10 w-full max-w-sm p-8">
          <div className="mb-6 flex items-center gap-2 text-teal-700">
            <IconCross width={24} height={24} />
            <span className="text-lg font-semibold">AIIMS+</span>
          </div>

          <h2 className="text-xl font-semibold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">
            Use your hospital account — staff or patient.
          </p>

          {errorMsg ? (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMsg}
            </p>
          ) : null}

          {/* Native username/password sign-in */}
          <form action="/api/auth/password-login" method="post" className="mt-5 space-y-3">
            <label className="block text-sm">
              <span className="font-medium text-slate-600">Username</span>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
                <UserIcon />
                <input
                  name="username"
                  autoComplete="username"
                  required
                  placeholder="e.g. anaya"
                  className="w-full bg-transparent py-2.5 text-sm outline-none"
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-600">Password</span>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
                <LockIcon />
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="w-full bg-transparent py-2.5 text-sm outline-none"
                />
              </div>
            </label>
            <button
              type="submit"
              className="flex w-full items-center justify-center rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
            >
              Sign in
            </button>
          </form>

          {/* Quick demo access */}
          <div className="mt-6">
            <div className="mb-2 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              Quick demo access
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO.map((d) => (
                <form key={d.u} action="/api/auth/password-login" method="post">
                  <input type="hidden" name="username" value={d.u} />
                  <input type="hidden" name="password" value={d.p} />
                  <button
                    type="submit"
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                      d.tone === "teal"
                        ? "border-teal-200 bg-teal-50 hover:bg-teal-100"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <span className="block text-sm font-medium text-slate-800">{d.label}</span>
                    <span className="block text-xs text-slate-400">{d.sub}</span>
                  </button>
                </form>
              ))}
            </div>
          </div>

          {/* New patient */}
          <p className="mt-5 border-t border-slate-100 pt-4 text-center text-sm text-slate-500">
            New patient?{" "}
            <a href="/register" className="font-medium text-teal-700 hover:underline">
              Create an account
            </a>
          </p>

          {/* SSO fallback */}
          <a
            href="/api/auth/login"
            className="mt-3 block text-center text-xs font-medium text-slate-500 hover:text-teal-700"
          >
            Or use hospital single sign-on (SSO) →
          </a>
        </div>

        <p className="relative z-10 max-w-sm text-center text-xs text-slate-400">
          Your records are encrypted at rest and every access is logged. Switch accounts anytime —
          just sign out and sign back in.
        </p>
      </main>
    </div>
  );
}

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="#94a3b8"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 21a8 8 0 10-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="#94a3b8"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 118 0v3" />
    </svg>
  );
}
