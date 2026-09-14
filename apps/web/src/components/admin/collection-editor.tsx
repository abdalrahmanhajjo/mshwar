"use client";
import { securityFetch } from "@/lib/security";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CollectionEditor() {
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stops, setStops] = useState("slow-day-byblos");
  const [message, setMessage] = useState("");

  async function save() {
    const response = await securityFetch("/api/v1/catalogue/collections", {
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
    setMessage(response.ok ? "Saved." : "Could not save. Sign in and use existing experience slugs.");
  }

  return (
    <form
      className="grid max-w-xl gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label className="grid gap-1 text-sm">
        Slug
        <input
          className="rounded-control border border-border bg-surface-raised px-3 py-2"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          required
        />
      </label>
      <label className="grid gap-1 text-sm">
        Title
        <input
          className="rounded-control border border-border bg-surface-raised px-3 py-2"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </label>
      <label className="grid gap-1 text-sm">
        Description
        <textarea
          className="rounded-control border border-border bg-surface-raised px-3 py-2"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Experience slugs
        <input
          className="rounded-control border border-border bg-surface-raised px-3 py-2"
          value={stops}
          onChange={(event) => setStops(event.target.value)}
        />
      </label>
      <Button type="submit" className="w-fit">
        Publish collection
      </Button>
      {message ? <p className="text-sm text-text-muted">{message}</p> : null}
    </form>
  );
}
