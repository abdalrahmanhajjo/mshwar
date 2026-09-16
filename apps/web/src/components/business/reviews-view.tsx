"use client";

import * as React from "react";
import { usePortal } from "@/components/business/portal-provider";
import { BadgeCheck, MessageSquare, Reply, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { useBusinessCopy } from "@/lib/business-copy";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { fetchPortalReviews, respondToReview } from "@/lib/reviews";
import { useReviewCopy } from "@/lib/review-copy";

type PortalReview = {
  id: string;
  rating: number;
  body: string;
  experience_title: string;
  response?: { body: string; label: string } | null;
};

export function BusinessReviewsView() {
  const copy = useReviewCopy();
  const business = useBusinessCopy();
  const { org } = usePortal();
  const [items, setItems] = React.useState<PortalReview[]>([]);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    if (!org) {
      return;
    }
    setItems(await fetchPortalReviews(org.id));
  }, [org]);

  React.useEffect(() => {
    if (!org) {
      return;
    }
    let cancelled = false;
    void fetchPortalReviews(org.id)
      .then((rows) => {
        if (!cancelled) {
          setItems(rows);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [org]);

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow={business.portalKicker} title={copy.title} description={copy.respond} />
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      {items.length === 0 && !error ? (
        <EmptyState icon={<MessageSquare aria-hidden />} title={business.noReviewsYet} />
      ) : null}
      <ul className="grid gap-4">
        {items.map((review) => (
          <li key={review.id}>
            <Card>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
                <div className="grid gap-1">
                  <CardTitle as="h2">{review.experience_title}</CardTitle>
                  <CardDescription className="inline-flex items-center gap-1.5">
                    <BadgeCheck className="size-4 text-success" aria-hidden />
                    {copy.verified}
                  </CardDescription>
                </div>
                <span className="inline-flex items-center gap-0.5" aria-label={`${review.rating} / 5`}>
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star
                      key={index}
                      className={cn("size-4", index < review.rating ? "fill-accent text-accent" : "text-border")}
                      aria-hidden
                    />
                  ))}
                </span>
              </CardHeader>
              <CardContent className="grid gap-4">
                <p className="leading-relaxed">{review.body}</p>
                {review.response ? (
                  <div className="rounded-control border-s-2 border-brand bg-surface-sunken p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                      {review.response.label}
                    </p>
                    <p className="mt-1 text-sm">{review.response.body}</p>
                  </div>
                ) : (
                  <form
                    className="grid gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!org) {
                        return;
                      }
                      void respondToReview(org.id, review.id, drafts[review.id] ?? "")
                        .then(reload)
                        .catch((err: Error) => setError(err.message));
                    }}
                  >
                    <Textarea
                      aria-label={copy.respond}
                      value={drafts[review.id] ?? ""}
                      onChange={(event) => setDrafts((current) => ({ ...current, [review.id]: event.target.value }))}
                      minLength={3}
                      required
                    />
                    <Button type="submit" className="w-fit">
                      <Reply aria-hidden />
                      {copy.respond}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
