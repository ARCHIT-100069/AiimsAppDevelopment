import { IconCross, IconShield } from "@aiims/ui-web";
import { Ripple } from "@/components/ui/ripple";
import { ScrollVelocityContainer, ScrollVelocityRow } from "@/components/ui/scroll-based-velocity";
import Text3DFlip from "@/components/ui/text-3d-flip";

const DEPARTMENTS = [
  "Patients",
  "Pharmacy",
  "Laboratory",
  "Radiology",
  "Emergency",
  "Blood Bank",
  "Operation Theatre",
  "Ambulance",
  "Billing",
  "Medical Records",
  "Bed & Ward",
  "CSSD",
  "Procurement",
  "Inventory",
];

function Marquee() {
  return (
    <ScrollVelocityContainer className="py-1">
      <ScrollVelocityRow baseVelocity={35}>
        {DEPARTMENTS.map((d) => (
          <span key={d} className="mx-4 flex items-center gap-4 text-sm font-medium text-white/70">
            {d}
            <span className="h-1 w-1 rounded-full bg-white/40" />
          </span>
        ))}
      </ScrollVelocityRow>
    </ScrollVelocityContainer>
  );
}

/** Login — split-panel: animated brand story + sign-in card. Starts BFF PKCE (SDR-0001). */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="auth-panel relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <Ripple mainCircleSize={260} numCircles={9} />
        <div className="relative z-10 flex items-center gap-2 text-lg font-semibold">
          <IconCross width={26} height={26} />
          AIIMS+
        </div>
        <div className="relative z-10 max-w-lg">
          <h1 className="text-5xl font-bold leading-[1.05]">
            The operating system for modern{" "}
            <Text3DFlip
              className="text-emerald-100"
              words={["hospitals.", "care.", "records.", "pharmacy.", "emergencies.", "billing."]}
            />
          </h1>
          <p className="mt-5 max-w-md text-white/80">
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
        <div className="relative z-10">
          <Marquee />
          <p className="mt-4 text-xs text-white/60">India-first · ABDM &amp; DPDP aligned</p>
        </div>
      </aside>

      {/* Sign-in side */}
      <main className="app-bg relative flex flex-col items-center justify-center gap-6 overflow-hidden p-6">
        <Ripple
          mainCircleSize={200}
          numCircles={7}
          mainCircleOpacity={0.1}
          className="text-teal-500"
        />
        <div className="card relative z-10 w-full max-w-sm p-8">
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

        {/* Trust strip — builds confidence for a health platform */}
        <div className="relative z-10 w-full max-w-sm space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["1,20,000+", "patients cared for"],
              ["200+", "doctors"],
              ["99.9%", "uptime"],
            ].map(([n, l]) => (
              <div key={l} className="card p-3">
                <p className="text-lg font-bold text-teal-700">{n}</p>
                <p className="text-[11px] leading-tight text-slate-500">{l}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              ["lock", "256-bit encrypted"],
              ["shield", "Tamper-evident audit"],
              ["check", "ABDM aligned"],
              ["check", "DPDP compliant"],
            ].map(([icon, label]) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600"
              >
                <TrustIcon kind={icon} />
                {label}
              </span>
            ))}
          </div>
          <p className="text-center text-xs text-slate-400">
            Your records are encrypted at rest and every access is logged.
          </p>
        </div>
      </main>
    </div>
  );
}

function TrustIcon({ kind }: { kind: string }) {
  const paths: Record<string, string> = {
    lock: "M6 10V7a6 6 0 1112 0v3M5 10h14v11H5zM12 15v3",
    shield: "M12 3l7 3v6c0 5-3 7-7 9-4-2-7-4-7-9V6z",
    check: "M20 6L9 17l-5-5",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-teal-600"
      aria-hidden
    >
      <path d={paths[kind]} />
    </svg>
  );
}
