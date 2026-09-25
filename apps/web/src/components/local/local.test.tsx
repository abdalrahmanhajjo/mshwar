import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DestinationServices } from "./destination-services";
import { distanceText, hoursToday } from "./changer-list";
import { fareText } from "./transport-card";
import { crossings } from "@/components/plan/leg-transport";
import { AuthProvider } from "@/components/shell/auth-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";
import type { Experience } from "@/lib/catalog";
import type { DestinationServiceSource, ServiceCategory } from "@/lib/destination-service-sources";
import type { Branch } from "@/lib/exchange";
import { localCopy } from "@/lib/local-copy";
import type { DriverCard } from "@/lib/rides";
import type { TransportCard } from "@/lib/transport";
import type { VenueCard } from "@/lib/venues";

function wrap(ui: ReactNode) {
  return (
    <LocaleProvider>
      <AuthProvider>{ui}</AuthProvider>
    </LocaleProvider>
  );
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body, headers: new Headers(), statusText: "" };
}

function route(handlers: [string, unknown, number?][]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const hit = handlers.find(([prefix]) => url.startsWith(prefix));
      if (!hit && /\/catalogue\/destinations\/[^/]+\/services$/.test(url)) return jsonResponse([]);
      return hit ? jsonResponse(hit[1], hit[2]) : jsonResponse({ detail: "not found" }, 404);
    }),
  );
  return calls;
}

const TRUST = {
  level: "verified" as const,
  checks: [
    { kind: "public_licence" as const, checked_on: "2026-09-01", valid_until: "2027-09-01", vehicle_plate: null },
  ],
  in_person: { kind: "video_call" as const, on: "2026-09-02" },
  approved_on: "2026-09-02",
};

export const CARD: TransportCard = {
  id: "t1",
  scope: "between",
  mode: "service_taxi",
  line_name: "Dora – Jbeil",
  from: { slug: "beirut", name: "Beirut" },
  to: { slug: "byblos", name: "Byblos" },
  pickup: { name: "Dora roundabout", lat: 33.89, lng: 35.55 },
  dropoff: { name: "Jbeil old souk", lat: 34.12, lng: 35.65 },
  fare: { basis: "person", low_minor: 200, high_minor: 300, currency: "USD" },
  duration: { min: 40, max: 60 },
  frequency_minutes: 15,
  first_departure: "06:00:00",
  last_departure: "20:00:00",
  runs_sunday: false,
  tips: { en: "Say Jbeil, not Byblos." },
  step_free: null,
  night_service: false,
  luggage_ok: true,
  safety_note: "",
  checked_on: "2026-09-10",
  review_by: "2026-12-09",
  live: true,
};

const DRIVER: DriverCard = {
  id: "d1",
  kind: "driver",
  slug: "georges",
  display_name: "Georges",
  headline: "Airport runs and the north",
  bio: "",
  languages: ["ar", "en"],
  regions: ["mount-lebanon"],
  live: true,
  trust: TRUST,
  photo_url: null,
  vehicles: [
    { id: "v1", plate: "P 123456", make: "Toyota", model: "Corolla", colour: "Grey", year: 2019, seats: 4, live: true },
  ],
  rating: { average: 4.8, count: 12, completed_rides: 30 },
  day_rate_minor: 8000,
  airport_pickups: true,
};

const BRANCH: Branch = {
  id: "o1",
  branch_name: "Main street",
  address: "Rue Principale, Jbeil",
  lat: 34.121,
  lng: 35.648,
  destination: { slug: "byblos", name: "Byblos" },
  hours: {
    mon: [["09:00", "18:00"]],
    tue: [["09:00", "18:00"]],
    wed: [["09:00", "18:00"]],
    thu: [["09:00", "18:00"]],
    fri: [["09:00", "18:00"]],
    sat: [["09:00", "13:00"]],
  },
  phone: "+961 9 000 000",
  checked_on: "2026-09-05",
  rates: [{ base: "USD", quote: "LBP", buy: 89000, sell: 89500, posted_at: new Date().toISOString() }],
  changer: {
    slug: "jbeil-exchange",
    display_name: "Jbeil Exchange",
    languages: ["ar"],
    bdl_number: "123",
    category: "B",
    legal_name: "Jbeil Exchange SAL",
    register_checked_on: "2026-09-01",
    trust: TRUST,
  },
};

const RESTAURANT: VenueCard = {
  id: "e1",
  slug: "fish-by-the-port",
  title: "Fish by the port",
  summary: "Grilled catch of the day.",
  image: null,
  place_label: "Port · Byblos",
  kind: "restaurant",
  details: { cuisines: ["Lebanese", "Seafood"], price_level: 2, reservation_phone: "+961 9 111 111" },
  verification: {
    level: "checked_by_mshwar",
    checked_on: "2026-08-20",
    review_by: "2027-08-20",
    licence: null,
    claimed: false,
  },
};

