"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarPlus,
  Clock,
  ImagePlus,
  Loader2,
  MapPin,
  Plus,
  Route,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { ApprovedGuide } from "@/components/guide/guide-provider";
import { PlaceSearch } from "@/components/guide/place-search";
import {
  DestinationSelect,
  LanguagePicker,
  ListSearch,
  LocateButton,
  PinSummary,
  useDestinations,
} from "@/components/guide/pickers";
import { interpolate } from "@/i18n/catalogues";
import { formatCurrency } from "@/i18n/format";
import { ApiError } from "@/lib/api/client";
import { useGuideWorkCopy, type GuideWorkCopy } from "@/lib/guide-work-copy";
import { fetchMyTours, openTourDates, publishTour, saveTour, type GuideTour, type TourInput } from "@/lib/guide-work";
import type { MyGuideProfile } from "@/lib/guides";
import { matchesQuery, type PlaceHit } from "@/lib/place-search";
import { fileToBase64, uploadPortalFile } from "@/lib/portal";
import { useSearchCopy } from "@/lib/search-copy";

// Central Beirut: a starting pin the guide moves, never a claim about their tour.
const DEFAULT_LAT = 33.8938;
const DEFAULT_LNG = 35.5018;

type Draft = {
  id?: string;
  title: string;
  description: string;
  duration: string;
  maxParty: string;
  minAge: string;
  price: string;
  unit: "person" | "group";
  languages: string[];
  included: string;
  bring: string;
  cancellation: string;
  meetingName: string;
  meetingAddress: string;
  lat: string;
  lng: string;
  destination: string;
  route: RouteStop[];
};

/** A stop as the editor holds it: the handle it sends and the name it shows. */
export type RouteStop = { slug: string; title: string };

function emptyDraft(profile: MyGuideProfile): Draft {
  return {
    title: "",
    description: "",
    duration: "120",
    maxParty: "8",
    minAge: "",
    price: "0",
    unit: "person",
    languages: [...profile.languages],
    included: "",
    bring: "",
    cancellation: "",
    meetingName: "",
    meetingAddress: "",
    lat: String(DEFAULT_LAT),
    lng: String(DEFAULT_LNG),
    destination: "beirut",
    route: [],
  };
}

function draftFrom(tour: GuideTour): Draft {
  return {
    id: tour.id,
    title: tour.title,
    description: tour.description,
    duration: String(tour.duration_minutes),
    maxParty: String(tour.max_party),
    minAge: "",
    price: String((tour.price?.amount_minor ?? 0) / 100),
    unit: tour.price?.unit === "group" ? "group" : "person",
    languages: [...tour.languages],
    included: tour.included,
    bring: tour.bring,
    cancellation: tour.cancellation_terms,
    meetingName: tour.meeting_point || tour.venue?.name || "",
    meetingAddress: tour.venue?.address ?? "",
    lat: String(tour.venue?.lat ?? DEFAULT_LAT),
    lng: String(tour.venue?.lng ?? DEFAULT_LNG),
    destination: tour.route[0]?.destination_slug ?? "beirut",
    route: tour.route.map((stop) => ({ slug: stop.slug, title: stop.title })),
  };
}

export function toTourInput(draft: Draft, tier: MyGuideProfile["tier"]): TourInput {
  const price = tier === "host" ? 0 : Math.round(Number(draft.price || "0") * 100);
  return {
    id: draft.id,
    title: draft.title.trim(),
    description: draft.description.trim(),
    duration_minutes: Number(draft.duration),
    max_party: Number(draft.maxParty),
    min_age: draft.minAge ? Number(draft.minAge) : null,
    price_minor: Number.isFinite(price) ? price : 0,
    price_unit: draft.unit,
    languages: draft.languages,
    included: draft.included.trim(),
    bring: draft.bring.trim(),
    cancellation_terms: draft.cancellation.trim(),
    meeting: {
      name: draft.meetingName.trim(),
      address: draft.meetingAddress.trim(),
      lat: Number(draft.lat),
      lng: Number(draft.lng),
      destination_slug: draft.destination.trim() || "beirut",
    },
    route: draft.route.map((stop) => stop.slug),
  };
}

