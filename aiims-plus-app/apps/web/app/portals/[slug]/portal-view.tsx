"use client";

import { AppShell, MockSection } from "../../lib/app-shell";
import type { PortalConfig } from "../../lib/portals";

export function PortalView({ config, userName }: { config: PortalConfig; userName: string }) {
  return (
    <AppShell
      appName="AIIMS+"
      roleLabel={config.name}
      userName={userName}
      nav={config.nav}
      renderSection={(key) => {
        const label = config.nav.find((n) => n.key === key)?.label ?? key;
        return <MockSection title={label} data={config.sections[key]} />;
      }}
    />
  );
}
