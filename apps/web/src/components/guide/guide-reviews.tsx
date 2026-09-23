"use client";

import * as React from "react";
import { Loader2, MessageSquareQuote, Send, Star } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Rating } from "@/components/ui/rating";
import { Textarea } from "@/components/ui/textarea";
import { ApprovedGuide } from "@/components/guide/guide-provider";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import { ApiError } from "@/lib/api/client";
import { useGuideDayCopy } from "@/lib/guide-day-copy";
import { fetchReviewInbox, writeGuideReview, type PublicGuideReviews, type ReviewInbox } from "@/lib/guide-day";

/** One half of a review. Stays private until the other half exists. */
export function ReviewForm({
  runId,
  travellerId,
  heading,
  onSent,
}: {
  runId: string;
  travellerId?: string;
  heading: string;
  onSent: () => void;
}) {
  const copy = useGuideDayCopy();
  const [rating, setRating] = React.useState(0);
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const id = `${runId}-${travellerId ?? "guide"}`;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await writeGuideReview({ run_id: runId, traveller_id: travellerId, rating, body: body.trim() });
      setDone(result.released ? copy.sentReleased : copy.sent);
      onSent();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <Notice tone="success" role="status">
        {done}
      </Notice>
    );
  }
  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5"
      aria-label={heading}
    >
      <h3 className="font-semibold">{heading}</h3>
      <Rating value={rating} onValueChange={setRating} label={copy.ratingLabel} />
      <div className="grid gap-1.5">
        <Label htmlFor={`body-${id}`}>{copy.reviewBody}</Label>
        <Textarea id={`body-${id}`} rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <Button type="submit" className="w-fit" disabled={pending || rating === 0}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        {copy.send}
      </Button>
    </form>
  );
}

export function ReviewList({
  rows,
  empty,
}: {
  rows: { id?: string; rating: number; body: string; created_at: string; title?: string; author?: string }[];
  empty: string;
}) {
  const { locale } = useLocale();
  if (!rows.length) {
    return <p className="text-sm text-text-muted">{empty}</p>;
  }
  return (
    <ul className="grid gap-3">
      {rows.map((row, index) => (
        <li key={row.id ?? index} className="grid gap-1 rounded-card border border-border-subtle bg-surface-raised p-4">
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-0.5 font-semibold" aria-label={`${row.rating}/5`}>
              {row.rating}
              <Star className="size-3.5 fill-current" aria-hidden />
            </span>
            <span className="text-text-muted">
              {[row.author, row.title, formatDate(locale, row.created_at)].filter(Boolean).join(" · ")}
            </span>
          </span>
          {row.body ? (
            <p className="flex gap-2 text-sm">
              <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
              {row.body}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function useInbox() {
  const [inbox, setInbox] = React.useState<ReviewInbox | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    void fetchReviewInbox()
      .then((next) => {
        if (!cancelled) {
          setInbox(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [version]);
  return { inbox, failed, reload: () => setVersion((value) => value + 1) };
}

function GuideSide() {
  const copy = useGuideDayCopy();
  // The thank-you note replaces the form; the list refreshes on the next visit.
  const { inbox, failed } = useInbox();
  const refresh = () => undefined;
  if (failed) {
    return (
      <Notice tone="danger" role="alert">
        {copy.loadError}
      </Notice>
    );
  }
  if (!inbox) {
    return (
      <div className="grid place-items-center py-16 text-text-muted">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    );
  }
  return (
    <div className="grid gap-8">
      <PageHeader eyebrow={copy.reviewsKicker} title={copy.reviewsTitle} description={copy.reviewsBody} />
      {inbox.waiting_to_release ? (
        <Notice role="status">{interpolate(copy.waiting, { n: String(inbox.waiting_to_release) })}</Notice>
      ) : null}
      <section className="grid gap-3" aria-labelledby="to-write">
        <h2 id="to-write" className="title-section text-[1.15rem]">
          {copy.toWrite}
        </h2>
        {inbox.to_review_as_guide.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {inbox.to_review_as_guide.map((row) => (
              <ReviewForm
                key={`${row.run_id}-${row.traveller_id}`}
                runId={row.run_id}
                travellerId={row.traveller_id}
                heading={`${row.traveller_name} · ${row.title}`}
                onSent={refresh}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">{copy.toWriteEmpty}</p>
        )}
      </section>
      <section className="grid gap-3" aria-labelledby="about-you">
        <h2 id="about-you" className="title-section text-[1.15rem]">
          {copy.aboutYou}
        </h2>
        <ReviewList rows={inbox.about_me_as_guide} empty={copy.aboutYouEmpty} />
      </section>
    </div>
  );
}

/** /guide/reviews: the reviews view, lifted, with the traveller-review half added. */
export function GuideReviews() {
  return <ApprovedGuide>{() => <GuideSide />}</ApprovedGuide>;
}

/** /guides/review: a traveller's half, for every guide they spent a day with. */
export function TravellerGuideReviews() {
  const copy = useGuideDayCopy();
  // The thank-you note replaces the form; the list refreshes on the next visit.
  const { inbox, failed } = useInbox();
  const refresh = () => undefined;
  if (failed) {
    return (
      <Notice tone="danger" role="alert">
        {copy.loadError}
      </Notice>
    );
  }
  if (!inbox) {
    return (
      <div className="grid place-items-center py-16 text-text-muted">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    );
  }
  return (
    <div className="grid gap-8">
      <PageHeader eyebrow={copy.reviewsKicker} title={copy.travellerTitle} description={copy.travellerBody} />
      {inbox.to_review_as_traveller.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {inbox.to_review_as_traveller.map((row) => (
            <div key={row.run_id} className="grid gap-2">
              <LocaleLink href={`/guides/${row.guide_slug}`} className="text-sm underline">
                {row.guide_name}
              </LocaleLink>
              <ReviewForm runId={row.run_id} heading={row.title} onSent={refresh} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-muted">{copy.toWriteEmpty}</p>
      )}
      <section className="grid gap-3" aria-labelledby="about-you-traveller">
        <h2 id="about-you-traveller" className="title-section text-[1.15rem]">
          {copy.aboutYouTraveller}
        </h2>
        <ReviewList rows={inbox.about_me_as_traveller} empty={copy.aboutYouEmpty} />
      </section>
    </div>
  );
}

/** Released reviews on a guide's public page. */
export function PublicGuideReviewsSection({ reviews }: { reviews: PublicGuideReviews | null }) {
  const copy = useGuideDayCopy();
  return (
    <section className="grid gap-3" aria-labelledby="guide-reviews">
      <h2 id="guide-reviews" className="title-section text-[1.35rem]">
        {copy.publicTitle}
      </h2>
      {reviews && reviews.count > 0 ? (
        <>
          <p className="font-medium">
            {interpolate(copy.publicSummary, { average: String(reviews.average ?? ""), n: String(reviews.count) })}
          </p>
          <ReviewList rows={reviews.recent} empty={copy.publicEmpty} />
        </>
      ) : (
        <p className="text-sm text-text-muted">{copy.publicEmpty}</p>
      )}
    </section>
  );
}
