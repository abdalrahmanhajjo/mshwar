"use client";

import * as React from "react";
import { Gauge, Loader2, Search } from "lucide-react";
import { GuideLevelBadge } from "@/components/guide/guide-level";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import { ApiError } from "@/lib/api/client";
import {
  addGuideStrike,
  fetchAdminGuideQuality,
  fetchAdminGuideReviews,
  moderateGuideReview,
  ratedParts,
  voidGuideStrike,
  type AdminGuideQuality,
  type AdminGuideReview,
  type Strike,
} from "@/lib/guide-quality";
import { useGuideQualityCopy, type GuideQualityKey } from "@/lib/guide-quality-copy";
import { focusRing } from "@/lib/utils";

const KINDS: Strike["kind"][] = ["no_show", "safety", "conduct", "guide_cancellation", "other"];
const FILTERS = ["all", "low", "hidden", "replied"] as const;
type ReviewFilter = (typeof FILTERS)[number];

/** /admin/guide-quality: levels, scores and strikes, and guide review moderation. */
export function GuideQualityAdmin() {
  const copy = useGuideQualityCopy();
  return (
    <div className="grid gap-8">
      <PageHeader icon={<Gauge aria-hidden />} title={copy.adminTitle} description={copy.adminBody} />
      <GuidesBoard />
      <ReviewsBoard />
    </div>
  );
}

function GuidesBoard() {
  const copy = useGuideQualityCopy();
  const [query, setQuery] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [loaded, setLoaded] = React.useState<{ search: string; rows: AdminGuideQuality[] | null } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchAdminGuideQuality(search)
      .then((rows) => {
        if (!cancelled) setLoaded({ search, rows });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ search, rows: null });
      });
    return () => {
      cancelled = true;
    };
  }, [search]);

  const current = loaded?.search === search ? loaded : null;

  async function act(action: () => Promise<AdminGuideQuality[]>) {
    setError(null);
    try {
      setLoaded({ search, rows: await action() });
      return true;
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
      return false;
    }
  }

  return (
    <section aria-labelledby="guides-board" className="grid gap-4">
      <form
        className="flex max-w-md items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(query.trim());
        }}
      >
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="guide-search">{copy.adminSearch}</Label>
          <Input id="guide-search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <Button type="submit" variant="outline" aria-label={copy.adminSearch}>
          <Search aria-hidden />
        </Button>
      </form>
      <h2 id="guides-board" className="sr-only">
        {copy.adminTitle}
      </h2>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      {current === null ? (
        <Loader2 className="mx-auto size-6 animate-spin text-text-muted" aria-hidden />
      ) : current.rows === null ? (
        <Notice tone="danger" role="alert">
          {copy.loadError}
        </Notice>
      ) : current.rows.length === 0 ? (
        <p className="text-sm text-text-muted">{copy.adminEmpty}</p>
      ) : (
        <ul className="grid gap-3">
          {current.rows.map((row) => (
            <GuideRow key={row.id} row={row} act={act} />
          ))}
        </ul>
      )}
    </section>
  );
}

