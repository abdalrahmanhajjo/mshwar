"use client";

import * as React from "react";
import { BadgeCheck, Loader2, Save } from "lucide-react";
import { errorText } from "@/components/partners/step";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import { useVenuePortalCopy, type VenuePortalKey } from "@/lib/venue-portal-copy";
import {
  fetchListingDetails,
  saveListingDetails,
  type ListingDetailsInput,
  type ListingKind,
  type PortalListingDetails,
  type StayType,
} from "@/lib/venues";

const KINDS: ListingKind[] = ["experience", "attraction", "restaurant", "hotel"];
const STAY_TYPES: StayType[] = ["hotel", "guesthouse", "hostel", "apartment"];
const list = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const num = (value: string) => (value.trim() === "" ? null : Number(value));

type Form = Record<
  | "licence_number"
  | "licence_authority"
  | "licence_expires_on"
  | "cuisines"
  | "price_level"
  | "reservation_phone"
  | "reservation_whatsapp"
  | "reservation_url"
  | "stay_type"
  | "stars"
  | "rooms"
  | "check_in"
  | "check_out"
  | "price_from"
  | "booking_url"
  | "amenities"
  | "accessibility",
  string
>;

function toForm(data: PortalListingDetails): Form {
  const d = data.details;
  return {
    licence_number: data.licence_number ?? "",
    licence_authority: data.licence_authority ?? "",
    licence_expires_on: data.licence_expires_on ?? "",
    cuisines: (d.cuisines ?? []).join(", "),
    price_level: d.price_level ? String(d.price_level) : "",
    reservation_phone: d.reservation_phone ?? "",
    reservation_whatsapp: d.reservation_whatsapp ?? "",
    reservation_url: d.reservation_url ?? "",
    stay_type: d.stay_type ?? "guesthouse",
    stars: d.stars ? String(d.stars) : "",
    rooms: d.rooms ? String(d.rooms) : "",
    check_in: d.check_in?.slice(0, 5) ?? "",
    check_out: d.check_out?.slice(0, 5) ?? "",
    price_from: d.price_from_minor ? String(d.price_from_minor / 100) : "",
    booking_url: d.booking_url ?? "",
    amenities: (d.amenities ?? []).join(", "),
    accessibility: (d.accessibility ?? []).join(", "),
  };
}

