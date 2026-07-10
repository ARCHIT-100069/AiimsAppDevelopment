import { notFound, redirect } from "next/navigation";
import { readSession } from "../../lib/session";
import { portalBySlug } from "../../lib/portals";
import { PortalView } from "./portal-view";

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

  const config = portalBySlug(slug);
  if (!config) notFound();

  return <PortalView config={config} userName={session.displayName} />;
}
