"use client";

import * as React from "react";
import { AlertTriangle, Gauge, Loader2, Medal } from "lucide-react";
import { GuideLevelBadge } from "@/components/guide/guide-level";
import { ApprovedGuide } from "@/components/guide/guide-provider";
import { useLocale } from "@/components/shell/locale-provider";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import { fetchMyQuality, nextLevelGaps, RANK_PARTS, type MyQuality } from "@/lib/guide-quality";
import { useGuideQualityCopy, type GuideQualityKey } from "@/lib/guide-quality-copy";

/** /guide/quality: the guide's level, what the next one needs, ranking parts and strikes. */
export function GuideQuality() {
  return <ApprovedGuide>{() => <QualityView />}</ApprovedGuide>;
}

function QualityView() {
  const copy = useGuideQualityCopy();
  const { locale } = useLocale();
  const [quality, setQuality] = React.useState<MyQuality | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetchMyQuality()
      .then((value) => {
        if (!cancelled) setQuality(value);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <Notice tone="danger" role="alert">
        {copy.loadError}
      </Notice>
    );
  }
  if (!quality) {
    return <Loader2 className="mx-auto size-6 animate-spin text-text-muted" aria-hidden />;
  }

  const day = (iso: string) => formatDate(locale, iso, { dateStyle: "long" });
  const levelName = (level: string) =>
    level === "top" ? copy.levelTop : level === "trusted" ? copy.levelTrusted : copy.levelNew;
  const target = quality.earned === "new" ? "trusted" : quality.earned === "trusted" ? "top" : null;
  const gaps = nextLevelGaps(quality);
  const s = quality.stats;

  return (
    <div className="grid gap-6">
      <PageHeader icon={<Gauge aria-hidden />} title={copy.qualityTitle} description={copy.qualityBody} />

      {quality.paused_until ? (
        <Notice tone="warning" role="status">
          {interpolate(copy.pausedUntil, { date: day(quality.paused_until) })}
        </Notice>
      ) : null}

      <section
        aria-labelledby="level-title"
        className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6"
      >
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="level-title" className="title-section flex items-center gap-2 text-[1.15rem]">
            <Medal className="size-4 text-text-muted" aria-hidden />
            {copy.yourLevel}: {levelName(quality.level)}
          </h2>
          <GuideLevelBadge level={quality.level} />
        </div>
        {quality.held_until ? (
          <Notice tone="warning">{interpolate(copy.heldUntil, { date: day(quality.held_until) })}</Notice>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={copy.statRuns} value={s.completed_runs} />
          <StatCard label={copy.statRating} value={s.rating === null ? "—" : s.rating.toFixed(1)} />
          <StatCard
            label={copy.statAnswered}
            value={s.answered_24h_rate === null ? "—" : `${Math.round(s.answered_24h_rate * 100)}%`}
          />
          <StatCard label={copy.statCancel} value={`${Math.round(s.cancel_rate * 100)}%`} />
        </div>
        {target ? (
          <div className="grid gap-2">
            <h3 className="font-semibold">{interpolate(copy.nextLevel, { level: levelName(target) })}</h3>
            <ul className="grid gap-1 text-sm">
              {gaps.map((gap) => (
                <li key={gap.key}>
                  {interpolate(copy[`gap${gap.key}` as GuideQualityKey], { have: gap.have, need: gap.need })}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm">{copy.atTop}</p>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">{copy.thresholdsTitle}</summary>
          <ul className="mt-2 grid gap-1 text-text-muted">
            <li>{copy.thresholdsTrusted}</li>
            <li>{copy.thresholdsTop}</li>
          </ul>
        </details>
      </section>

      <section
        aria-labelledby="ranking-title"
        className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6"
      >
        <h2 id="ranking-title" className="title-section text-[1.15rem]">
          {copy.rankingTitle}
        </h2>
        <p className="text-sm text-text-muted">{copy.rankingBody}</p>
        <ul className="grid gap-3">
          {RANK_PARTS.map((part) => {
            const value = quality.ranking.parts[part] ?? 0;
            const percent = Math.round(value * 100);
            return (
              <li key={part} className="grid gap-1">
                <span className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{copy[`rank${part}` as GuideQualityKey]}</span>
                  <span className="tabular-nums text-text-muted">{percent}%</span>
                </span>
                <span
                  className="h-2 overflow-hidden rounded-full bg-surface-sunken"
                  role="meter"
                  aria-label={copy[`rank${part}` as GuideQualityKey]}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <span className="block h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
                </span>
                {value < 0.8 ? (
                  <span className="text-xs text-text-muted">{copy[`tip${part}` as GuideQualityKey]}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
        {quality.ranking.boost >= 0.05 && quality.level === "new" ? (
          <p className="text-sm text-text-muted">{copy.newBoost}</p>
        ) : null}
      </section>

      <section
        aria-labelledby="strikes-title"
        className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6"
      >
        <h2 id="strikes-title" className="title-section flex items-center gap-2 text-[1.15rem]">
          <AlertTriangle className="size-4 text-text-muted" aria-hidden />
          {copy.strikesTitle}
        </h2>
        <p className="text-sm text-text-muted">{copy.strikesBody}</p>
        {quality.strikes.length === 0 ? (
          <p className="text-sm">{copy.strikesNone}</p>
        ) : (
          <ul className="grid gap-2">
            {quality.strikes.map((strike) => (
              <li
                key={strike.id}
                className="grid gap-0.5 rounded-control border border-border-subtle bg-surface px-3 py-2 text-sm"
              >
                <span className="font-medium">
                  {copy[`strike${strike.kind}` as GuideQualityKey]} · {day(strike.created_at)}
                </span>
                <span>{strike.reason}</span>
                <span className="text-xs text-text-muted">
                  {[
                    strike.automatic ? copy.strikeAutomatic : null,
                    strike.active
                      ? interpolate(copy.strikeExpires, { date: day(strike.expires_at) })
                      : strike.voided_at
                        ? copy.strikeWithdrawn
                        : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
