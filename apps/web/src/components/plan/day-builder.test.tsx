import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DayBuilder } from "./day-builder";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { plannerCopy } from "@/lib/planner-copy";
import type { Destination, Experience } from "@/lib/catalog";

const copy = plannerCopy.en;

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

function town(slug: string, name: string): Destination {
  return { slug, name, region: "Lebanon", country: "Lebanon", blurb: "", tags: [], image: "", imageAlt: "" };
}

function place(slug: string, title: string, destinationSlug: string): Experience {
  return {
    slug,
    title,
    summary: "A nice place",
    body: "",
    category: "culture",
    destinationSlug,
    placeLabel: destinationSlug,
    hours: 2,
    tags: [],
    image: "",
    imageAlt: "",
    priceFrom: 20,
    priceLabel: "from",
    bookingMode: "request",
  } as unknown as Experience;
}

const HARBOUR = place("harbour-walk", "Harbour walk", "byblos");
const SEA_WALL = place("sea-wall", "Sea wall", "batroun");
const PLACES = [HARBOUR, SEA_WALL];

function renderBuilder(props: Partial<Parameters<typeof DayBuilder>[0]> = {}) {
  const noop = () => {};
  return render(
    wrap(
      <DayBuilder
        places={PLACES}
        loading={false}
        picks={[]}
        towns={[town("byblos", "Byblos"), town("batroun", "Batroun")]}
        preview={null}
        checking={false}
        copy={copy}
        locale="en"
        onToggle={noop}
        onMove={noop}
        onReorder={noop}
        onSplit={noop}
        onClear={noop}
        onBack={noop}
        action={<button type="button">Save itinerary</button>}
        {...props}
      />,
    ),
  );
}

describe("day builder", () => {
  it("shows places from every chosen town together", () => {
    renderBuilder();
    expect(screen.getByText("Harbour walk")).toBeInTheDocument();
    expect(screen.getByText("Sea wall")).toBeInTheDocument();
  });

  it("narrows the catalogue to one town without losing the others", () => {
    renderBuilder();
    fireEvent.click(screen.getByRole("button", { name: "Byblos" }));
    expect(screen.getByText("Harbour walk")).toBeInTheDocument();
    expect(screen.queryByText("Sea wall")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "All chosen towns" }));
    expect(screen.getByText("Sea wall")).toBeInTheDocument();
  });

  it("leaves the town filter out when there is only one town", () => {
    renderBuilder({ towns: [town("byblos", "Byblos")] });
    expect(screen.queryByRole("group", { name: "Filter by town" })).not.toBeInTheDocument();
  });

  it("keeps the day rail collapsed on a phone until the toggle opens it", () => {
    renderBuilder({ picks: [HARBOUR] });
    const toggle = screen.getByRole("button", { name: /Show your day/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // The count rides on the toggle, so a collapsed day still says how big it is.
    expect(toggle).toHaveTextContent("1 stops");
    // Collapsed on a phone, always open from `lg` up.
    expect(document.getElementById("day-rail")).toHaveClass("hidden", "lg:block");

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: /Hide your day/ })).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("day-rail")).toHaveClass("block");
  });

  it("says nothing is published rather than showing an empty grid", () => {
    renderBuilder({ places: [] });
    expect(screen.getByText("No places are published for this destination yet.")).toBeInTheDocument();
  });

  it("renders the action the flow gave it and its own back button", () => {
    const onBack = vi.fn();
    renderBuilder({ onBack });
    expect(screen.getByRole("button", { name: "Save itinerary" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(onBack).toHaveBeenCalled();
  });
});
