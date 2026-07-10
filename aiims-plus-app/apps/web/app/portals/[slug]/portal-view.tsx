"use client";

import { AppShell, MockSection, type NavItem } from "../../lib/app-shell";
import type { PortalConfig } from "../../lib/portals";

export function PortalView({
  config,
  userName,
  greeting,
}: {
  config: PortalConfig;
  userName: string;
  greeting: string;
}) {
  // Give each tile a short hint from its data (first stat, or item count).
  const nav: NavItem[] = config.nav.map((n) => {
    const d = config.sections[n.key];
    const hint = d?.stats?.[0]
      ? `${d.stats[0][1]} ${d.stats[0][0].toLowerCase()}`
      : d?.items
        ? `${d.items.length} ${d.items.length === 1 ? "item" : "items"}`
        : undefined;
    return { ...n, hint };
  });

  return (
    <AppShell
      appName="AIIMS+"
      roleLabel={config.name}
      greeting={greeting}
      userName={userName}
      nav={nav}
      renderSection={(key) => {
        const label = config.nav.find((n) => n.key === key)?.label ?? key;
        return <MockSection title={label} data={config.sections[key]} />;
      }}
    />
  );
}