/** Business portal: say what kind of place a listing is, and add the licence our team checks. */
export function ListingDetailsEditor({ orgId, experienceId }: { orgId: string; experienceId: string }) {
  const copy = useVenuePortalCopy();
  const { locale } = useLocale();
  const [data, setData] = React.useState<PortalListingDetails | null>(null);
  const [kind, setKind] = React.useState<ListingKind>("experience");
  const [form, setForm] = React.useState<Form | null>(null);
  const [acceptsRequests, setAcceptsRequests] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void fetchListingDetails(orgId, experienceId)
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setKind(next.listing_kind);
        setForm(toForm(next));
        setAcceptsRequests(Boolean(next.details.accepts_requests));
      })
      .catch(() => {
        if (!cancelled) setMessage({ tone: "danger", text: copy.loadError });
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, experienceId, copy.loadError]);

  if (!form || !data) {
    return message ? (
      <Notice tone="danger" role="alert">
        {message.text}
      </Notice>
    ) : null;
  }

  const set = (key: keyof Form, value: string) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));
  const day = (value: string) => formatDate(locale, `${value.slice(0, 10)}T12:00:00Z`, { dateStyle: "medium" });
  const field = (key: keyof Form, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`ld-${key}`}>{label}</Label>
      <Input id={`ld-${key}`} value={form[key]} onChange={(event) => set(key, event.target.value)} {...props} />
    </div>
  );

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    setMessage(null);
    const venue = kind === "restaurant" || kind === "hotel";
    const input: ListingDetailsInput = {
      listing_kind: kind,
      licence_number: venue ? form.licence_number.trim() : "",
      licence_authority: venue ? form.licence_authority.trim() : "",
      licence_expires_on: venue && form.licence_expires_on ? form.licence_expires_on : null,
      reservation_phone: form.reservation_phone.trim(),
      reservation_whatsapp: form.reservation_whatsapp.trim(),
      ...(kind === "restaurant"
        ? {
            cuisines: list(form.cuisines),
            price_level: num(form.price_level),
            reservation_url: form.reservation_url.trim(),
          }
        : {}),
      ...(kind === "hotel"
        ? {
            stay_type: form.stay_type as StayType,
            stars: num(form.stars),
            rooms: num(form.rooms),
            check_in: form.check_in || null,
            check_out: form.check_out || null,
            price_from_minor: form.price_from ? Math.round(Number(form.price_from) * 100) : null,
            booking_url: form.booking_url.trim(),
            accepts_requests: acceptsRequests,
            amenities: list(form.amenities),
          }
        : {}),
      accessibility: list(form.accessibility),
    };
    try {
      await saveListingDetails(orgId, experienceId, input);
      const next = await fetchListingDetails(orgId, experienceId);
      setData(next);
      setMessage({ tone: "success", text: copy.saved });
    } catch (caught) {
      setMessage({ tone: "danger", text: errorText(caught, copy.loadError) });
    } finally {
      setBusy(false);
    }
  }

  const v = data.verification;
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{copy.detailsTitle}</CardTitle>
        <CardDescription>{copy.detailsBody}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5" onSubmit={(event) => void save(event)}>
          <div className="grid gap-1.5 sm:max-w-xs">
            <Label htmlFor="ld-kind">{copy.kindLabel}</Label>
            <NativeSelect id="ld-kind" value={kind} onChange={(event) => setKind(event.target.value as ListingKind)}>
              {KINDS.map((value) => (
                <option key={value} value={value}>
                  {copy[`kind_${value}` as VenuePortalKey]}
                </option>
              ))}
            </NativeSelect>
          </div>
          {kind === "restaurant" || kind === "hotel" ? (
            <>
              {data.checked && v.checked_on && v.review_by ? (
                <Notice tone="success" icon={<BadgeCheck aria-hidden />}>
                  {interpolate(copy.checkedStatus, { date: day(v.checked_on), due: day(v.review_by) })}
                </Notice>
              ) : (
                <Notice tone="info">{copy.notChecked}</Notice>
              )}
              <div className="grid gap-4 sm:grid-cols-3">
                {field("licence_number", copy.licenceNumber, { maxLength: 60 })}
                {field("licence_authority", copy.licenceAuthority, { maxLength: 120 })}
                {field("licence_expires_on", copy.licenceExpires, { type: "date" })}
              </div>
              <p className="text-xs text-text-muted">{copy.licenceNote}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {field("reservation_phone", copy.reservationPhone, { type: "tel", dir: "ltr", maxLength: 20 })}
                {field("reservation_whatsapp", copy.reservationWhatsapp, { type: "tel", dir: "ltr", maxLength: 20 })}
              </div>
            </>
          ) : null}
          {kind === "restaurant" ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {field("cuisines", copy.cuisines)}
              <div className="grid gap-1.5">
                <Label htmlFor="ld-price_level">{copy.priceLevel}</Label>
                <NativeSelect
                  id="ld-price_level"
                  value={form.price_level}
                  onChange={(event) => set("price_level", event.target.value)}
                >
                  <option value="">{copy.priceAny}</option>
                  {[1, 2, 3, 4].map((level) => (
                    <option key={level} value={String(level)}>
                      {"$".repeat(level)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              {field("reservation_url", copy.reservationUrl, { type: "url", dir: "ltr" })}
            </div>
          ) : null}
          {kind === "hotel" ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ld-stay_type">{copy.stayType}</Label>
                <NativeSelect
                  id="ld-stay_type"
                  value={form.stay_type}
                  onChange={(event) => set("stay_type", event.target.value)}
                >
                  {STAY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {copy[`stay_${type}` as VenuePortalKey]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              {field("stars", copy.stars, { type: "number", min: 1, max: 5 })}
              {field("rooms", copy.rooms, { type: "number", min: 1, max: 2000 })}
              {field("check_in", copy.checkIn, { type: "time" })}
              {field("check_out", copy.checkOut, { type: "time" })}
              {field("price_from", copy.priceFrom, { inputMode: "decimal", dir: "ltr" })}
              {field("booking_url", copy.bookingUrl, { type: "url", dir: "ltr" })}
              {field("amenities", copy.amenities)}
              <label className="inline-flex items-center gap-2 self-end pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={acceptsRequests}
                  onChange={(event) => setAcceptsRequests(event.target.checked)}
                />
                {copy.acceptsRequests}
              </label>
            </div>
          ) : null}
          {field("accessibility", copy.accessibility)}
          {message ? (
            <Notice tone={message.tone} role={message.tone === "danger" ? "alert" : "status"}>
              {message.text}
            </Notice>
          ) : null}
          <Button type="submit" className="w-fit" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save aria-hidden />}
            {copy.save}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