function GuideRow({
  row,
  act,
}: {
  row: AdminGuideQuality;
  act: (action: () => Promise<AdminGuideQuality[]>) => Promise<boolean>;
}) {
  const copy = useGuideQualityCopy();
  const { locale } = useLocale();
  const [adding, setAdding] = React.useState(false);
  const [kind, setKind] = React.useState<Strike["kind"]>("no_show");
  const [reason, setReason] = React.useState("");
  const [voiding, setVoiding] = React.useState<string | null>(null);
  const [voidReason, setVoidReason] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function run(action: () => Promise<AdminGuideQuality[]>, done: () => void) {
    setPending(true);
    if (await act(action)) done();
    setPending(false);
  }

  return (
    <li className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4">
      <div className="flex flex-wrap items-center gap-2">
        <LocaleLink href={`/guides/${row.slug}`} className={`font-semibold hover:underline ${focusRing}`}>
          {row.display_name}
        </LocaleLink>
        <GuideLevelBadge level={row.level} />
        {row.status !== "approved" ? <Badge variant="outline">{row.status}</Badge> : null}
        {row.paused_until ? (
          <Badge variant="outline">
            {interpolate(copy.pausedBadge, { date: formatDate(locale, row.paused_until) })}
          </Badge>
        ) : null}
        <span className="text-sm text-text-muted">
          {copy.adminScore}: {row.score === null ? "—" : Number(row.score).toFixed(3)} · {copy.adminStrikes}:{" "}
          {row.active_strikes}
        </span>
      </div>
      {row.strikes.length ? (
        <ul className="grid gap-1.5 text-sm">
          {row.strikes.map((strike) => (
            <li key={strike.id} className="flex flex-wrap items-center gap-2">
              <span className={strike.active ? "font-medium" : "text-text-muted line-through"}>
                {copy[`strike${strike.kind}` as GuideQualityKey]} · {formatDate(locale, strike.created_at)} ·{" "}
                {strike.reason}
              </span>
              {strike.active && voiding !== strike.id ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => setVoiding(strike.id)}>
                  {copy.adminVoid}
                </Button>
              ) : null}
              {voiding === strike.id ? (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(
                      () => voidGuideStrike(strike.id, voidReason.trim()),
                      () => {
                        setVoiding(null);
                        setVoidReason("");
                      },
                    );
                  }}
                >
                  <Input
                    aria-label={copy.adminVoidReason}
                    placeholder={copy.adminVoidReason}
                    value={voidReason}
                    maxLength={500}
                    onChange={(event) => setVoidReason(event.target.value)}
                  />
                  <Button type="submit" size="sm" disabled={pending || voidReason.trim().length < 3}>
                    {copy.save}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setVoiding(null)}>
                    {copy.cancel}
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {adding ? (
        <form
          className="grid gap-2 sm:grid-cols-[12rem_1fr_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              async () => (await addGuideStrike(row.id, kind, reason.trim())).guides,
              () => {
                setAdding(false);
                setReason("");
              },
            );
          }}
        >
          <div className="grid gap-1">
            <Label htmlFor={`kind-${row.id}`}>{copy.adminKind}</Label>
            <NativeSelect
              id={`kind-${row.id}`}
              value={kind}
              onChange={(event) => setKind(event.target.value as Strike["kind"])}
            >
              {KINDS.map((item) => (
                <option key={item} value={item}>
                  {copy[`strike${item}` as GuideQualityKey]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`reason-${row.id}`}>{copy.adminReason}</Label>
            <Input
              id={`reason-${row.id}`}
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={pending || reason.trim().length < 3}>
              {copy.save}
            </Button>
          </div>
          <div className="flex items-end">
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              {copy.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => setAdding(true)}>
          {copy.adminAddStrike}
        </Button>
      )}
    </li>
  );
}

function ReviewsBoard() {
  const copy = useGuideQualityCopy();
  const { locale } = useLocale();
  const [filter, setFilter] = React.useState<ReviewFilter>("all");
  const [loaded, setLoaded] = React.useState<{ filter: ReviewFilter; rows: AdminGuideReview[] | null } | null>(null);
  const [reasons, setReasons] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchAdminGuideReviews(filter)
      .then((rows) => {
        if (!cancelled) setLoaded({ filter, rows });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ filter, rows: null });
      });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const current = loaded?.filter === filter ? loaded : null;

  async function moderate(review: AdminGuideReview, action: "hide" | "show" | "remove_reply") {
    setError(null);
    try {
      await moderateGuideReview(review.id, action, (reasons[review.id] ?? "").trim());
      setLoaded({ filter, rows: await fetchAdminGuideReviews(filter) });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    }
  }

  return (
    <section aria-labelledby="reviews-board" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="reviews-board" className="title-section text-[1.25rem]">
          {copy.adminReviewsTitle}
        </h2>
        <div className="grid w-56 gap-1">
          <Label htmlFor="review-filter">{copy.adminFilter}</Label>
          <NativeSelect
            id="review-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value as ReviewFilter)}
          >
            {FILTERS.map((item) => (
              <option key={item} value={item}>
                {copy[`filter${item}` as GuideQualityKey]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      {current === null ? (
        <Loader2 className="mx-auto size-6 animate-spin text-text-muted" aria-hidden />
      ) : current.rows === null ? (
        <Notice tone="danger" role="alert">
          {copy.loadError}
        </Notice>
      ) : current.rows.length === 0 ? (
        <p className="text-sm text-text-muted">{copy.adminEmpty}</p>
      ) : (
        <ul className="grid gap-3">
          {current.rows.map((review) => (
            <li
              key={review.id}
              className="grid gap-2 rounded-card border border-border-subtle bg-surface-raised p-4 text-sm"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{review.rating}/5</span>
                <span className="text-text-muted">
                  {[review.author, review.guide.display_name, formatDate(locale, review.created_at)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {!review.released ? <Badge variant="outline">{copy.adminNotReleased}</Badge> : null}
                {review.hidden ? (
                  <Badge variant="outline">{interpolate(copy.adminHidden, { reason: review.hidden_reason })}</Badge>
                ) : null}
              </span>
              {review.body ? <p className="whitespace-pre-line">{review.body}</p> : null}
              {ratedParts(review.parts).length ? (
                <p className="text-xs text-text-muted">
                  {ratedParts(review.parts)
                    .map(([key, value]) => `${copy[`part${key}` as GuideQualityKey]} ${value}/5`)
                    .join(" · ")}
                </p>
              ) : null}
              {review.reply ? (
                <p className="ms-4 border-s-2 border-border-strong ps-3">
                  <span className="block text-xs text-text-muted">
                    {interpolate(copy.replyFrom, { name: review.guide.display_name })}
                  </span>
                  {review.reply}
                </p>
              ) : null}
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  className="max-w-xs"
                  aria-label={copy.adminReason}
                  placeholder={copy.adminReason}
                  maxLength={300}
                  value={reasons[review.id] ?? ""}
                  onChange={(event) => setReasons((all) => ({ ...all, [review.id]: event.target.value }))}
                />
                {review.hidden ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => void moderate(review, "show")}>
                    {copy.adminShow}
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={() => void moderate(review, "hide")}>
                    {copy.adminHide}
                  </Button>
                )}
                {review.reply ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => void moderate(review, "remove_reply")}>
                    {copy.adminRemoveReply}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
