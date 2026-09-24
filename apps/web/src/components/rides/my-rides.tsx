"use client";

import * as React from "react";
import { Car, ChevronRight, Loader2, Plus } from "lucide-react";
import { money } from "@/components/local/shared";
import { RideSummary } from "@/components/partners/ride-summary";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { interpolate } from "@/i18n/catalogues";
import { useLocalCopy, type LocalKey } from "@/lib/local-copy";
import { fetchMyRides, type Ride, type RideRequest } from "@/lib/rides";
import { cn, focusRing } from "@/lib/utils";

function Row({ href, children, badge }: { href: string; children: React.ReactNode; badge: React.ReactNode }) {
  return (
    <li>
      <LocaleLink
        href={href}
        className={cn(
          "flex items-start gap-3 rounded-card border border-border-subtle bg-surface-raised p-4 transition-colors hover:border-border md:p-5",
          focusRing,
        )}
      >
        <div className="grid min-w-0 flex-1 gap-2">{children}</div>
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          <ChevronRight className="size-4 text-text-muted rtl:rotate-180" aria-hidden />
        </div>
      </LocaleLink>
    </li>
  );
}

/** /rides: open requests, booked rides, and what came before. */
export function MyRides() {
  const copy = useLocalCopy();
  const { locale } = useLocale();
  const [data, setData] = React.useState<{ requests: RideRequest[]; rides: Ride[] } | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void fetchMyRides()
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const header = (
    <PageHeader
      eyebrow={copy.driversTitle}
      icon={<Car aria-hidden />}
      title={copy.myRidesTitle}
      description={copy.myRidesBody}
      actions={
        <Button asChild>
          <LocaleLink href="/rides/new">
            <Plus aria-hidden />
            {copy.askPrice}
          </LocaleLink>
        </Button>
      }
    />
  );

  if (failed) {
    return (
      <div className="grid gap-6">
        {header}
        <Notice tone="danger" role="alert">
          {copy.loadError}
        </Notice>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="grid place-items-center py-20 text-text-muted">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    );
  }

  const open = data.requests.filter((request) => request.status === "open");
  const booked = data.rides.filter((ride) => ride.state === "confirmed");
  const earlier = [
    ...data.rides.filter((ride) => ride.state !== "confirmed").map((ride) => ({ kind: "ride" as const, ride })),
    ...data.requests
      .filter((request) => request.status === "cancelled" || request.status === "expired")
      .map((request) => ({ kind: "request" as const, request })),
  ];

  return (
    <div className="grid gap-8">
      {header}
      {open.length + booked.length + earlier.length === 0 ? (
        <EmptyState icon={<Car aria-hidden />} title={copy.noRides} description={copy.newRideBody} />
      ) : null}
      {booked.length ? (
        <section className="grid gap-3">
          <h2 className="title-section text-[1.2rem]">{copy.bookedRides}</h2>
          <ul className="grid gap-3">
            {booked.map((ride) => (
              <Row
                key={ride.id}
                href={`/rides/${ride.request.id}`}
                badge={<Badge variant="success">{copy.tstate_confirmed}</Badge>}
              >
                <RideSummary request={ride.request} />
                <p className="text-sm">
                  {ride.driver.display_name} · <span dir="ltr">{ride.vehicle.plate}</span> ·{" "}
                  {money(locale, ride.price_minor, ride.currency)}
                </p>
              </Row>
            ))}
          </ul>
        </section>
      ) : null}
      {open.length ? (
        <section className="grid gap-3">
          <h2 className="title-section text-[1.2rem]">{copy.openRequests}</h2>
          <ul className="grid gap-3">
            {open.map((request) => (
              <Row
                key={request.id}
                href={`/rides/${request.id}`}
                badge={
                  <Badge variant="warning">
                    {interpolate(copy.pricesN, {
                      n: String(request.quotes?.filter((q) => q.status === "offered").length ?? 0),
                    })}
                  </Badge>
                }
              >
                <RideSummary request={request} />
              </Row>
            ))}
          </ul>
        </section>
      ) : null}
      {earlier.length ? (
        <section className="grid gap-3">
          <h2 className="title-section text-[1.2rem]">{copy.pastRequests}</h2>
          <ul className="grid gap-3">
            {earlier.map((item) =>
              item.kind === "ride" ? (
                <Row
                  key={item.ride.id}
                  href={`/rides/${item.ride.request.id}`}
                  badge={<Badge variant="outline">{copy[`tstate_${item.ride.state}` as LocalKey]}</Badge>}
                >
                  <RideSummary request={item.ride.request} />
                </Row>
              ) : (
                <Row
                  key={item.request.id}
                  href={`/rides/${item.request.id}`}
                  badge={<Badge variant="outline">{copy[`req_${item.request.status}` as LocalKey]}</Badge>}
                >
                  <RideSummary request={item.request} />
                </Row>
              ),
            )}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
