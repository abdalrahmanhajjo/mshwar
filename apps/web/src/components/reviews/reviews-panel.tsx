"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Rating } from "@/components/ui/rating";
import { Textarea } from "@/components/ui/textarea";
import { useReviewCopy } from "@/lib/review-copy";
import {
  fetchReviewEligibility,
  fetchReviews,
  honestAverageLabel,
  reportReview,
  submitReview,
  type PublicReview,
  type ReviewAggregate,
} from "@/lib/reviews";

export function RatingSummary({ aggregate }: { aggregate: ReviewAggregate }) {
  const copy = useReviewCopy();
  const low = aggregate.low_sample || aggregate.count < 3;
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{honestAverageLabel(aggregate)}</p>
      {low ? <p className="text-sm text-text-muted">{copy.lowSample}</p> : null}
      <ul aria-label={copy.distribution} className="grid gap-1 text-sm">
        {["5", "4", "3", "2", "1"].map((star) => (
          <li key={star}>
            {star} · {aggregate.distribution?.[star] ?? 0}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReviewsPanel({ listingSlug }: { listingSlug: string }) {
  const copy = useReviewCopy();
  const [items, setItems] = React.useState<PublicReview[]>([]);
  const [aggregate, setAggregate] = React.useState<ReviewAggregate | null>(null);
  const [bookingId, setBookingId] = React.useState<string | null>(null);
  const [rating, setRating] = React.useState(5);
  const [body, setBody] = React.useState("");
  const [food, setFood] = React.useState(5);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    const payload = await fetchReviews(listingSlug);
    setItems(payload.items ?? []);
    setAggregate(payload.aggregate);
    try {
      const eligibility = await fetchReviewEligibility(listingSlug);
      const next = eligibility.items.find((item) => item.eligible);
      setBookingId(next?.booking_id ?? null);
    } catch {
      setBookingId(null);
    }
  }, [listingSlug]);

  React.useEffect(() => {
    void reload().catch(() => undefined);
  }, [reload]);

  return (
    <section className="grid gap-4">
      <h3 className="font-semibold">{copy.title}</h3>
      {aggregate ? <RatingSummary aggregate={aggregate} /> : null}
      {items.map((review) => (
        <Card key={review.id}>
          <CardHeader>
            <CardTitle className="text-base">{review.verified ? copy.verified : copy.title}</CardTitle>
            <CardDescription>{review.rating} / 5</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <p>{review.body}</p>
            {review.response ? (
              <div className="rounded-card border border-border bg-surface-sunken p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-text-muted">{review.response.label}</p>
                <p className="mt-1 text-sm">{review.response.body}</p>
              </div>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void reportReview(review.id, "Abuse or policy concern").then(reload)}
            >
              {copy.report}
            </Button>
          </CardContent>
        </Card>
      ))}
      {bookingId ? (
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submitReview({
              booking_id: bookingId,
              rating,
              body,
              dimensions: { food, service: food, value: food },
            })
              .then(() => {
                setBody("");
                return reload();
              })
              .catch((err: Error) => setError(err.message));
          }}
        >
          <h4 className="font-medium">{copy.write}</h4>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Rating label="Rating" value={rating} onValueChange={setRating} />
          <Rating label={copy.food} value={food} onValueChange={setFood} />
          <Textarea value={body} onChange={(event) => setBody(event.target.value)} required minLength={3} />
          <Button type="submit">{copy.submit}</Button>
        </form>
      ) : null}
    </section>
  );
}
