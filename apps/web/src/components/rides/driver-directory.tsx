"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Car, CheckCircle2, Loader2 } from "lucide-react";
import { DestinationSelect } from "@/components/guide/pickers";
import { DriverCardView } from "@/components/local/driver-card";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { useLocalCopy } from "@/lib/local-copy";
import { fetchDrivers, type DriverCard } from "@/lib/rides";

export function HowBookingWorks() {
  const copy = useLocalCopy();
  return (
    <section className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5">
      <h2 className="font-semibold">{copy.howItWorks}</h2>
      <ol className="grid gap-2 text-sm">
        {[copy.how1, copy.how2, copy.how3, copy.how4].map((step) => (
          <li key={step} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** /drivers: every live verified driver, optionally for one destination. */
export function DriverDirectory() {
  const copy = useLocalCopy();
  const router = useRouter();
  const pathname = usePathname() ?? "/drivers";
  const params = useSearchParams();
  const destination = params?.get("destination") ?? "";
  const [result, setResult] = React.useState<{ key: string; drivers: DriverCard[] | null }>({ key: "", drivers: null });
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void fetchDrivers(destination || undefined)
      .then((drivers) => {
        if (!cancelled) {
          setResult({ key: destination, drivers });
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [destination]);

  function choose(slug: string) {
    const next = new URLSearchParams(params?.toString() ?? "");
    if (slug) {
      next.set("destination", slug);
    } else {
      next.delete("destination");
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const drivers = result.key === destination ? result.drivers : null;
  const askHref = destination ? `/rides/new?destination=${encodeURIComponent(destination)}` : "/rides/new";

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={copy.driversTitle}
        icon={<Car aria-hidden />}
        title={copy.directoryTitle}
        description={copy.driversBody}
        actions={
          <Button asChild>
            <LocaleLink href={askHref}>{copy.askPrice}</LocaleLink>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="grid gap-5">
          <div className="grid gap-1.5 sm:max-w-xs">
            <Label htmlFor="drivers-destination">{copy.filterArea}</Label>
            <DestinationSelect
              id="drivers-destination"
              value={destination}
              onChange={choose}
              allowAny
              anyLabel={copy.anyArea}
            />
          </div>
          {failed ? (
            <Notice tone="danger" role="alert">
              {copy.loadError}
            </Notice>
          ) : drivers === null ? (
            <div className="grid place-items-center py-16 text-text-muted">
              <Loader2 className="size-6 animate-spin" aria-hidden />
            </div>
          ) : drivers.length === 0 ? (
            <EmptyState icon={<Car aria-hidden />} title={copy.directoryEmpty} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {drivers.map((driver) => (
                <DriverCardView key={driver.id} driver={driver} />
              ))}
            </div>
          )}
        </div>
        <HowBookingWorks />
      </div>
    </div>
  );
}
