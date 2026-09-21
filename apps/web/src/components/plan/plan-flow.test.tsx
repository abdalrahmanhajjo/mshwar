import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanFlow } from "./plan-flow";
import { LocaleProvider } from "@/components/shell/locale-provider";
import type { Destination } from "@/lib/catalog";

const destinations: Destination[] = [
  {
    slug: "byblos",
    name: "Byblos",
    region: "Mount Lebanon",
    country: "Lebanon",
    blurb: "Old harbour",
    tags: [],
    image: "",
    imageAlt: "",
  },
];

function apiItem(slug: string, title: string) {
  return {
    slug,
    title,
    category: "culture",
    destination_slug: "byblos",
    place_label: "Byblos",
    hours: 2,
    body: "A nice place",
    summary: "A nice place",
    tags: [],
    booking_mode: "request",
    price: { type: "from", amount: 20, amount_minor: 2000, currency: "USD", unit: "person" },
  };
}

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

describe("plan flow (manual mode)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("switches to manual, picks a destination, loads places and reaches Save", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ items: [apiItem("harbour-walk", "Harbour walk")] }),
      })),
    );
    render(wrap(<PlanFlow destinations={destinations} />));

    fireEvent.click(screen.getByRole("tab", { name: /Build it myself/ }));
    expect(screen.getByText("Where do you want to go?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Byblos/ }));
    // The chosen town is echoed back as a chip that can be tapped off again.
    expect(screen.getByRole("button", { name: "Remove: Byblos" })).toBeInTheDocument();

    // Day settings come first: opening hours and traffic both depend on them.
    fireEvent.click(screen.getByRole("button", { name: "Next: your day" }));
    expect(await screen.findByText("Trip details")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next: pick places" }));
    expect(await screen.findByText("Harbour walk")).toBeInTheDocument();
    // Nothing picked yet, so the day says what to do rather than sitting empty.
    expect(screen.getByText(/Nothing picked yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save itinerary/ })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("button", { name: /Save itinerary/ })).toBeEnabled();
  });
});
