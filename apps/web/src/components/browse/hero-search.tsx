"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBrowseCopy } from "@/lib/browse-copy";

export function HeroSearch({ initialQuery = "", compact = false }: { initialQuery?: string; compact?: boolean }) {
  const copy = useBrowseCopy();
  const router = useRouter();
  const [where, setWhere] = React.useState(initialQuery);
  const [when, setWhen] = React.useState("");
  const [party, setParty] = React.useState("2");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (where.trim()) {
      params.set("q", where.trim());
    }
    if (when) {
      params.set("date", when);
    }
    if (party) {
      params.set("party", party);
    }
    const query = params.toString();
    router.push(query ? `/experiences?${query}` : "/experiences");
  }

  return (
    <form
      onSubmit={onSubmit}
      className={
        compact
          ? "grid gap-2 rounded-pill border border-border bg-surface-raised p-2 shadow-sm md:grid-cols-[1fr_auto_auto]"
          : "grid gap-3 rounded-card bg-surface-raised p-3 shadow-md md:grid-cols-[1.4fr_1fr_7rem_auto] md:items-end"
      }
    >
      <div className="grid gap-1 px-2">
        {compact ? null : (
          <Label htmlFor="browse-where" className="text-xs text-text-muted">
            {copy.where}
          </Label>
        )}
        <Input
          id="browse-where"
          name="q"
          value={where}
          onChange={(event) => setWhere(event.target.value)}
          placeholder={compact ? copy.searchExperiences : copy.wherePlaceholder}
          className="border-0 bg-transparent shadow-none"
        />
      </div>
      <div className="grid gap-1 px-2">
        {compact ? null : (
          <Label htmlFor="browse-when" className="text-xs text-text-muted">
            {copy.when}
          </Label>
        )}
        <Input
          id="browse-when"
          name="date"
          type={compact ? "text" : "date"}
          value={when}
          onChange={(event) => setWhen(event.target.value)}
          placeholder={copy.whenPlaceholder}
          className="border-0 bg-transparent shadow-none"
        />
      </div>
      {compact ? null : (
        <div className="grid gap-1 px-2">
          <Label htmlFor="browse-party" className="text-xs text-text-muted">
            {copy.company}
          </Label>
          <Input
            id="browse-party"
            name="party"
            type="number"
            min={1}
            max={20}
            value={party}
            onChange={(event) => setParty(event.target.value)}
            className="border-0 bg-transparent shadow-none"
          />
        </div>
      )}
      <Button type="submit" className={compact ? "rounded-pill px-6" : "rounded-pill px-6"}>
        {compact ? copy.filters : copy.findPlace}
      </Button>
    </form>
  );
}
