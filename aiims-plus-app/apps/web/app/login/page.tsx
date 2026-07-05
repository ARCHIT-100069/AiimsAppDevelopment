/** Login — starts the BFF PKCE flow (SDR-0001). No credentials touch the app. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="text-2xl font-bold">AIIMS+</h1>
      <p className="mt-2 text-slate-600">Hospital Operating System</p>
      {error ? (
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Sign-in failed. Please try again.
        </p>
      ) : null}
      <a
        href="/api/auth/login"
        className="mt-8 inline-flex rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
      >
        Sign in with Keycloak
      </a>
    </main>
  );
}