describe("destination services", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows checked transport, verified drivers, licensed changers and checked places", async () => {
    route([
      [
        "/api/v1/transport/destinations/byblos",
        {
          destination: { slug: "byblos", name: "Byblos" },
          from_airport: [],
          from_beirut: [CARD],
          between: [],
          around: [],
        },
      ],
      ["/api/v1/rides/drivers", [DRIVER]],
      ["/api/v1/exchange/destinations/byblos", [BRANCH]],
      [
        "/api/v1/venues/destinations/byblos",
        { restaurants: [RESTAURANT], stays: [], targets: { restaurants: 5, stays: 3 } },
      ],
    ]);
    render(wrap(<DestinationServices slug="byblos" name="Byblos" />));

    const transport = await screen.findByRole("region", { name: localCopy.en.transportTitle });
    expect((await within(transport).findAllByText("$2–$3 per person")).length).toBeGreaterThan(0);
    expect(within(transport).getByText("Get on at Dora roundabout")).toBeInTheDocument();
    expect(within(transport).getByText("No Sunday service")).toBeInTheDocument();
    expect(within(transport).getByText(/Checked/)).toBeInTheDocument();

    const drivers = screen.getByRole("region", { name: localCopy.en.sourceDriversTitle });
    expect(await within(drivers).findByText("Georges")).toBeInTheDocument();
    expect(within(drivers).getByRole("link", { name: localCopy.en.askPrice })).toHaveAttribute(
      "href",
      "/rides/new?destination=byblos",
    );

    const money = screen.getByRole("region", { name: localCopy.en.sourceMoneyTitle });
    expect(await within(money).findByText("Jbeil Exchange")).toBeInTheDocument();
    expect(within(money).getByText("89,500 LBP")).toBeInTheDocument();
    expect(within(money).getByText(/Posted by the changer/)).toBeInTheDocument();

    const eat = screen.getByRole("region", { name: localCopy.en.eatTitle });
    expect(await within(eat).findByText("Fish by the port")).toBeInTheDocument();
    expect(within(eat).getByText(localCopy.en.venue_checked_by_mshwar)).toBeInTheDocument();

    const stay = screen.getByRole("region", { name: localCopy.en.stayTitle });
    expect(within(stay).getByText(/haven't checked places to stay in Byblos/)).toBeInTheDocument();
  });

  it("says so plainly when nothing is checked yet, and asks guests to sign in before flagging", async () => {
    route([
      [
        "/api/v1/transport/destinations/tyre",
        {
          destination: { slug: "tyre", name: "Tyre" },
          from_airport: [],
          from_beirut: [],
          between: [],
          around: [{ ...CARD, id: "t2", scope: "around", from: null }],
        },
      ],
      ["/api/v1/rides/drivers", []],
      ["/api/v1/exchange/destinations/tyre", []],
      ["/api/v1/venues/destinations/tyre", { restaurants: [], stays: [], targets: { restaurants: 5, stays: 3 } }],
    ]);
    render(wrap(<DestinationServices slug="tyre" name="Tyre" />));
    expect(await screen.findByText(/No verified driver covers Tyre yet/)).toBeInTheDocument();
    expect(await screen.findByText(/No checked changer in Tyre yet/)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Something changed/ })).toHaveAttribute(
      "href",
      expect.stringContaining("/signin?next="),
    );
  });

  it("lets a signed-in traveller flag a card that changed", async () => {
    const calls = route([
      ["/api/v1/auth/me", { id: "u1", display_name: "Maya", email: "m@example.org" }],
      ["/api/v1/transport/routes/t1/flags", { flagged: true, back_to_review: false }],
      [
        "/api/v1/transport/destinations/byblos",
        {
          destination: { slug: "byblos", name: "Byblos" },
          from_airport: [],
          from_beirut: [CARD],
          between: [],
          around: [],
        },
      ],
      ["/api/v1/rides/drivers", []],
      ["/api/v1/exchange/destinations/byblos", []],
      ["/api/v1/venues/destinations/byblos", { restaurants: [], stays: [], targets: { restaurants: 5, stays: 3 } }],
    ]);
    render(wrap(<DestinationServices slug="byblos" name="Byblos" />));
    fireEvent.click(await screen.findByRole("button", { name: /Something changed/ }));
    fireEvent.change(screen.getByLabelText(localCopy.en.flagReason), { target: { value: "no_longer_runs" } });
    fireEvent.click(screen.getByRole("button", { name: localCopy.en.sendFlag }));
    expect(await screen.findByText(localCopy.en.flagThanks)).toBeInTheDocument();
    const flag = calls.find((call) => call.url === "/api/v1/transport/routes/t1/flags");
    expect(JSON.parse(String(flag?.init?.body))).toEqual({ reason: "no_longer_runs", details: "" });
  });

  it("keeps a failing service from blanking the rest of the page", async () => {
    route([
      ["/api/v1/transport/destinations/byblos", { detail: "boom" }, 500],
      ["/api/v1/rides/drivers", [DRIVER]],
      ["/api/v1/exchange/destinations/byblos", []],
      ["/api/v1/venues/destinations/byblos", { restaurants: [], stays: [], targets: { restaurants: 5, stays: 3 } }],
    ]);
    render(wrap(<DestinationServices slug="byblos" name="Byblos" />));
    expect(await screen.findByText(localCopy.en.loadError)).toBeInTheDocument();
    expect(await screen.findByText("Georges")).toBeInTheDocument();
  });
});

