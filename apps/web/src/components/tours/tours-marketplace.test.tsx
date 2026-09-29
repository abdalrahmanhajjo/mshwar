/// <reference types="vitest-axe/extend-expect" />
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";
import { highlightList } from "@/components/guide/tour-content-editor";
import { DestinationTours } from "./destination-tours";
import { TourCardView, tourPrice } from "./tour-card";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { tourSchema } from "@/lib/seo/schema";
import type { PublicTourPage, TourCard } from "@/lib/tour-booking";
import { tourDuration, toursCopy } from "@/lib/tours-copy";

const CARD: TourCard = {
  slug: "byblos-old-souk-walk",
  title: "Byblos old souk walk",
  summary: "Two hours through the souk.",
  duration_minutes: 150,
  max_party: 8,
  languages: ["en", "ar"],
  price_minor: 2500,
  price_unit: "person",
  instant_booking: true,
  policy: "flexible",
  destination: { slug: "byblos", name: "Byblos" },
  lat: 34.12,
  lng: 35.65,
  photo: { url: "https://ik.imagekit.io/mshwar/souk.jpg", alt_text: "The souk at noon" },
  next_start: "2099-07-01T07:00:00Z",
  guide: { slug: "rami", display_name: "Rami Haddad", badge: true, founding_number: 3, tier: "licensed" },
  rating: { count: 0, average: null },
};

const en = toursCopy.en;

describe("the tours marketplace", () => {
  it("shows a card with the published price and no rating without reviews", async () => {
    const { container } = render(
      <LocaleProvider>
        <ul>
          <TourCardView tour={CARD} copy={en} locale="en" />
        </ul>
      </LocaleProvider>,
    );
    expect(screen.getByRole("link", { name: "Byblos old souk walk" }).getAttribute("href")).toBe(
      "/tours/byblos-old-souk-walk",
    );
    expect(screen.getByText("From $25 per person")).toBeTruthy();
    expect(screen.getByText("No reviews yet")).toBeTruthy();
    expect(screen.getByText("Instant confirmation")).toBeTruthy();
    expect(screen.getByText("2 h 30 min")).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("says free for a host's tour and a group price per group", () => {
    expect(tourPrice(en, "en", { price_minor: 0, price_unit: "person" })).toBe("Free");
    expect(tourPrice(en, "en", { price_minor: 12000, price_unit: "group" })).toBe("From $120 per group");
    expect(tourPrice(en, "en", { price_minor: null, price_unit: null })).toBeNull();
    expect(tourDuration(en, 45)).toBe("45 min");
    expect(tourDuration(en, 180)).toBe("3 h");
  });

  it("hides the destination section when no tour starts there", () => {
    const { container } = render(
      <LocaleProvider>
        <DestinationTours tours={[]} name="Tyre" slug="tyre" locale="en" />
      </LocaleProvider>,
    );
    expect(container.innerHTML).toBe("");
  });

  it("describes a tour to search engines without inventing a rating", () => {
    const tour = {
      ...CARD,
      description: "Two hours through the souk.",
      min_party: 1,
      min_age: null,
      intensity: null,
      meeting_point: "Castle gate",
      included: "",
      bring: "",
      cancellation_terms: "",
      booking: {
        instant_booking: true,
        request_ttl_hours: 24,
        policy: "flexible",
        free_cancel_hours: 24,
        child_price_minor: null,
        child_age_max: null,
        addons: [],
      },
      route: [
        {
          position: 1,
          experience_id: "e1",
          slug: "byblos-castle",
          title: "Byblos Castle",
          destination_slug: "byblos",
          lat: 34.12,
          lng: 35.64,
        },
      ],
      photos: [CARD.photo],
    } as unknown as PublicTourPage;
    const schema = tourSchema(tour, "en");
    expect(schema["@type"]).toBe("TouristTrip");
    expect(schema.aggregateRating).toBeUndefined();
    expect(schema.offers).toMatchObject({ price: "25.00", priceCurrency: "USD" });
    expect((schema.itinerary as { numberOfItems: number }).numberOfItems).toBe(1);
    const rated = tourSchema({ ...tour, rating: { count: 4, average: 4.8 } }, "en");
    expect(rated.aggregateRating).toMatchObject({ ratingValue: 4.8, reviewCount: 4 });
  });

  it("keeps highlights short, real and at most eight", () => {
    expect(highlightList(" The souk \n\nx\nCoffee at the port\n")).toEqual(["The souk", "Coffee at the port"]);
    expect(highlightList(Array.from({ length: 10 }, (_, i) => `Stop ${i}`).join("\n"))).toHaveLength(8);
  });
});
