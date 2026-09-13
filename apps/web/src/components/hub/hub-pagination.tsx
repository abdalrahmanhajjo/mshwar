"use client";

import { Button } from "@/components/ui/button";
import { useBrowseCopy } from "@/lib/browse-copy";
import { useHubCopy } from "@/lib/hub-copy";
import { HUB_PAGE_SIZE } from "@/lib/hub";

export function HubPagination({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const copy = useBrowseCopy();
  const hub = useHubCopy();
  const pages = Math.max(1, Math.ceil(total / HUB_PAGE_SIZE));
  if (pages <= 1) {
    return null;
  }
  return (
    <nav className="flex items-center justify-between gap-3" aria-label={hub.pageLabel}>
      <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {copy.pagePrevious}
      </Button>
      <p className="text-sm text-text-muted">
        {page} / {pages}
      </p>
      <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {copy.pageNext}
      </Button>
    </nav>
  );
}
