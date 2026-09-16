"use client";

import { AdminHeader } from "@/components/admin/admin-ui";
import { useAdminCopy } from "@/lib/admin-copy";

export function AdminSettingsHeader() {
  const copy = useAdminCopy();
  return <AdminHeader title={copy.settingsTitle} description={copy.settingsBody} />;
}

export function AdminCollectionsHeader() {
  const copy = useAdminCopy();
  return <AdminHeader title={copy.collectionsTitle} description={copy.collectionsBody} />;
}
