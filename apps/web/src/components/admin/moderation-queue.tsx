"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { EyeOff } from "lucide-react";
import { AdminHeader, EmptyRow, ReasonField, TableShell } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { interpolate } from "@/i18n/translate";
import { bulkModerate, listModeration, moderateContent } from "@/lib/admin";
import { useAdminCopy } from "@/lib/admin-copy";

type Row = Record<string, unknown> & { id: string; entity_type?: string };

export function ModerationQueue() {
  const copy = useAdminCopy();
  const [type, setType] = React.useState("all");
  const [reason, setReason] = React.useState("Policy violation");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [listings, setListings] = React.useState<Row[]>([]);
  const [images, setImages] = React.useState<Row[]>([]);
  const [reviews, setReviews] = React.useState<Row[]>([]);
  const [responses, setResponses] = React.useState<Row[]>([]);
  const [confirm, setConfirm] = React.useState(false);

  const reload = React.useCallback(async () => {
    try {
      const payload = await listModeration(type === "all" ? undefined : type);
      setListings((payload.listings as Row[]) ?? []);
      setImages((payload.images as Row[]) ?? []);
      setReviews((payload.reviews as Row[]) ?? []);
      setResponses((payload.responses as Row[]) ?? []);
    } catch {
      setListings([]);
      setImages([]);
      setReviews([]);
      setResponses([]);
    }
  }, [type]);

  React.useEffect(() => {
    let cancelled = false;
    void listModeration(type === "all" ? undefined : type)
      .then((payload) => {
        if (!cancelled) {
          setListings((payload.listings as Row[]) ?? []);
          setImages((payload.images as Row[]) ?? []);
          setReviews((payload.reviews as Row[]) ?? []);
          setResponses((payload.responses as Row[]) ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setListings([]);
          setImages([]);
          setReviews([]);
          setResponses([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  const rows =
    type === "image"
      ? images
      : type === "review"
        ? reviews
        : type === "listing"
          ? listings
          : [...listings, ...images, ...reviews, ...responses];

  async function act(id: string, entityType: string, action: string) {
    await moderateContent(entityType, id, action, reason);
    await reload();
  }

  return (
    <div className="grid gap-8">
      <AdminHeader title={copy.moderationTitle} description={copy.originalPreserved} />
      <div className="grid gap-4 rounded-card border border-border-subtle bg-surface-sunken/70 p-4 md:grid-cols-[2fr_1fr] md:items-end">
        <ReasonField id="moderation-reason" value={reason} onChange={setReason} />
        <label className="grid gap-2 text-label font-medium">
          {copy.typeLabel}
          <NativeSelect aria-label="content type" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="all">all</option>
            <option value="listing">listing</option>
            <option value="image">image</option>
            <option value="review">review</option>
          </NativeSelect>
        </label>
      </div>
      <TableShell>
        <thead>
          <tr>
            <th scope="col" className="w-10">
              <span className="sr-only">{copy.bulk}</span>
            </th>
            <th scope="col">{copy.typeLabel}</th>
            <th scope="col">{copy.nameCol}</th>
            <th scope="col">{copy.actionsCol}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <EmptyRow colSpan={4} label={copy.queueEmpty} /> : null}
          {rows.map((row) => {
            const entityType = String(row.entity_type ?? type);
            const id = String(row.id);
            const text = String(row.title ?? row.body ?? row.alt_text ?? id);
            return (
              <tr key={`${entityType}-${id}`}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={text}
                    checked={selected.includes(id)}
                    onChange={(event) => {
                      setSelected((current) =>
                        event.target.checked ? [...current, id] : current.filter((item) => item !== id),
                      );
                    }}
                  />
                </td>
                <td>
                  <Badge variant="outline">{entityType}</Badge>
                </td>
                <td className="max-w-md">
                  <span className="line-clamp-2">{text}</span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    <Button type="button" size="sm" onClick={() => void act(id, entityType, "hide")}>
                      <EyeOff aria-hidden />
                      {copy.hide}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void act(id, entityType, "restore")}
                    >
                      {copy.restore}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void act(id, entityType, "escalate")}
                    >
                      {copy.escalate}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>
      <div className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface-raised p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <Badge variant="secondary">{interpolate(copy.selectedCount, { count: selected.length })}</Badge>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
            {copy.confirmBulk}
          </label>
        </div>
        <Button
          type="button"
          variant="destructive"
          disabled={!confirm || selected.length === 0}
          onClick={() =>
            void bulkModerate({
              entity_type: type === "all" ? "listing" : type,
              ids: selected,
              action: "hide",
              reason,
              confirm,
            }).then(reload)
          }
        >
          {copy.bulk}
        </Button>
      </div>
    </div>
  );
}
