"use client";

import * as React from "react";
import { BadgeCheck, Flag, Star } from "lucide-react";
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
  const headline = honestAverageLabel(aggregate);
  return (
    <div className="grid gap-3 rounded-card bg-surface-sunken/70 p-5">
      <p className="text-sm font-semibold">{headline}</p>
      <ul aria-label={copy.distribution} className="grid gap-1.5 text-sm">
        {["5", "4", "3", "2", "1"].map((star) => {
          const count = aggregate.distribution?.[star] ?? 0;
          const peak = Math.max(1, ...Object.values(aggregate.distribution ?? {}).map(Number));
          return (
            <li key={star}>
              <span className="sr-only">
                {star} · {count}
              </span>
              <span aria-hidden className="grid grid-cols-[2.5rem_1fr_2rem] items-center gap-3">
                <span className="inline-flex items-center gap-1 tabular-nums">
                  {star}
                  <Star className="size-3 fill-accent text-accent" />
                </span>
                <span className="h-1.5 overflow-hidden rounded-pill bg-brand-subtle" data-rtl-chart>
                  <span className="block h-full rounded-pill bg-brand" style={{ width: `${(count / peak) * 100}%` }} />
                </span>
                <span className="text-end tabular-nums text-text-muted">{count}</span>
              </span>
            </li>
          );
        })}
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
    let cancelled = false;
    void fetchReviews(listingSlug)
      .then((payload) => {
        if (!cancelled) {
          setItems(payload.items ?? []);
          setAggregate(payload.aggregate);
        }
        return fetchReviewEligibility(listingSlug);
      })
      .then((eligibility) => {
        if (!cancelled) {
          const next = eligibility.items.find((item) => item.eligible);
          setBookingId(next?.booking_id ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBookingId(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [listingSlug]);

  return (
    <section className="grid gap-5">
      <h3 className="title-card text-[1.5rem]">{copy.title}</h3>
      {aggregate ? <RatingSummary aggregate={aggregate} /> : null}
      {items.map((review) => (
        <Card key={review.id}>
          <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
            <CardTitle as="h4" className="inline-flex items-center gap-2 text-base">
              {review.verified ? <BadgeCheck className="size-4 text-success" aria-hidden /> : null}
              {review.verified ? copy.verified : copy.title}
            </CardTitle>
            <CardDescription className="inline-flex items-center gap-1 font-semibold text-text">
              <Star className="size-4 fill-accent text-accent" aria-hidden />
              {review.rating} / 5
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="leading-relaxed">{review.body}</p>
            {review.response ? (
              <div className="rounded-card border border-border bg-surface-sunken p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-text-muted">{review.response.label}</p>
                <p className="mt-1 text-sm">{review.response.body}</p>
              </div>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-fit text-text-muted"
              onClick={() => void reportReview(review.id, "Abuse or policy concern").then(reload)}
            >
              <Flag aria-hidden />
              {copy.report}
            </Button>
          </CardContent>
        </Card>
      ))}
      {bookingId ? (
        <form
          className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-6"
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
          <h4 className="title-card">{copy.write}</h4>
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
