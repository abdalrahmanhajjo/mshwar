"use client";

import * as React from "react";
import { ArrowUpRight, Car, Loader2 } from "lucide-react";
import { SourceList } from "@/components/local/source-list";
import {
  fetchDestinationServiceSources,
  type DestinationServiceSource,
  type ServiceCategory,
} from "@/lib/destination-service-sources";
import { ChangerList } from "@/components/local/changer-list";
import { DriverCardView } from "@/components/local/driver-card";
import { TransportCardView } from "@/components/local/transport-card";
import { VenueCardView } from "@/components/local/venue-card";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SectionHeader } from "@/components/ui/page-header";
import { interpolate } from "@/i18n/catalogues";
import { fetchDestinationChangers, type Branch } from "@/lib/exchange";
import { useLocalCopy } from "@/lib/local-copy";
import { fetchDrivers, type DriverCard } from "@/lib/rides";
import { fetchDestinationTransport, type DestinationTransport, type TransportCard } from "@/lib/transport";
import { cn, focusRing } from "@/lib/utils";
import { fetchEatAndStay, type EatAndStay } from "@/lib/venues";

type Part<T> = { state: "loading" } | { state: "ready"; data: T } | { state: "failed" };

function usePart<T>(load: () => Promise<T>, key: string): Part<T> {
  const [part, setPart] = React.useState<{ key: string; value: Part<T> }>({ key, value: { state: "loading" } });
  const loader = React.useRef(load);
  React.useEffect(() => {
    loader.current = load;
  });
  React.useEffect(() => {
    let cancelled = false;
    void loader
      .current()
      .then((data) => {
        if (!cancelled) setPart({ key, value: { state: "ready", data } });
      })
      .catch(() => {
        if (!cancelled) setPart({ key, value: { state: "failed" } });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return part.key === key ? part.value : { state: "loading" };
}

function PartBody<T>({ part, children }: { part: Part<T>; children: (data: T) => React.ReactNode }) {
  const copy = useLocalCopy();
  if (part.state === "loading") {
    return (
      <div className="grid place-items-center py-10 text-text-muted" aria-busy="true">
        <Loader2 className="size-5 animate-spin" aria-hidden />
      </div>
    );
  }
  if (part.state === "failed") {
    return (
      <Notice tone="warning" role="status">
        {copy.loadError}
      </Notice>
    );
  }
  return <>{children(part.data)}</>;
}

function CardGroup({ title, cards }: { title: string; cards: TransportCard[] }) {
  if (cards.length === 0) {
    return null;
  }
  return (
    <div className="grid gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-text-muted">{title}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <TransportCardView key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid scroll-mt-24 gap-5">
      <h2 id={`${id}-title`} className="title-section text-[1.6rem]">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * The practical half of a destination page: sourced referrals alongside partners
 * with field/document checks. Each part loads on
 * its own so one slow service never blanks the others.
 */
export function DestinationServices({ slug, name }: { slug: string; name: string }) {
  const copy = useLocalCopy();
  const sources = usePart<DestinationServiceSource[]>(() => fetchDestinationServiceSources(slug), `s:${slug}`);
  const sourced = (category: ServiceCategory) =>
    sources.state === "ready" ? sources.data.filter((entry) => entry.category === category) : [];
  const sourceSection = (category: ServiceCategory) => (
    <PartBody part={sources}>{() => <SourceList entries={sourced(category)} />}</PartBody>
  );
  const transport = usePart<DestinationTransport>(() => fetchDestinationTransport(slug), `t:${slug}`);
  const drivers = usePart<DriverCard[]>(() => fetchDrivers(slug), `d:${slug}`);
  const changers = usePart<Branch[]>(() => fetchDestinationChangers(slug), `c:${slug}`);
  const venues = usePart<EatAndStay>(() => fetchEatAndStay(slug), `v:${slug}`);
  const links = [
    { href: "#getting-there", label: copy.navTransport },
    { href: "#drivers", label: copy.navDrivers },
    { href: "#money", label: copy.navMoney },
    { href: "#eat", label: copy.navEat },
    { href: "#stay", label: copy.navStay },
  ];

  return (
    <div className="shell-frame grid gap-14 pb-20">
      <div className="grid gap-5">
        <SectionHeader eyebrow={copy.localKicker} title={interpolate(copy.localTitle, { name })} />
        <p className="max-w-2xl text-text-muted">{copy.localBody}</p>
        <nav aria-label={copy.localKicker} className="flex flex-wrap gap-2">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-pill border border-border-subtle bg-surface-raised px-3.5 py-1.5 text-sm font-medium hover:border-border",
                focusRing,
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      <Section id="getting-there" title={copy.transportTitle}>
        {sourceSection("transport")}
        <PartBody part={transport}>
          {(data) =>
            data.from_airport.length + data.from_beirut.length + data.between.length + data.around.length === 0 ? (
              sourced("transport").length ? null : (
                <p className="rounded-card bg-surface-sunken p-4 text-sm">
                  {interpolate(copy.transportEmpty, { name })}
                </p>
              )
            ) : (
              <div className="grid gap-8">
                <CardGroup title={copy.fromAirport} cards={data.from_airport} />
                <CardGroup title={copy.fromBeirut} cards={data.from_beirut} />
                <CardGroup title={copy.between} cards={data.between} />
                <CardGroup title={interpolate(copy.around, { name })} cards={data.around} />
              </div>
            )
          }
        </PartBody>
      </Section>

      <Section id="drivers" title={copy.sourceDriversTitle}>
        {sourceSection("drivers")}
        <PartBody part={drivers}>
          {(data) => (
            <div className="grid gap-4">
              {data.length === 0 ? (
                sourced("drivers").length ? null : (
                  <p className="rounded-card bg-surface-sunken p-4 text-sm">
                    {interpolate(copy.driversEmpty, { name })}
                  </p>
                )
              ) : (
                <div className="grid gap-4">
                  <p className="text-sm text-text-muted">{copy.driversBody}</p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {data.slice(0, 6).map((driver) => (
                      <DriverCardView key={driver.id} driver={driver} />
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                {data.length ? (
                  <Button asChild>
                    <LocaleLink href={`/rides/new?destination=${encodeURIComponent(slug)}`}>
                      <Car aria-hidden />
                      {copy.askPrice}
                    </LocaleLink>
                  </Button>
                ) : null}
                <Button asChild variant="outline">
                  <LocaleLink href={`/drivers?destination=${encodeURIComponent(slug)}`}>
                    {copy.seeAllDrivers}
                    <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
                  </LocaleLink>
                </Button>
              </div>
            </div>
          )}
        </PartBody>
      </Section>

      <Section id="money" title={copy.sourceMoneyTitle}>
        {sourceSection("money")}
        <PartBody part={changers}>
          {(data) => (data.length || !sourced("money").length ? <ChangerList branches={data} name={name} /> : null)}
        </PartBody>
      </Section>

      <Section id="eat" title={copy.eatTitle}>
        {sourceSection("eat")}
        <PartBody part={venues}>
          {(data) =>
            data.restaurants.length === 0 ? (
              sourced("eat").length ? null : (
                <p className="rounded-card bg-surface-sunken p-4 text-sm">{interpolate(copy.eatEmpty, { name })}</p>
              )
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {data.restaurants.map((venue) => (
                  <VenueCardView key={venue.id} venue={venue} />
                ))}
              </div>
            )
          }
        </PartBody>
      </Section>

      <Section id="stay" title={copy.stayTitle}>
        {sourceSection("stay")}
        <PartBody part={venues}>
          {(data) =>
            data.stays.length === 0 ? (
              sourced("stay").length ? null : (
                <p className="rounded-card bg-surface-sunken p-4 text-sm">{interpolate(copy.stayEmpty, { name })}</p>
              )
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {data.stays.map((venue) => (
                  <VenueCardView key={venue.id} venue={venue} />
                ))}
              </div>
            )
          }
        </PartBody>
      </Section>
    </div>
  );
}