describe("source-checked referrals", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fills all five sections without inventing partner badges or booking links", async () => {
    const categories: ServiceCategory[] = ["transport", "drivers", "money", "eat", "stay"];
    const types = {
      transport: "car_rental",
      drivers: "driver_service",
      money: "bank",
      eat: "eat",
      stay: "stay",
    } as const;
    const entries: DestinationServiceSource[] = categories.flatMap((category) =>
      [1, 2].map((n) => ({
        id: `${category}-${n}`,
        destination_slug: "akkar",
        category,
        name: `${category} provider ${n}`,
        locality: "Akkar",
        service_type: types[category],
        coverage: "local" as const,
        source_url: `https://example.com/${category}/${n}`,
        source_name: "Test operator",
        source_kind: "operator" as const,
        checked_on: "2026-09-25",
        review_by: "2026-12-24",
      })),
    );
    route([
      ["/api/v1/catalogue/destinations/akkar/services", entries],
      ["/api/v1/transport/destinations/akkar", { from_airport: [], from_beirut: [], between: [], around: [] }],
      ["/api/v1/rides/drivers", []],
      ["/api/v1/exchange/destinations/akkar", []],
      ["/api/v1/venues/destinations/akkar", { restaurants: [], stays: [], targets: { restaurants: 5, stays: 3 } }],
    ]);
    render(wrap(<DestinationServices slug="akkar" name="Akkar" />));
    await screen.findByText("eat provider 1");
    const ids = { transport: "getting-there", drivers: "drivers", money: "money", eat: "eat", stay: "stay" };
    for (const category of categories) {
      const section = document.getElementById(ids[category]);
      if (!section) throw new Error(`Missing ${category} section`);
      expect(within(section).getAllByRole("article")).toHaveLength(2);
      const links = within(section).getAllByRole("link", { name: localCopy.en.sourceLink });
      expect(links).toHaveLength(2);
      expect(links[0]).toHaveAttribute("href", `https://example.com/${category}/1`);
      expect(within(section).getByText(localCopy.en.sourceScope)).toBeInTheDocument();
    }
    expect(screen.queryByText(localCopy.en.venue_checked_by_mshwar)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: localCopy.en.askPrice })).not.toBeInTheDocument();
    expect(screen.queryByText(/No verified driver covers Akkar/)).not.toBeInTheDocument();
    expect(screen.queryByText(/haven't checked places to stay in Akkar/)).not.toBeInTheDocument();
    expect(screen.getAllByText(localCopy.en.sourceType_bank)).toHaveLength(2);
  });
});

describe("local helpers", () => {
  it("formats fares from minor units, free fares and unknown fares", () => {
    const copy = localCopy.en;
    expect(fareText(CARD, copy, "en")).toBe("$2–$3 per person");
    expect(
      fareText({ fare: { basis: "vehicle", low_minor: 1500, high_minor: 1500, currency: "USD" } }, copy, "en"),
    ).toBe("$15 per car");
    expect(fareText({ fare: { basis: "free", low_minor: null, high_minor: null, currency: null } }, copy, "en")).toBe(
      "Free",
    );
    expect(
      fareText({ fare: { basis: "person", low_minor: null, high_minor: null, currency: null } }, copy, "en"),
    ).toBeNull();
  });

  it("reads today's opening hours on Beirut's clock", () => {
    // 2026-09-19 is a Saturday in Beirut.
    const saturday = new Date("2026-09-19T08:00:00Z");
    expect(hoursToday(BRANCH.hours, saturday)).toBe("09:00–13:00");
    expect(hoursToday(BRANCH.hours, new Date("2026-09-20T08:00:00Z"))).toBeNull();
  });

  it("rounds distances the way people say them", () => {
    expect(distanceText(432, localCopy.en, "en")).toBe("430 m away");
    expect(distanceText(2345, localCopy.en, "en")).toBe("2.3 km away");
  });

  it("finds the legs of a day that cross between destinations", () => {
    const stop = (slug: string, destinationSlug: string) => ({ slug, destinationSlug }) as Experience;
    const legs = crossings([stop("a", "beirut"), stop("b", "beirut"), stop("c", "byblos"), stop("d", "batroun")]);
    expect(legs.map((leg) => `${leg.from.slug}>${leg.to.slug}`)).toEqual(["b>c", "c>d"]);
  });
});

describe("the flag form", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("waits for the card list before it shows", async () => {
    route([
      [
        "/api/v1/transport/destinations/byblos",
        {
          destination: { slug: "byblos", name: "Byblos" },
          from_airport: [CARD],
          from_beirut: [],
          between: [],
          around: [],
        },
      ],
      ["/api/v1/rides/drivers", []],
      ["/api/v1/exchange/destinations/byblos", []],
      ["/api/v1/venues/destinations/byblos", { restaurants: [], stays: [], targets: { restaurants: 5, stays: 3 } }],
    ]);
    render(wrap(<DestinationServices slug="byblos" name="Byblos" />));
    await waitFor(() => expect(screen.getByText(localCopy.en.fromAirport)).toBeInTheDocument());
  });
});
