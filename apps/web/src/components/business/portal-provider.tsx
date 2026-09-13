"use client";

import * as React from "react";
import { listOrganizations, writeActiveOrgId, type PortalOrganization } from "@/lib/portal";

interface PortalContextValue {
  orgs: PortalOrganization[];
  org: PortalOrganization | null;
  setOrgId: (id: string) => void;
  refresh: () => Promise<void>;
  ready: boolean;
}

const PortalContext = React.createContext<PortalContextValue | null>(null);

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [orgs, setOrgs] = React.useState<PortalOrganization[]>([]);
  const [orgId, setOrgId] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      const rows = await listOrganizations();
      setOrgs(rows);
      setOrgId((current) => current ?? rows[0]?.id ?? null);
      if (rows[0]?.id) {
        writeActiveOrgId(rows[0].id);
      }
    } catch {
      setOrgs([]);
    } finally {
      setReady(true);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const org = orgs.find((item) => item.id === orgId) ?? orgs[0] ?? null;

  const value = React.useMemo(
    () => ({
      orgs,
      org,
      setOrgId: (id: string) => {
        setOrgId(id);
        writeActiveOrgId(id);
      },
      refresh,
      ready,
    }),
    [org, orgs, ready, refresh],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal() {
  const context = React.useContext(PortalContext);
  if (!context) {
    throw new Error("usePortal must be used within PortalProvider");
  }
  return context;
}
