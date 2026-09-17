"use client";

import * as React from "react";
import { History, RotateCcw, Search } from "lucide-react";
import { AdminHeader, EmptyRow, TableShell } from "@/components/admin/admin-ui";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { auditFilters, searchAudit, type AuditEntry, type AuditQuery } from "@/lib/admin";
import { useAdminCopy } from "@/lib/admin-copy";

type Filters = Required<
  Pick<AuditQuery, "action" | "actor_id" | "target_type" | "target_id" | "request_id" | "from" | "to">
>;

const EMPTY: Filters = { action: "", actor_id: "", target_type: "", target_id: "", request_id: "", from: "", to: "" };
const PAGE_SIZE = 50;

function toQuery(filters: Filters): AuditQuery {
  return {
    ...filters,
    from: filters.from ? new Date(filters.from).toISOString() : "",
    to: filters.to ? new Date(filters.to).toISOString() : "",
    limit: PAGE_SIZE,
  };
}

/** Changed values as "field: old → new"; fields whose values are not kept (personal data) by name only. */
export function describeChanges(changes: Record<string, unknown>): { values: string[]; fields: string[] } {
  const values: string[] = [];
  const recorded = changes.values;
  if (recorded && typeof recorded === "object") {
    for (const [field, change] of Object.entries(recorded as Record<string, { old?: unknown; new?: unknown }>)) {
      values.push(`${field}: ${JSON.stringify(change?.old ?? null)} → ${JSON.stringify(change?.new ?? null)}`);
    }
  }
  const fields = Array.isArray(changes.fields) ? (changes.fields as string[]) : [];
  if (!recorded) {
    for (const [field, value] of Object.entries(changes)) {
      if (field !== "fields") values.push(`${field}: ${JSON.stringify(value)}`);
    }
  }
  return { values, fields: fields.filter((field) => !(recorded && field in (recorded as object))) };
}

export function AuditLogView() {
  const copy = useAdminCopy();
  const { locale } = useLocale();
  const [draft, setDraft] = React.useState<Filters>(EMPTY);
  const [applied, setApplied] = React.useState<Filters>(EMPTY);
  const [entries, setEntries] = React.useState<AuditEntry[]>([]);
  const [cursor, setCursor] = React.useState<{ before: string; before_id: string } | null>(null);
  const [options, setOptions] = React.useState<{ actions: string[]; target_types: string[] }>({
    actions: [],
    target_types: [],
  });
  const [error, setError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const format = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" }),
    [locale],
  );

  React.useEffect(() => {
    let cancelled = false;
    void auditFilters()
      .then((result) => {
        if (!cancelled) setOptions(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void searchAudit(toQuery(applied))
      .then((page) => {
        if (cancelled) return;
        setEntries(page.items);
        setCursor(page.next_cursor);
        setError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setEntries([]);
        setCursor(null);
        setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applied]);

  function apply(next: Filters) {
    setLoading(true);
    setDraft(next);
    setApplied(next);
  }

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    try {
      const page = await searchAudit({ ...toQuery(applied), ...cursor });
      setEntries((current) => [...current, ...page.items]);
      setCursor(page.next_cursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function field(name: keyof Filters, label: string, type = "text") {
    const id = `audit-${name}`;
    return (
      <div className="grid gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          type={type}
          value={draft[name]}
          list={name === "action" ? "audit-actions" : undefined}
          onChange={(event) => setDraft((current) => ({ ...current, [name]: event.target.value }))}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <AdminHeader title={copy.auditTitle} description={copy.auditBody} />
      <form
        role="search"
        className="grid gap-4 rounded-card border border-border-subtle bg-surface-sunken/70 p-4 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          apply(draft);
        }}
      >
        {field("action", copy.auditActionFilter)}
        <datalist id="audit-actions">
          {options.actions.map((action) => (
            <option key={action} value={action} />
          ))}
        </datalist>
        <div className="grid gap-2">
          <Label htmlFor="audit-target_type">{copy.auditTargetTypeFilter}</Label>
          <NativeSelect
            id="audit-target_type"
            value={draft.target_type}
            onChange={(event) => setDraft((current) => ({ ...current, target_type: event.target.value }))}
          >
            <option value="">{copy.auditAnyOption}</option>
            {options.target_types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </NativeSelect>
        </div>
        {field("target_id", copy.auditTargetFilter)}
        {field("actor_id", copy.auditActorFilter)}
        {field("request_id", copy.auditRequestFilter)}
        <div className="grid grid-cols-2 gap-3">
          {field("from", copy.auditFrom, "datetime-local")}
          {field("to", copy.auditTo, "datetime-local")}
        </div>
        <div className="flex flex-wrap gap-2 md:col-span-3">
          <Button type="submit" disabled={loading}>
            <Search aria-hidden />
            {copy.auditSearch}
          </Button>
          <Button type="button" variant="outline" onClick={() => apply(EMPTY)}>
            <RotateCcw aria-hidden />
            {copy.auditReset}
          </Button>
        </div>
      </form>
      {error ? <Notice tone="danger">{copy.auditFailed}</Notice> : null}
      <TableShell>
        <thead>
          <tr>
            <th scope="col">{copy.auditWhen}</th>
            <th scope="col">{copy.auditActor}</th>
            <th scope="col">{copy.auditAction}</th>
            <th scope="col">{copy.auditTarget}</th>
            <th scope="col">{copy.auditChanges}</th>
            <th scope="col">{copy.auditReason}</th>
          </tr>
        </thead>
        <tbody aria-busy={loading}>
          {entries.length === 0 && !loading ? <EmptyRow colSpan={6} label={copy.auditEmpty} /> : null}
          {entries.map((entry) => {
            const changes = describeChanges(entry.changes ?? {});
            return (
              <tr key={entry.id}>
                <td className="whitespace-nowrap">
                  <time dateTime={entry.created_at}>{format.format(new Date(entry.created_at))}</time>
                  {entry.request_id ? (
                    <button
                      type="button"
                      className="block font-mono text-xs text-text-muted underline-offset-2 hover:underline"
                      onClick={() => apply({ ...EMPTY, request_id: entry.request_id ?? "" })}
                    >
                      {entry.request_id.slice(0, 12)}
                    </button>
                  ) : null}
                </td>
                <td>
                  {entry.actor.kind === "system" ? (
                    <Badge variant="outline">{copy.auditSystem}</Badge>
                  ) : (
                    <span className="grid">
                      <span>{entry.actor.display_name ?? entry.actor.id}</span>
                      <span className="font-mono text-xs text-text-muted">
                        {entry.actor.kind} · {entry.actor.id.slice(0, 8)}
                      </span>
                    </span>
                  )}
                </td>
                <td>
                  <Badge variant="outline" className="font-mono">
                    {entry.action}
                  </Badge>
                </td>
                <td className="font-mono text-xs">
                  <span className="block">{entry.target_type}</span>
                  {entry.target_id ? <span className="text-text-muted">{entry.target_id}</span> : null}
                </td>
                <td className="max-w-sm text-xs">
                  {changes.values.map((line) => (
                    <span key={line} className="block break-words font-mono">
                      {line}
                    </span>
                  ))}
                  {changes.fields.length > 0 ? (
                    <span className="block text-text-muted">
                      {copy.auditFieldsChanged}: {changes.fields.join(", ")}
                    </span>
                  ) : null}
                </td>
                <td className="max-w-xs">{entry.reason ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>
      {cursor ? (
        <div>
          <Button type="button" variant="outline" disabled={loading} onClick={() => void loadMore()}>
            <History aria-hidden />
            {copy.auditLoadMore}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
