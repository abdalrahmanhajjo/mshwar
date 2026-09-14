"use client";

import { PlanDefaultsNote } from "@/components/profile/plan-defaults-note";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPlural, interpolate } from "@/i18n/catalogues";
import { useCheckoutCopy } from "@/lib/checkout-copy";

export function PlanView({
  collectionTitle,
  stopCount = 0,
  tripId,
  addSlug,
}: {
  collectionTitle?: string;
  stopCount?: number;
  tripId?: string;
  addSlug?: string;
}) {
  const { t, locale } = useLocale();
  const checkout = useCheckoutCopy();
  const description = collectionTitle
    ? `${interpolate(t("planFromCollection"), { title: collectionTitle })} ${formatPlural(locale, stopCount, {
        one: t("planStopsOne"),
        other: t("planStopsOther"),
      })}`
    : t("planBody");

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("plan")}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
      {tripId ? <p className="text-sm text-text-muted">{interpolate(t("tripLabel"), { id: tripId })}</p> : null}
      {addSlug ? (
        <Button asChild className="w-full max-w-xl">
          <LocaleLink href={`/checkout?listing=${addSlug}&source=itinerary`}>{checkout.bookThisStop}</LocaleLink>
        </Button>
      ) : null}
      <PlanDefaultsNote />
    </>
  );
}
