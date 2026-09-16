"use client";

import { useState } from "react";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { useAdminCopy } from "@/lib/admin-copy";
import { EXPERIENCES } from "@/lib/catalog";

export function CollectionEditor() {
  const copy = useAdminCopy();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stops, setStops] = useState("slow-day-byblos");
  const [message, setMessage] = useState<{ ok: boolean } | null>(null);

  async function save() {
    const response = await fetch("/api/v1/catalogue/collections", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        title,
        description,
        status: "published",
        experience_slugs: stops
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    });
    setMessage({ ok: response.ok });
  }

  const chosen = stops
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
      <Card>
        <CardContent className="pt-6 md:pt-7">
          <form
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="collection-slug">{copy.slugLabel}</Label>
                <Input id="collection-slug" value={slug} onChange={(event) => setSlug(event.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="collection-title">{copy.titleLabel}</Label>
                <Input
                  id="collection-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="collection-description">{copy.descriptionLabel}</Label>
              <Textarea
                id="collection-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="collection-stops">{copy.stopsLabel}</Label>
              <Input id="collection-stops" value={stops} onChange={(event) => setStops(event.target.value)} />
            </div>
            <Button type="submit" className="w-fit">
              <Layers aria-hidden />
              {copy.publishCollection}
            </Button>
            {message ? (
              <Notice tone={message.ok ? "success" : "danger"} role="status">
                {message.ok ? copy.savedMessage : copy.saveFailed}
              </Notice>
            ) : null}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="grid gap-3 pt-6 md:pt-7">
          <p className="eyebrow">{copy.stopsLabel}</p>
          <ul className="flex flex-wrap gap-2">
            {EXPERIENCES.map((item) => {
              const active = chosen.includes(item.slug);
              return (
                <li key={item.slug}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setStops(
                        (active ? chosen.filter((slugItem) => slugItem !== item.slug) : [...chosen, item.slug]).join(
                          ", ",
                        ),
                      )
                    }
                    className={
                      active
                        ? "rounded-pill border border-brand bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground"
                        : "rounded-pill border border-border-subtle bg-surface-raised px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text"
                    }
                  >
                    {item.slug}
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
