"use client";

import { DESTINATIONS } from "@/lib/catalog";
import { useBrowseCopy } from "@/lib/browse-copy";
import type { ExperienceFilters } from "@/lib/catalog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function FilterRail({
  filters,
  onChange,
}: {
  filters: ExperienceFilters;
  onChange: (next: Partial<ExperienceFilters>) => void;
}) {
  const copy = useBrowseCopy();

  return (
    <aside className="rounded-card border border-border bg-surface-raised p-5">
      <h2 className="text-sm font-semibold">{copy.filters}</h2>
      <div className="mt-4 grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="filter-date">{copy.filterDate}</Label>
          <Input
            id="filter-date"
            type="date"
            value={filters.date ?? ""}
            onChange={(event) => onChange({ date: event.target.value || undefined, page: 1 })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="filter-price">{copy.filterPrice}</Label>
          <select
            id="filter-price"
            className="h-10 rounded-control border border-border bg-surface px-3 text-sm"
            value={filters.priceMax ?? ""}
            onChange={(event) =>
              onChange({ priceMax: event.target.value ? Number(event.target.value) : undefined, page: 1 })
            }
          >
            <option value="">{copy.priceAny}</option>
            <option value="25">$25</option>
            <option value="35">$35</option>
            <option value="45">$45</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="filter-distance">{copy.filterDistance}</Label>
          <select
            id="filter-distance"
            className="h-10 rounded-control border border-border bg-surface px-3 text-sm"
            value={filters.distance ?? ""}
            onChange={(event) =>
              onChange({ distance: event.target.value ? Number(event.target.value) : undefined, page: 1 })
            }
          >
            <option value="">{copy.distanceAny}</option>
            <option value="20">20 km</option>
            <option value="40">40 km</option>
            <option value="80">80 km</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="filter-destination">{copy.destinations}</Label>
          <select
            id="filter-destination"
            className="h-10 rounded-control border border-border bg-surface px-3 text-sm"
            value={filters.destination ?? ""}
            onChange={(event) => onChange({ destination: event.target.value || undefined, page: 1 })}
          >
            <option value="">{copy.anywhere}</option>
            {DESTINATIONS.map((destination) => (
              <option key={destination.slug} value={destination.slug}>
                {destination.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="filter-party">{copy.filterGroup}</Label>
          <Input
            id="filter-party"
            type="number"
            min={1}
            max={20}
            value={filters.party ?? ""}
            onChange={(event) =>
              onChange({ party: event.target.value ? Number(event.target.value) : undefined, page: 1 })
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="filter-rating">{copy.filterRating}</Label>
          <select
            id="filter-rating"
            className="h-10 rounded-control border border-border bg-surface px-3 text-sm"
            value={filters.rating ?? ""}
            onChange={(event) =>
              onChange({ rating: event.target.value ? Number(event.target.value) : undefined, page: 1 })
            }
          >
            <option value="">{copy.anyRating}</option>
            <option value="4">4+</option>
            <option value="4.5">4.5+</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(filters.available)}
            onChange={(event) => onChange({ available: event.target.checked || undefined, page: 1 })}
          />
          {copy.availableOnly}
        </label>
      </div>
    </aside>
  );
}
