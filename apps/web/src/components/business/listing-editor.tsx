"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <form className="grid gap-4" onSubmit={(event) => void onSave(event)}>
      <Card>
        <CardHeader>
          <CardTitle>{copy.newListing}</CardTitle>
          <CardDescription>{copy.listingsHint}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Label htmlFor="title">{copy.saveListing}</Label>
          <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required />
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </CardContent>
      </Card>
      <Tabs defaultValue="category">
        <TabsList>
          {STEPS.map(([step, label]) => (
            <TabsTrigger key={step} value={step}>
              {copy[label]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="category" className="grid gap-2">
          <Label htmlFor="category">{copy.editorCategory}</Label>
          <Input id="category" value={category} onChange={(event) => setCategory(event.target.value)} />
          <p className="text-sm">{copy.groupSuitability}</p>
          {["families", "couples", "groups", "solo"].map((item) => (
            <Button
              key={item}
              type="button"
              variant={suitability.includes(item) ? "default" : "outline"}
              onClick={() => toggle(suitability, item, setSuitability)}
            >
              {item}
            </Button>
          ))}
          <p className="text-sm">{copy.weatherSensitivity}</p>
          {["indoor", "outdoor", "weather-sensitive"].map((item) => (
            <Button
              key={item}
              type="button"
              variant={sensitivity === item ? "default" : "outline"}
              onClick={() => setSensitivity(item)}
            >
              {item}
            </Button>
          ))}
          {["all-weather", "rain-sensitive", "heat-sensitive"].map((item) => (
            <Button
              key={item}
              type="button"
              variant={weather.includes(item) ? "default" : "outline"}
              onClick={() => toggle(weather, item, setWeather)}
            >
              {item}
            </Button>
          ))}
        </TabsContent>
        <TabsContent value="images">
          <Label htmlFor="image">{copy.editorImages}</Label>
          <Input id="image" type="file" accept="image/*" onChange={(event) => void onImage(event)} />
        </TabsContent>
        <TabsContent value="location" className="grid gap-2">
          <p className="text-sm text-text-muted">{copy.mapHint}</p>
          <Label htmlFor="venue">{copy.editorLocation}</Label>
          <Input id="venue" value={venueName} onChange={(event) => setVenueName(event.target.value)} />
          <Input value={address} onChange={(event) => setAddress(event.target.value)} />
        </TabsContent>
        <TabsContent value="duration">
          <Label htmlFor="duration">{copy.editorDuration}</Label>
          <Input id="duration" type="number" value={duration} onChange={(event) => setDuration(event.target.value)} />
        </TabsContent>
        <TabsContent value="pricing">
          <Label htmlFor="price">{copy.editorPricing}</Label>
          <Input id="price" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </TabsContent>
        <TabsContent value="policies">
          <Label htmlFor="terms">{copy.editorPolicies}</Label>
          <Textarea id="terms" value={terms} onChange={(event) => setTerms(event.target.value)} />
          <Label htmlFor="booking-mode">{copy.bookingMode}</Label>
          <select
            id="booking-mode"
            className="rounded-md border border-border bg-surface p-2 text-sm"
            value={bookingMode}
            onChange={(event) => setBookingMode(event.target.value)}
          >
            <option value="request">{copy.modeRequest}</option>
            <option value="instant">{copy.modeInstant}</option>
            <option value="inquiry">{copy.modeInquiry}</option>
          </select>
          <p className="text-sm text-text-muted">{copy.instantRequiresCapacity}</p>
        </TabsContent>
      </Tabs>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input aria-label="lng" value={lng} onChange={(event) => setLng(event.target.value)} />
        <Input aria-label="lat" value={lat} onChange={(event) => setLat(event.target.value)} />
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setLng(String(LEBANON.beirut.lng));
          setLat(String(LEBANON.beirut.lat));
        }}
      >
        Beirut
      </Button>
      <p role="status" className={inLebanon ? "text-sm text-success" : "text-sm text-danger"}>
        {inLebanon ? copy.insideLebanon : copy.outsideLebanon}
      </p>
      <Card>
        <CardHeader>
          <CardTitle>{copy.publishReport}</CardTitle>
          <CardDescription>{ready ? copy.readyToPublish : copy.blockedPublish}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1 text-sm">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || !inLebanon}>
          {copy.saveListing}
        </Button>
        <Button type="button" variant="accent" disabled={!ready || pending} onClick={() => void onPublish()}>
          {copy.publish}
        </Button>
      </div>
    </form>
  );
}
