import { IconCross } from "@aiims/ui-web";

const ERRORS: Record<string, string> = {
  missing: "Please fill in all required fields (password ≥ 4 characters).",
  taken: "That username is already taken. Please choose another.",
  record: "Could not create your record. Please try again.",
  server: "Something went wrong. Please try again in a moment.",
};

/** Patient self-registration — creates the record + a login in one step. */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMsg = error ? (ERRORS[error] ?? ERRORS.server) : null;
  const field =
    "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

  return (
    <div className="app-bg flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-md p-8">
        <div className="mb-5 flex items-center gap-2 text-teal-700">
          <IconCross width={24} height={24} />
          <span className="text-lg font-semibold">AIIMS+</span>
        </div>

        <h1 className="text-xl font-semibold text-slate-900">Create your patient account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Register once to book appointments, view reports, and see your bills.
        </p>

        {errorMsg ? (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </p>
        ) : null}

        <form action="/api/auth/register" method="post" className="mt-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-medium text-slate-600">First name</span>
              <input name="nameGiven" required placeholder="Anaya" className={field} />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-600">Last name</span>
              <input name="nameFamily" required placeholder="Sharma" className={field} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-medium text-slate-600">Gender</span>
              <select name="gender" required defaultValue="" className={field}>
                <option value="" disabled>
                  Select
                </option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-600">Date of birth</span>
              <input name="birthDate" type="date" required className={field} />
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-medium text-slate-600">
              Mobile number <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <input name="phone" inputMode="tel" placeholder="+91 98765 43210" className={field} />
          </label>

          <div className="my-1 border-t border-slate-100 pt-1" />

          <label className="block text-sm">
            <span className="font-medium text-slate-600">Choose a username</span>
            <input name="username" required placeholder="anaya.sharma" className={field} />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-600">Create a password</span>
            <input
              name="password"
              type="password"
              required
              minLength={4}
              placeholder="••••••••"
              className={field}
            />
          </label>

          <button
            type="submit"
            className="mt-2 flex w-full items-center justify-center rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
          >
            Create account &amp; sign in
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Already registered?{" "}
          <a href="/login" className="font-medium text-teal-700 hover:underline">
            Sign in
          </a>
        </p>
        <p className="mt-3 text-center text-xs text-slate-400">
          Staff accounts (doctor, nurse, front desk) are created by your hospital administrator.
        </p>
      </div>
    </div>
  );
}
