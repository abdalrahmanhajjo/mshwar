"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Merge, Plus } from "lucide-react";
import { AdminHeader, EmptyRow, ReasonField, TableShell } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { createTaxonomy, listTaxonomy, mergeTaxonomy, renameTaxonomy, retireTaxonomy } from "@/lib/admin";
import { useAdminCopy } from "@/lib/admin-copy";

export function TaxonomyManager() {
  const copy = useAdminCopy();
  const [rows, setRows] = React.useState<{ id: string; kind: string; slug: string; label: string; active: boolean }[]>(
    [],
  );
  const [reason, setReason] = React.useState("Catalogue update");
  const [label, setLabel] = React.useState("New term");
  const [slug, setSlug] = React.useState("new-term");
  const [kind, setKind] = React.useState("category");
  const [target, setTarget] = React.useState("");

  const reload = React.useCallback(async () => {
    try {
      setRows(await listTaxonomy());
    } catch {
      setRows([]);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void listTaxonomy()
      .then((next) => {
        if (!cancelled) {
          setRows(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-8">
      <AdminHeader title={copy.taxonomyTitle} description={copy.retiredNote} />
      <div className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6">
        <ReasonField id="taxonomy-reason" value={reason} onChange={setReason} />
        <div className="grid gap-3 border-t border-border-subtle pt-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr_auto] lg:items-end">
          <label className="grid gap-2 text-label font-medium">
            {copy.kindLabel}
            <Input aria-label="kind" value={kind} onChange={(event) => setKind(event.target.value)} />
          </label>
          <label className="grid gap-2 text-label font-medium">
            {copy.slugLabel}
            <Input aria-label="slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
          </label>
          <label className="grid gap-2 text-label font-medium">
            {copy.labelLabel}
            <Input aria-label="label" value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>
          <Button type="button" onClick={() => void createTaxonomy({ kind, slug, label, reason }).then(reload)}>
            <Plus aria-hidden />
            {copy.createTerm}
          </Button>
        </div>
      </div>
      <TableShell>
        <thead>
          <tr>
            <th scope="col">{copy.kindLabel}</th>
            <th scope="col">{copy.labelLabel}</th>
            <th scope="col">{copy.statusCol}</th>
            <th scope="col">{copy.actionsCol}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <EmptyRow colSpan={4} label={copy.queueEmpty} /> : null}
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <span className="font-mono text-xs text-text-muted">
                  {row.kind}/{row.slug}
                </span>
              </td>
              <td className="font-medium">{row.label}</td>
              <td>
                <Badge variant={row.active ? "success" : "outline"}>
                  {row.active ? copy.activeLabel : copy.retiredLabel}
                </Badge>
              </td>
              <td>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void renameTaxonomy(row.id, label, reason).then(reload)}
                  >
                    {copy.rename}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void retireTaxonomy(row.id, reason).then(reload)}
                  >
                    {copy.retire}
                  </Button>
                  <Input
                    aria-label={`merge-target-${row.id}`}
                    placeholder={copy.mergeTarget}
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    className="min-h-9 w-40 py-1.5"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void mergeTaxonomy(row.id, target, reason).then(reload)}
                  >
                    <Merge aria-hidden />
                    {copy.merge}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}
