"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
    <Card>
      <CardHeader>
        <CardTitle>{copy.moderationTitle}</CardTitle>
        <CardDescription>{copy.originalPreserved}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Input aria-label="reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        <label className="grid gap-1 text-sm">
          Type
          <select
            aria-label="content type"
            className="rounded-control border border-border bg-surface-raised px-3 py-2"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="all">all</option>
            <option value="listing">listing</option>
            <option value="image">image</option>
            <option value="review">review</option>
          </select>
        </label>
        <ul className="grid gap-2">
          {rows.map((row) => {
            const entityType = String(row.entity_type ?? type);
            const id = String(row.id);
            return (
              <li
                key={`${entityType}-${id}`}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2"
              >
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(id)}
                    onChange={(event) => {
                      setSelected((current) =>
                        event.target.checked ? [...current, id] : current.filter((item) => item !== id),
                      );
                    }}
                  />
                  <span>{String(row.title ?? row.body ?? row.alt_text ?? id)}</span>
                </label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={() => void act(id, entityType, "hide")}>
                    {copy.hide}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void act(id, entityType, "restore")}>
                    {copy.restore}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void act(id, entityType, "escalate")}
                  >
                    {copy.escalate}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
          {copy.confirmBulk}
        </label>
        <Button
          type="button"
          variant="outline"
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
      </CardContent>
    </Card>
  );
}
