"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle2, ImagePlus, LocateFixed, MapPin, Rocket, Save, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { cn, focusRing } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/components/shell/locale-provider";
import { useBusinessCopy } from "@/lib/business-copy";
import {
  fileToBase64,
  getExperience,
  LEBANON,
  pointInLebanon,
  publishExperience,
  saveExperience,
  uploadPortalFile,
  upsertVenue,
} from "@/lib/portal";
import { usePortal } from "@/components/business/portal-provider";

const STEPS = [
  ["category", "editorCategory"],
  ["images", "editorImages"],
  ["location", "editorLocation"],
  ["duration", "editorDuration"],
  ["pricing", "editorPricing"],
  ["policies", "editorPolicies"],
] as const;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-pill border px-4 text-sm font-medium transition-colors",
        active
          ? "border-brand bg-brand text-brand-foreground"
          : "border-border-subtle bg-surface-raised text-text-muted hover:border-brand/40 hover:text-text",
        focusRing,
      )}
    >
      {children}
    </button>
  );
}

export function ListingEditor({ experienceId }: { experienceId?: string }) {
  const copy = useBusinessCopy();
  const { locale } = useLocale();
  const router = useRouter();
  const { org } = usePortal();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("food");
  const [lng, setLng] = React.useState(String(LEBANON.beirut.lng));
  const [lat, setLat] = React.useState(String(LEBANON.beirut.lat));
  const [duration, setDuration] = React.useState("90");
  const [amount, setAmount] = React.useState("4500");
  const [terms, setTerms] = React.useState("Cancel 24 hours before.");
  const [bookingMode, setBookingMode] = React.useState("request");
  const [suitability, setSuitability] = React.useState<string[]>(["groups"]);
  const [weather, setWeather] = React.useState<string[]>(["all-weather"]);
  const [sensitivity, setSensitivity] = React.useState("outdoor");
  const [venueName, setVenueName] = React.useState("Venue");
  const [address, setAddress] = React.useState("Beirut");
  const [savedId, setSavedId] = React.useState(experienceId);
  const [issues, setIssues] = React.useState<string[]>([]);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const inLebanon = pointInLebanon(Number(lng), Number(lat));

  React.useEffect(() => {
    if (!org || !experienceId) {
      return;
    }
    void getExperience(org.id, experienceId).then((row) => {
      setTitle(row.title);
      setDescription(row.description);
      setCategory(row.category ?? "food");
      setDuration(String(row.duration_minutes));
      setSavedId(row.id);
      if (row.venue) {
        setLng(String(row.venue.lng));
        setLat(String(row.venue.lat));
        setVenueName(row.venue.name);
        setAddress(row.venue.address);
      }
      setIssues((row.publish_report.issues ?? []).map((item) => item.message));
      setReady(row.publish_report.ready);
      if (row.weather_sensitivity) {
        setSensitivity(row.weather_sensitivity);
      }
      setBookingMode(row.booking_mode || "request");
    });
  }, [experienceId, org]);

  async function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!org) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const venue = await upsertVenue(org.id, {
        name: venueName,
        address,
        lng: Number(lng),
        lat: Number(lat),
      });
      const listing = await saveExperience(org.id, {
        id: savedId,
        venue_id: venue.id,
        title,
        description,
        duration_minutes: Number(duration),
        category,
        suitability,
        weather,
        weather_sensitivity: sensitivity,
        weather_rules: { sensitive: sensitivity === "weather-sensitive" || weather.includes("rain-sensitive") },
        price: { currency: "USD", price_type: "fixed", unit: "person", amount_minor: Number(amount) },
        policy: { cancellation_rules: { hours: 24 }, terms_text: terms },
        booking_mode: bookingMode,
      });
      setSavedId(listing.id);
      setIssues((listing.publish_report.issues ?? []).map((item) => item.message));
      setReady(listing.publish_report.ready);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.saveListing);
    } finally {
      setPending(false);
    }
  }

  async function onPublish() {
    if (!org || !savedId) {
      return;
    }
    setPending(true);
    try {
      const listing = await publishExperience(org.id, savedId);
      setReady(listing.publish_report.ready);
      router.push(`/${locale === "en" ? "" : `${locale}/`}business/listings`.replace(/\/{2,}/g, "/"));
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.blockedPublish);
    } finally {
      setPending(false);
    }
  }

  async function onImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !org || !savedId) {
      return;
    }
    const content = await fileToBase64(file);
    await uploadPortalFile(org.id, {
      filename: file.name,
      content_type: file.type || "image/jpeg",
      content_base64: content,
      purpose: "listing",
      experience_id: savedId,
      alt_text: title || file.name,
    });
  }

  function toggle(list: string[], value: string, setter: (next: string[]) => void) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  return (
    <form className="grid gap-8" onSubmit={(event) => void onSave(event)}>
      <PageHeader
        eyebrow={copy.portalKicker}
        title={experienceId ? copy.editorTitle : copy.newListing}
        description={copy.listingsHint}
        actions={
          <Badge variant={ready ? "success" : "warning"} className="px-3 py-1 text-sm">
            {ready ? copy.readyToPublish : copy.blockedPublish}
          </Badge>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="grid gap-6">
          <Card>
            <CardContent className="grid gap-5 pt-6 md:pt-7">
              <div className="grid gap-2">
                <Label htmlFor="title">{copy.titleLabel}</Label>
                <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="listing-description">{copy.descriptionLabel}</Label>
                <Textarea
                  id="listing-description"
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 md:pt-5">
              <Tabs defaultValue="category">
                <TabsList>
                  {STEPS.map(([step, label], index) => (
                    <TabsTrigger key={step} value={step}>
                      <span className="grid size-5 place-items-center rounded-full bg-surface-sunken text-[0.6875rem] tabular-nums">
                        {index + 1}
                      </span>
                      {copy[label]}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value="category" className="grid gap-6">
                  <div className="grid max-w-sm gap-2">
                    <Label htmlFor="category">{copy.editorCategory}</Label>
                    <Input id="category" value={category} onChange={(event) => setCategory(event.target.value)} />
                  </div>
                  <fieldset className="grid gap-3">
                    <legend className="mb-3 text-sm font-semibold">{copy.groupSuitability}</legend>
                    <div className="flex flex-wrap gap-2">
                      {["families", "couples", "groups", "solo"].map((item) => (
                        <Chip
                          key={item}
                          active={suitability.includes(item)}
                          onClick={() => toggle(suitability, item, setSuitability)}
                        >
                          {item}
                        </Chip>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="grid gap-3">
                    <legend className="mb-3 text-sm font-semibold">{copy.weatherSensitivity}</legend>
                    <div className="flex flex-wrap gap-2">
                      {["indoor", "outdoor", "weather-sensitive"].map((item) => (
                        <Chip key={item} active={sensitivity === item} onClick={() => setSensitivity(item)}>
                          {item}
                        </Chip>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["all-weather", "rain-sensitive", "heat-sensitive"].map((item) => (
                        <Chip
                          key={item}
                          active={weather.includes(item)}
                          onClick={() => toggle(weather, item, setWeather)}
                        >
                          {item}
                        </Chip>
                      ))}
                    </div>
                  </fieldset>
                </TabsContent>
                <TabsContent value="images" className="grid gap-3">
                  <Label htmlFor="image">{copy.editorImages}</Label>
                  <label
                    htmlFor="image"
                    className="grid cursor-pointer place-items-center gap-2 rounded-card border border-dashed border-border-subtle bg-surface-sunken/60 px-6 py-10 text-center text-sm text-text-muted hover:border-brand/40"
                  >
                    <ImagePlus className="size-7 text-text" strokeWidth={1.5} aria-hidden />
                    {copy.uploadDoc}
                  </label>
                  <Input id="image" type="file" accept="image/*" onChange={(event) => void onImage(event)} />
                </TabsContent>
                <TabsContent value="location" className="grid gap-4">
                  <Notice icon={<MapPin aria-hidden />}>{copy.mapHint}</Notice>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="venue">{copy.venueLabel}</Label>
                      <Input id="venue" value={venueName} onChange={(event) => setVenueName(event.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="venue-address">{copy.addressLabel}</Label>
                      <Input id="venue-address" value={address} onChange={(event) => setAddress(event.target.value)} />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="duration" className="grid max-w-xs gap-2">
                  <Label htmlFor="duration">{copy.editorDuration}</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={duration}
                    onChange={(event) => setDuration(event.target.value)}
                  />
                  <p className="text-xs text-text-muted">{copy.durationHint}</p>
                </TabsContent>
                <TabsContent value="pricing" className="grid max-w-xs gap-2">
                  <Label htmlFor="price">{copy.editorPricing}</Label>
                  <Input id="price" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
                  <p className="text-xs text-text-muted">{copy.priceHint}</p>
                </TabsContent>
                <TabsContent value="policies" className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="terms">{copy.editorPolicies}</Label>
                    <Textarea id="terms" value={terms} onChange={(event) => setTerms(event.target.value)} />
                  </div>
                  <div className="grid max-w-sm gap-2">
                    <Label htmlFor="booking-mode">{copy.bookingMode}</Label>
                    <NativeSelect
                      id="booking-mode"
                      value={bookingMode}
                      onChange={(event) => setBookingMode(event.target.value)}
                    >
                      <option value="request">{copy.modeRequest}</option>
                      <option value="instant">{copy.modeInstant}</option>
                      <option value="inquiry">{copy.modeInquiry}</option>
                    </NativeSelect>
                  </div>
                  <p className="text-sm text-text-muted">{copy.instantRequiresCapacity}</p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{copy.coordinatesLabel}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  aria-label="lng"
                  value={lng}
                  onChange={(event) => setLng(event.target.value)}
                  className="tabular-nums"
                />
                <Input
                  aria-label="lat"
                  value={lat}
                  onChange={(event) => setLat(event.target.value)}
                  className="tabular-nums"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => {
                  setLng(String(LEBANON.beirut.lng));
                  setLat(String(LEBANON.beirut.lat));
                }}
              >
                <LocateFixed aria-hidden />
                Beirut
              </Button>
              <p
                role="status"
                className={cn(
                  "flex items-center gap-2 rounded-control px-3.5 py-2.5 text-sm",
                  inLebanon ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger",
                )}
              >
                {inLebanon ? (
                  <CheckCircle2 className="size-4" aria-hidden />
                ) : (
                  <XCircle className="size-4" aria-hidden />
                )}
                {inLebanon ? copy.insideLebanon : copy.outsideLebanon}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle as="h2">{copy.publishReport}</CardTitle>
              <CardDescription>{ready ? copy.readyToPublish : copy.blockedPublish}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {issues.length ? (
                <ul className="grid gap-2 text-sm">
                  {issues.map((issue) => (
                    <li key={issue} className="flex items-start gap-2 rounded-control bg-warning-subtle/70 px-3 py-2">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                      {issue}
                    </li>
                  ))}
                </ul>
              ) : null}
              {error ? (
                <Notice tone="danger" role="alert">
                  {error}
                </Notice>
              ) : null}
              <div className="grid gap-2">
                <Button type="submit" disabled={pending || !inLebanon}>
                  <Save aria-hidden />
                  {copy.saveListing}
                </Button>
                <Button type="button" variant="accent" disabled={!ready || pending} onClick={() => void onPublish()}>
                  <Rocket aria-hidden />
                  {copy.publish}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
