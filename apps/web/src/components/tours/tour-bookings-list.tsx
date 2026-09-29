"use client";

import * as React from "react";
import { CalendarCheck2, Loader2 } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/i18n/format";
import { tourBookingsList, type TourBooking } from "@/lib/tour-booking";
import { useTourBookingCopy, type TourBookingKey } from "@/lib/tour-booking-copy";
import { cn, focusRing } from "@/lib/utils";

/** /tour-bookings: the traveller's tour bookings, upcoming or past. */
export function TourBookingsList() {
  const copy = useTourBookingCopy();
  const { locale } = useLocale();
  const [when, setWhen] = React.useState<"upcoming" | "past">("upcoming");
  const [rows, setRows] = React.useState<TourBooking[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    tourBookingsList(when)
      .then((result) => {
        if (!cancelled) {
          setRows(Array.isArray(result) ? result : []);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [when]);

  return (
    <div className="grid gap-6">
      <PageHeader icon={<CalendarCheck2 aria-hidden />} title={copy.myToursTitle} description={copy.myToursBody} />
      <div
        role="tablist"
        aria-label={copy.myToursTitle}
        className="inline-flex w-fit rounded-pill border border-border-subtle p-1"
      >
        {(["upcoming", "past"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={when === tab}
            onClick={() => {
              setRows(null);
              setWhen(tab);
            }}
            className={cn(
              "rounded-pill px-4 py-1.5 text-sm font-medium",
              when === tab ? "bg-brand text-brand-foreground" : "text-text-muted",
              focusRing,
            )}
          >
            {copy[tab]}
          </button>
        ))}
      </div>
      {failed ? (
        <Notice tone="danger" role="alert">
          {copy.loadError}
        </Notice>
      ) : rows === null ? (
        <Loader2 className="mx-auto size-6 animate-spin text-text-muted" aria-hidden />
      ) : rows.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-card border border-dashed border-border-subtle p-8 text-center">
          <p className="text-text-muted">{when === "upcoming" ? copy.noUpcoming : copy.noPast}</p>
          <Button asChild>
            <LocaleLink href="/tours">{copy.findTour}</LocaleLink>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <LocaleLink
                href={`/tour-bookings/${row.id}`}
                className={cn(
                  "grid gap-1 rounded-card border border-border-subtle bg-surface-raised p-4 transition-colors hover:border-brand/50",
                  focusRing,
                )}
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{row.tour_title}</span>
                  <Badge
                    variant={row.status === "confirmed" ? "success" : row.status === "pending" ? "warning" : "outline"}
                  >
                    {copy[`status${row.status}` as TourBookingKey]}
                  </Badge>
                </span>
                <span className="text-sm text-text-muted">
                  {formatDate(locale, row.starts_at, {
                    dateStyle: undefined,
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Beirut",
                  })}
                  {" · "}
                  <span className="font-mono">{row.code}</span>
                </span>
              </LocaleLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
