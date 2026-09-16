"use client";

import * as React from "react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  Eye,
  Heart,
  Inbox,
  Plus,
  Route,
  ShieldCheck,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import { interpolate } from "@/i18n/catalogues";
import { formatCurrency, formatNumber } from "@/i18n/format";
import { cn, focusRing } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBusinessCopy, CHECKLIST_LABELS } from "@/lib/business-copy";
import { createOrganization, getMetrics, metricDelta, metricsToCsv, type PortalMetrics } from "@/lib/portal";
import { usePortal } from "@/components/business/portal-provider";

export function DashboardView({ variant = "overview" }: { variant?: "overview" | "finance" }) {
  const copy = useBusinessCopy();
  const { locale } = useLocale();
  const { org, orgs, refresh, ready } = usePortal();
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [metrics, setMetrics] = React.useState<PortalMetrics | null>(null);
  const [from, setFrom] = React.useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = React.useState(() => new Date().toISOString().slice(0, 10));

  React.useEffect(() => {
    if (!org || org.role === "inventory" || org.role === "bookings") {
      return;
    }
    let cancelled = false;
    void getMetrics(org.id, `${from}T00:00:00.000Z`, `${to}T23:59:59.000Z`)
      .then((row) => {
        if (!cancelled) {
          setMetrics(row);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMetrics(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [from, org, to]);

  async function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await createOrganization(name);
      await refresh();
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.createOrg);
    } finally {
      setPending(false);
    }
  }

  if (!ready) {
    return (
      <div className="grid gap-4" aria-hidden>
        <div className="h-24 animate-pulse rounded-card bg-brand-subtle/50" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-card bg-brand-subtle/50" />
          ))}
        </div>
        <p className="sr-only">{copy.onboarding}</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="mx-auto grid w-full max-w-xl gap-6 rounded-[1.75rem] border border-border-subtle bg-surface-raised p-7 shadow-lg md:p-10">
        <span className="grid size-12 place-items-center rounded-full bg-brand-subtle">
          <Store className="size-5" aria-hidden />
        </span>
        <div className="grid gap-2">
          <p className="eyebrow">{copy.portalKicker}</p>
          <h1 className="title-page text-[2.4rem]">{copy.registerTitle}</h1>
          <p className="text-sm leading-relaxed text-text-muted">{copy.registerHint}</p>
        </div>
        <form className="grid gap-4" onSubmit={onCreate}>
          <div className="grid gap-2">
            <Label htmlFor="org-name">{copy.orgName}</Label>
            <Input id="org-name" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          {error ? (
            <Notice tone="danger" role="alert">
              {error}
            </Notice>
          ) : null}
          <Button type="submit" size="lg" disabled={pending}>
            {copy.createOrg}
          </Button>
        </form>
      </div>
    );
  }

  const items = org.onboarding.items;
  const done = items.filter((item) => item.done).length;
  const metricRows = [
    ["views", copy.views, Eye],
    ["saves", copy.saves, Heart],
    ["itinerary_inclusions", copy.inclusions, Route],
    ["requests", copy.requests, Inbox],
    ["confirmations", copy.confirmations, CalendarCheck],
    ["revenue_minor", copy.revenue, Wallet],
  ] as const;

  const rangeControls = metrics ? (
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-xs font-medium text-text-muted">
        {copy.fromLabel}
        <Input
          aria-label={copy.comparison}
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          className="min-h-10 w-40 py-1.5"
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-text-muted">
        {copy.toLabel}
        <Input
          aria-label={copy.metricsTitle}
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          className="min-h-10 w-40 py-1.5"
        />
      </label>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          const blob = new Blob([metricsToCsv(metrics)], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "metrics.csv";
          link.click();
          URL.revokeObjectURL(url);
        }}
      >
        <Download aria-hidden />
        {copy.exportCsv}
      </Button>
    </div>
  ) : null;

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={
          <>
            {copy.portalKicker} · {org.role}
            {orgs.length > 1 ? ` · ${orgs.length}` : ""}
          </>
        }
        title={variant === "finance" ? copy.financeTitle : org.name}
        description={variant === "finance" ? copy.financeBody : copy.dashboardBody}
        actions={
          <Badge variant={org.verification === "verified" ? "success" : "warning"} className="px-3 py-1 text-sm">
            {org.verification === "verified" ? (
              <BadgeCheck className="size-4" aria-hidden />
            ) : (
              <Clock className="size-4" aria-hidden />
            )}
            {org.verification === "verified" ? copy.verifiedBadge : org.verification}
          </Badge>
        }
      />
      {org.verification !== "verified" ? (
        <Notice tone="warning" role="status">
          {copy.pendingBanner}
        </Notice>
      ) : null}

      <section aria-labelledby="metrics-heading" className="grid gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-1">
            <h2 id="metrics-heading" className="title-card text-[1.5rem]">
              {copy.metricsTitle}
            </h2>
            <p className="text-sm text-text-muted">{copy.comparison}</p>
          </div>
          {rangeControls}
        </div>
        {metrics ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {metricRows.map(([key, label, Icon]) => {
              const current = metrics.current[key] ?? 0;
              const previous = metrics.previous[key] ?? 0;
              const peak = Math.max(current, previous, 1);
              const delta = metricDelta(current, previous);
              return (
                <StatCard
                  key={key}
                  label={label}
                  icon={<Icon aria-hidden />}
                  value={
                    key === "revenue_minor"
                      ? formatCurrency(locale, current / 100, "USD", { maximumFractionDigits: 0 })
                      : formatNumber(locale, current)
                  }
                  hint={
                    <span className={cn(delta < 0 ? "text-danger" : "text-success", "font-medium")}>
                      {delta > 0 ? "+" : ""}
                      {key === "revenue_minor"
                        ? formatCurrency(locale, delta / 100, "USD", { maximumFractionDigits: 0 })
                        : formatNumber(locale, delta)}
                    </span>
                  }
                  progress={(current / peak) * 100}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<BarChart3 aria-hidden />} title={copy.metricsTitle} description={copy.comparison} />
        )}
      </section>

      {variant === "overview" ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div className="grid gap-1.5">
                <CardTitle as="h2">{copy.checklist}</CardTitle>
                <CardDescription>
                  {interpolate(copy.checklistProgress, { done: String(done), total: String(items.length) })}
                </CardDescription>
              </div>
              <span className="text-2xl font-semibold tabular-nums">
                {items.length ? Math.round((done / items.length) * 100) : 0}%
              </span>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Progress value={items.length ? (done / items.length) * 100 : 0} label={copy.onboarding} />
              <ul className="grid gap-2 text-sm">
                {items.map((item) => (
                  <li
                    key={item.key}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-control px-3.5 py-2.5",
                      item.done ? "bg-success-subtle/60" : "bg-surface-sunken",
                    )}
                  >
                    <span className={cn(item.done && "text-text-muted line-through decoration-border")}>
                      {copy[CHECKLIST_LABELS[item.key] ?? "itemOrg"]}
                    </span>
                    {item.done ? (
                      <CheckCircle2 className="size-4 text-success" aria-label="✓" />
                    ) : (
                      <Circle className="size-4 text-text-muted" aria-label="–" />
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle as="h2">{copy.quickActions}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {[
                { href: "/business/listings/new", label: copy.newListing, icon: Plus },
                { href: "/business/bookings", label: copy.inboxTitle, icon: Inbox },
                { href: "/business/team", label: copy.teamTitle, icon: Users },
                { href: "/business/settings", label: copy.submitVerification, icon: ShieldCheck },
              ].map((action) => (
                <LocaleLink
                  key={action.href}
                  href={action.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-control border border-border-subtle px-4 py-3 text-sm font-medium transition-colors hover:border-brand/40 hover:bg-brand-subtle/40",
                    focusRing,
                  )}
                >
                  <span className="grid size-9 place-items-center rounded-full bg-brand-subtle">
                    <action.icon className="size-4" aria-hidden />
                  </span>
                  {action.label}
                  <ArrowRight
                    className="ms-auto size-4 text-text-muted transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
                    aria-hidden
                  />
                </LocaleLink>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
