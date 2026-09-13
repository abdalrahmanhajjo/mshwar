import { describe, expect, it } from "vitest";
import { listingFromApi } from "./catalogue-api";

describe("catalogue API mapping", () => {
  it("maps a real listing id and price model without inventing slugs", () => {
    const listing = listingFromApi({
      id: "11111111-1111-1111-1111-111111111111",
      slug: "slow-day-byblos",
      title: "A slow day in Byblos",
      body: "Harbour lanes.",
      category: "culture",
      tags: ["Old town"],
      destination_slug: "byblos",
      place_label: "Byblos · Mount Lebanon",
      hours: 3,
      booking_mode: "request",
      kind: "experience",
      available: true,
      image: "https://example.com/byblos.jpg",
      image_alt: "Harbour",
      price: { currency: "USD", type: "estimated", source: "catalogue-seed", amount: 35 },
    });
    expect(listing.slug).toBe("slow-day-byblos");
    expect(listing.priceLabel).toBe("estimated");
    expect(listing.priceFrom).toBe(35);
    expect(listing.destinationSlug).toBe("byblos");
  });
});
