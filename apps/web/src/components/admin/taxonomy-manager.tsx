"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createTaxonomy, listTaxonomy, mergeTaxonomy, renameTaxonomy, retireTaxonomy } from "@/lib/admin";
import { useAdminCopy } from "@/lib/admin-copy";

export function TaxonomyManager() {
  const copy = useAdminCopy();
  const [rows, setRows] = React.useState<{ id: string; kind: string; slug: string; label: string; active: boolean }[]>([]);
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
    void reload();
  }, [reload]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.taxonomyTitle}</CardTitle>
        <CardDescription>Retiring keeps history and blocks new assignments.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Input aria-label="reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Input aria-label="kind" value={kind} onChange={(event) => setKind(event.target.value)} />
          <Input aria-label="slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
          <Input aria-label="label" value={label} onChange={(event) => setLabel(event.target.value)} />
          <Button type="button" onClick={() => void createTaxonomy({ kind, slug, label, reason }).then(reload)}>
            {copy.createTerm}
          </Button>
        </div>
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-sm">
              <span>
                {row.kind}/{row.slug} — {row.label} {row.active ? "" : "(retired)"}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void renameTaxonomy(row.id, label, reason).then(reload)}>
                  {copy.rename}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void retireTaxonomy(row.id, reason).then(reload)}>
                  {copy.retire}
                </Button>
                <Input
                  aria-label={`merge-target-${row.id}`}
                  placeholder="target id"
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void mergeTaxonomy(row.id, target, reason).then(reload)}
                >
                  {copy.merge}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
