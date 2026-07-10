import { notFound, redirect } from "next/navigation";
import { readSession } from "../../lib/session";
import { friendlyRole } from "../../lib/roles";
import { portalBySlug } from "../../lib/portals";
import { PortalView } from "./portal-view";
import { PharmacyPortal } from "../pharmacy/pharmacy-portal";

export const dynamic = "force-dynamic";

export default async function DepartmentPortalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await readSession();
  if (!session) redirect("/login");
  // Department portals are staff-only.
  if (session.roles.includes("patient")) redirect("/portal");

  const greeting = friendlyRole(session.roles);

  // Real modules get a live portal; the rest render from the example registry.
  if (slug === "pharmacy") {
    return <PharmacyPortal userName={session.displayName} greeting={greeting} />;
  }

  const config = portalBySlug(slug);
  if (!config) notFound();

  return <PortalView config={config} userName={session.displayName} greeting={greeting} />;
}
