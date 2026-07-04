/**
 * Stage 0 placeholder. The authenticated clinical shell (BFF auth, TanStack
 * Query, shadcn/ui design system) lands with the frontend build-out
 * (FEDR-0001…0014). No PHI, no business logic in the client (Blueprint §8).
 */
export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "4rem", maxWidth: 640 }}>
      <h1>AIIMS+</h1>
      <p>
        Walking skeleton (Stage 0). The web application is scaffolded; the clinical UI is built in
        the frontend stage against the frozen contracts.
      </p>
    </main>
  );
}
