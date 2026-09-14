"use client";

import * as React from "react";
import { usePortal } from "@/components/business/portal-provider";
import { Button } from "@/components/ui/button";
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
    void reload().catch((err: Error) => setError(err.message));
  }, [reload]);

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-4xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-2 text-text-muted">{copy.respond}</p>
      </header>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {items.map((review) => (
        <Card key={review.id}>
          <CardHeader>
            <CardTitle>{review.experience_title}</CardTitle>
            <CardDescription>
              {review.rating} / 5 · {copy.verified}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p>{review.body}</p>
            {review.response ? (
              <div className="rounded-card border border-border bg-surface-sunken p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-text-muted">{review.response.label}</p>
                <p className="mt-1 text-sm">{review.response.body}</p>
              </div>
            ) : (
              <form
                className="grid gap-2"
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
                  value={drafts[review.id] ?? ""}
                  onChange={(event) => setDrafts((current) => ({ ...current, [review.id]: event.target.value }))}
                  minLength={3}
                  required
                />
                <Button type="submit">{copy.respond}</Button>
              </form>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