function statusLabel(tour: GuideTour, copy: GuideWorkCopy) {
  if (tour.status === "published") {
    return copy.tourPublished;
  }
  return tour.status === "paused" ? copy.tourPaused : copy.tourDraft;
}

function RouteEditor({
  route,
  onChange,
  copy,
}: {
  route: RouteStop[];
  onChange: (next: RouteStop[]) => void;
  copy: GuideWorkCopy;
}) {
  const move = (index: number, by: number) => {
    const next = [...route];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item as RouteStop);
    onChange(next);
  };
  const full = route.length >= 12;

  return (
    <fieldset className="grid min-w-0 grid-cols-1 gap-3 rounded-control border border-border-subtle p-4">
      <legend className="flex items-center gap-2 px-1 text-sm font-medium">
        <Route className="size-4 text-text-muted" aria-hidden />
        {copy.tourRoute}
      </legend>
      <p className="text-xs text-text-muted">{copy.tourRouteHint}</p>
      {route.length ? (
        <ol className="grid grid-cols-1 gap-2">
          {route.map((stop, index) => (
            <li
              key={stop.slug}
              className="flex items-center justify-between gap-2 rounded-control border border-border-subtle bg-surface px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-subtle text-xs font-semibold tabular-nums">
                  {index + 1}
                </span>
                <span className="min-w-0 break-words font-medium">{stop.title}</span>
              </span>
              <span className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`${copy.tourRouteUp}: ${stop.title}`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`${copy.tourRouteDown}: ${stop.title}`}
                  disabled={index === route.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`${copy.tourRouteRemove}: ${stop.title}`}
                  onClick={() => onChange(route.filter((_, at) => at !== index))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-text-muted">{copy.tourRouteEmpty}</p>
      )}
      {full ? null : (
        <PlaceSearch
          label={copy.tourRouteAdd}
          exclude={route.map((stop) => stop.slug)}
          onPick={(place) => onChange([...route, { slug: place.slug, title: place.title }])}
        />
      )}
    </fieldset>
  );
}

function MeetingPoint({
  draft,
  setDraft,
  copy,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  copy: GuideWorkCopy;
}) {
  const search = useSearchCopy();
  const destinations = useDestinations();
  const lat = Number(draft.lat);
  const lng = Number(draft.lng);
  const field =
    (key: "meetingName" | "meetingAddress" | "lat" | "lng") => (event: React.ChangeEvent<HTMLInputElement>) =>
      setDraft((prev) => ({ ...prev, [key]: event.target.value }));

  function choosePlace(place: PlaceHit) {
    setDraft((prev) => ({
      ...prev,
      meetingName: place.title,
      meetingAddress: prev.meetingAddress || place.placeLabel,
      lat: place.lat === null ? prev.lat : String(place.lat),
      lng: place.lng === null ? prev.lng : String(place.lng),
      destination: place.destinationSlug || prev.destination,
    }));
  }

  function pickDestination(slug: string) {
    setDraft((prev) => {
      const before = destinations.find((row) => row.slug === prev.destination);
      const after = destinations.find((row) => row.slug === slug);
      // Move the pin with the destination only while it still sits on a default
      // or on the old destination's centre; never over a pin the guide chose.
      const untouched =
        (Number(prev.lat) === DEFAULT_LAT && Number(prev.lng) === DEFAULT_LNG) ||
        (before?.lat != null && Number(prev.lat) === before.lat && Number(prev.lng) === before.lng);
      if (after?.lat != null && after.lng != null && untouched) {
        return { ...prev, destination: slug, lat: String(after.lat), lng: String(after.lng) };
      }
      return { ...prev, destination: slug };
    });
  }

  return (
    <fieldset className="grid min-w-0 grid-cols-1 gap-4 rounded-control border border-border-subtle p-4">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-medium">
        <MapPin className="size-4 text-text-muted" aria-hidden />
        {copy.tourMeetingName}
      </legend>
      <PlaceSearch label={search.placeUse} onPick={choosePlace} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="tour-meet">{copy.tourMeetingName}</Label>
          <Input id="tour-meet" required minLength={2} value={draft.meetingName} onChange={field("meetingName")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tour-address">{copy.tourMeetingAddress}</Label>
          <Input id="tour-address" value={draft.meetingAddress} onChange={field("meetingAddress")} />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="tour-destination">{copy.tourMeetingDestination}</Label>
          <DestinationSelect id="tour-destination" value={draft.destination} onChange={pickDestination} />
        </div>
      </div>
      <div className="grid gap-2">
        {Number.isFinite(lat) && Number.isFinite(lng) ? <PinSummary lat={lat} lng={lng} /> : null}
        <LocateButton
          onLocate={(nextLat, nextLng) => setDraft((prev) => ({ ...prev, lat: String(nextLat), lng: String(nextLng) }))}
        />
      </div>
      <details className="group rounded-control border border-border-subtle px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">{search.exactPin}</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="tour-lat">{copy.tourMeetingLat}</Label>
            <Input id="tour-lat" inputMode="decimal" value={draft.lat} onChange={field("lat")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tour-lng">{copy.tourMeetingLng}</Label>
            <Input id="tour-lng" inputMode="decimal" value={draft.lng} onChange={field("lng")} />
          </div>
        </div>
      </details>
    </fieldset>
  );
}

function TourForm({
  profile,
  initial,
  onSaved,
  onClose,
}: {
  profile: MyGuideProfile;
  initial: Draft;
  onSaved: (tour: GuideTour) => void;
  onClose: () => void;
}) {
  const copy = useGuideWorkCopy();
  const [draft, setDraft] = React.useState<Draft>(initial);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const host = profile.tier === "host";
  const set =
    <K extends keyof Draft>(key: K) =>
    (value: Draft[K]) =>
      setDraft((prev) => ({ ...prev, [key]: value }));
  const field = (key: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((prev) => ({ ...prev, [key]: event.target.value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const tour = await saveTour(toTourInput(draft, profile.tier));
      setDraft(draftFrom(tour));
      setSaved(true);
      onSaved(tour);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="grid min-w-0 grid-cols-1 gap-5 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6"
      aria-label={draft.id ? copy.tourEdit : copy.tourNew}
    >
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1.5 md:col-span-2">
          <Label htmlFor="tour-title">{copy.tourTitle}</Label>
          <Input id="tour-title" required minLength={3} value={draft.title} onChange={field("title")} />
        </div>
        <div className="grid gap-1.5 md:col-span-2">
          <Label htmlFor="tour-description">{copy.tourDescription}</Label>
          <Textarea
            id="tour-description"
            required
            minLength={8}
            rows={4}
            value={draft.description}
            onChange={field("description")}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tour-duration">{copy.tourDuration}</Label>
          <Input
            id="tour-duration"
            type="number"
            min={30}
            max={720}
            step={15}
            value={draft.duration}
            onChange={field("duration")}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tour-party">{copy.tourMaxParty}</Label>
          <Input id="tour-party" type="number" min={1} max={60} value={draft.maxParty} onChange={field("maxParty")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tour-age">{copy.tourMinAge}</Label>
          <Input id="tour-age" type="number" min={0} max={21} value={draft.minAge} onChange={field("minAge")} />
        </div>
        <div className="grid gap-1.5 md:col-span-2">
          <span id="tour-languages" className="text-sm font-medium">
            {copy.tourLanguages}
          </span>
          <LanguagePicker value={draft.languages} onChange={set("languages")} labelledBy="tour-languages" />
        </div>
      </div>

      <fieldset className="grid min-w-0 grid-cols-1 gap-3 rounded-control border border-border-subtle p-4">
        <legend className="px-1 text-sm font-medium">{copy.tourPrice}</legend>
        {host ? (
          <Notice tone="info">{copy.tourHostFree}</Notice>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="tour-price">{copy.tourPrice}</Label>
                <Input id="tour-price" type="number" min={0} step={1} value={draft.price} onChange={field("price")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tour-unit">{copy.tourPriceUnit}</Label>
                <NativeSelect
                  id="tour-unit"
                  value={draft.unit}
                  onChange={(event) => set("unit")(event.target.value === "group" ? "group" : "person")}
                >
                  <option value="person">{copy.tourPerPerson}</option>
                  <option value="group">{copy.tourPerGroup}</option>
                </NativeSelect>
              </div>
            </div>
            <p className="text-xs text-text-muted">{copy.tourPaidOnDay}</p>
          </>
        )}
      </fieldset>

      <MeetingPoint draft={draft} setDraft={setDraft} copy={copy} />

      <RouteEditor route={draft.route} onChange={set("route")} copy={copy} />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="tour-included">{copy.tourIncluded}</Label>
          <Textarea id="tour-included" rows={3} value={draft.included} onChange={field("included")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tour-bring">{copy.tourBring}</Label>
          <Textarea id="tour-bring" rows={3} value={draft.bring} onChange={field("bring")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tour-cancel">{copy.tourCancellation}</Label>
          <Textarea id="tour-cancel" rows={3} value={draft.cancellation} onChange={field("cancellation")} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {pending ? copy.saving : copy.tourSave}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {copy.tourCancelEdit}
        </Button>
        {saved ? (
          <span role="status" className="text-sm text-success">
            {copy.tourSaved}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function TourCard({
  tour,
  profile,
  onChanged,
  onEdit,
}: {
  tour: GuideTour;
  profile: MyGuideProfile;
  onChanged: (tour?: GuideTour) => void;
  onEdit: () => void;
}) {
  const copy = useGuideWorkCopy();
  const { locale } = useLocale();
  const [busy, setBusy] = React.useState<null | "publish" | "dates" | "photo">(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const amount = tour.price?.amount_minor ?? 0;
  const issues = tour.publish_report?.issues ?? [];

  async function act(kind: "publish" | "dates", task: () => Promise<string | null>) {
    setBusy(kind);
    setError(null);
    setMessage(null);
    try {
      setMessage(await task());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    } finally {
      setBusy(null);
    }
  }

  async function onPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !profile.organization_id) {
      return;
    }
    setBusy("photo");
    setError(null);
    try {
      await uploadPortalFile(profile.organization_id, {
        filename: file.name,
        content_type: file.type || "image/jpeg",
        content_base64: await fileToBase64(file),
        purpose: "listing",
        experience_id: tour.id,
        alt_text: tour.title,
      });
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    } finally {
      setBusy(null);
      event.target.value = "";
    }
  }

  return (
    <li className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="title-card">{tour.title}</h2>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden />
              {interpolate(copy.tourMinutes, { n: String(tour.duration_minutes) })}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" aria-hidden />
              {tour.max_party}
            </span>
            <span className="font-medium text-text">
              {amount > 0
                ? `${formatCurrency(locale, amount / 100, tour.price?.currency || "USD")} · ${
                    tour.price?.unit === "group" ? copy.tourPerGroup : copy.tourPerPerson
                  }`
                : copy.tourFree}
            </span>
            {tour.route.length ? (
              <span className="inline-flex items-center gap-1">
                <Route className="size-3.5" aria-hidden />
                {tour.route.map((stop) => stop.title).join(" → ")}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={tour.status === "published" ? "success" : "secondary"}>{statusLabel(tour, copy)}</Badge>
          <Badge variant="outline">{interpolate(copy.tourUpcoming, { n: String(tour.upcoming_slots) })}</Badge>
          <Badge variant="outline">{interpolate(copy.tourPhotoCount, { n: String(tour.images?.length ?? 0) })}</Badge>
        </div>
      </div>

      {tour.status !== "published" && issues.length ? (
        <Notice tone="warning">
          <span className="grid gap-1">
            <span className="font-medium">{copy.tourPublishBlocked}</span>
            <ul className="list-disc ps-5">
              {issues.map((issue) => (
                <li key={issue.code}>{issue.message}</li>
              ))}
            </ul>
          </span>
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-success">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          {copy.tourEdit}
        </Button>
        <Button asChild type="button" variant="outline" size="sm">
          <label className="cursor-pointer">
            {busy === "photo" ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
            {copy.tourPhotoUpload}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => void onPhoto(event)}
            />
          </label>
        </Button>
        {tour.status !== "published" ? (
          <Button
            type="button"
            size="sm"
            disabled={busy !== null}
            onClick={() =>
              void act("publish", async () => {
                onChanged(await publishTour(tour.id));
                return null;
              })
            }
          >
            {busy === "publish" ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            {copy.tourPublish}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy !== null}
          onClick={() =>
            void act("dates", async () => {
              const run = await openTourDates(tour.id);
              onChanged();
              const opened = interpolate(copy.tourDatesOpened, { n: String(run.created) });
              return run.skipped_for_daily_cap
                ? `${opened} ${interpolate(copy.tourDatesCapped, { n: String(run.skipped_for_daily_cap) })}`
                : opened;
            })
          }
        >
          {busy === "dates" ? <Loader2 className="animate-spin" aria-hidden /> : <CalendarPlus aria-hidden />}
          {copy.tourOpenDates}
        </Button>
      </div>
    </li>
  );
}

function Tours({ profile }: { profile: MyGuideProfile }) {
  const copy = useGuideWorkCopy();
  const [tours, setTours] = React.useState<GuideTour[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [editing, setEditing] = React.useState<Draft | null>(null);
  const [version, setVersion] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const search = useSearchCopy();
  const shown = (tours ?? []).filter((tour) =>
    matchesQuery(query, tour.title, tour.meeting_point, ...tour.route.map((stop) => stop.title)),
  );

  React.useEffect(() => {
    let cancelled = false;
    void fetchMyTours()
      .then((rows) => {
        if (!cancelled) {
          setTours(rows);
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

  const refresh = () => setVersion((value) => value + 1);

  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        eyebrow={copy.portalKicker}
        icon={<Route aria-hidden />}
        title={copy.toursTitle}
        description={copy.toursBody}
        actions={
          editing ? null : (
            <Button type="button" onClick={() => setEditing(emptyDraft(profile))}>
              <Plus aria-hidden />
              {copy.tourNew}
            </Button>
          )
        }
      />
      {editing ? (
        <TourForm
          key={editing.id ?? "new"}
          profile={profile}
          initial={editing}
          onSaved={refresh}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {failed ? (
        <Notice tone="danger" role="alert">
          {copy.loadError}
        </Notice>
      ) : tours === null ? (
        <div className="grid place-items-center py-16 text-text-muted">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </div>
      ) : tours.length === 0 && !editing ? (
        <EmptyState icon={<Route aria-hidden />} title={copy.toursEmpty} />
      ) : (
        <div className="grid gap-4">
          {tours.length > 3 ? (
            <ListSearch
              value={query}
              onChange={setQuery}
              placeholder={search.tourSearch}
              shown={shown.length}
              total={tours.length}
            />
          ) : null}
          {shown.length === 0 && tours.length ? <p className="text-sm text-text-muted">{search.noResults}</p> : null}
          <ul className="grid gap-4">
            {shown.map((tour) => (
              <TourCard
                key={tour.id}
                tour={tour}
                profile={profile}
                onChanged={refresh}
                onEdit={() => setEditing(draftFrom(tour))}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** /guide/tours: the tour builder, lifted from the listing editor. */
export function TourBuilder() {
  return <ApprovedGuide>{(profile) => <Tours profile={profile} />}</ApprovedGuide>;
}
