import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DriverDirectory } from "./driver-directory";
import { MyRides } from "./my-rides";
import { NewRideForm } from "./new-ride-form";
import { RideRequestView } from "./ride-request-view";
import { SharedRideView } from "./shared-ride-view";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { navigationMocks } from "@/test-mocks/next-navigation";
import { localCopy } from "@/lib/local-copy";
import type { DriverCard, Quote, Ride, RideRequestDetail } from "@/lib/rides";

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
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
const VEHICLE = {
  id: "v1",
  plate: "P 123456",
  make: "Toyota",
  model: "Corolla",
  colour: "Grey",
  year: 2019,
  seats: 4,
  live: true,
};
const DRIVER: DriverCard = {
  id: "d1",
  kind: "driver",
  slug: "georges",
  display_name: "Georges",
  headline: "",
  bio: "",
  languages: ["en"],
  regions: [],
  live: true,
  trust: TRUST,
  photo_url: null,
  vehicles: [VEHICLE],
  rating: { average: null, count: 0, completed_rides: 0 },
  day_rate_minor: null,
  airport_pickups: true,
};
const QUOTE: Quote = {
  id: "q1",
  price_minor: 3500,
  currency: "USD",
  note: "I'll wait at arrivals with a sign.",
  status: "offered",
  created_at: "2026-09-18T10:00:00Z",
  vehicle: VEHICLE,
  driver: DRIVER,
};
const REQUEST: RideRequestDetail = {
  id: "r1",
  kind: "airport",
  status: "open",
  destination: { slug: "beirut", name: "Beirut" },
  pickup: { name: "Beirut airport", lat: 33.82, lng: 35.49 },
  dropoff: { name: "Hotel in Gemmayzeh", lat: null, lng: null },
  starts_at: "2026-10-01T18:00:00Z",
  hours: null,
  party_size: 2,
  luggage: 2,
  flight_number: "ME202",
  notes: "",
  expires_at: "2026-09-30T18:00:00Z",
  trip_id: null,
  created_at: "2026-09-18T09:00:00Z",
  ride_id: null,
  quotes: [QUOTE],
  ride: null,
};
const RIDE: Ride = {
  id: "ride1",
  state: "confirmed",
  price_minor: 3500,
  currency: "USD",
  request: { ...REQUEST, status: "booked" },
  vehicle: VEHICLE,
  driver: DRIVER,
  completed_at: null,
  cancelled_at: null,
  cancel_reason: "",
  created_at: "2026-09-18T11:00:00Z",
  reviews: { mine: null, theirs: null, can_write: false },
  driver_phone: "+96170000000",
};

describe("asking verified drivers for a price", () => {
  beforeEach(() => {
    navigationMocks.search = "destination=byblos";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    navigationMocks.search = "";
  });

  it("fills in the airport for an airport pickup and needs the flight number", async () => {
    const push = vi.spyOn(navigationMocks, "push");
    const calls = route([
      ["/api/v1/catalogue/destinations", [{ slug: "beirut", name: "Beirut", region: "Beirut", lat: 33.9, lng: 35.5 }]],
      ["/api/v1/rides/requests", { ...REQUEST, id: "r9" }],
    ]);
    render(wrap(<NewRideForm />));
    fireEvent.click(screen.getByRole("radio", { name: /Airport pickup/ }));
    expect(screen.getByLabelText(localCopy.en.pickupLabel)).toHaveValue(localCopy.en.airportName);
    const send = screen.getByRole("button", { name: localCopy.en.sendRequest });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText(localCopy.en.flightLabel), { target: { value: "me202" } });
    fireEvent.change(screen.getByLabelText(localCopy.en.dateLabel), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText(localCopy.en.timeLabel), { target: { value: "21:00" } });
    expect(send).toBeEnabled();
    fireEvent.click(send);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/rides/r9"));
    const body = JSON.parse(String(calls.find((call) => call.url === "/api/v1/rides/requests")?.init?.body));
    expect(body).toMatchObject({
      kind: "airport",
      destination: "byblos",
      flight_number: "ME202",
      pickup_lat: 33.8209,
      // 21:00 in Beirut on 1 October is 18:00 UTC (summer time).
      starts_at: "2026-10-01T18:00:00.000Z",
    });
    push.mockRestore();
  });

  it("needs somewhere to go for a ride", () => {
    route([["/api/v1/catalogue/destinations", []]]);
    render(wrap(<NewRideForm />));
    fireEvent.change(screen.getByLabelText(localCopy.en.pickupLabel), { target: { value: "Byblos souk" } });
    expect(screen.getByRole("button", { name: localCopy.en.sendRequest })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(localCopy.en.dropoffLabel), { target: { value: "Batroun" } });
    expect(screen.getByRole("button", { name: localCopy.en.sendRequest })).toBeEnabled();
  });
});

describe("a ride request", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows each price with the driver's checks and books one, then shows the plate and a share link once", async () => {
    let booked = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/v1/rides/quotes/q1/accept") {
          booked = true;
          return jsonResponse({ ...RIDE, share_token: "tok123" });
        }
        if (url === "/api/v1/rides/requests/r1") {
          return jsonResponse(booked ? { ...REQUEST, status: "booked", ride: RIDE } : REQUEST);
        }
        return jsonResponse({ detail: "not found" }, 404);
      }),
    );
    render(wrap(<RideRequestView requestId="r1" />));
    expect(await screen.findByText(/wait at arrivals/)).toBeInTheDocument();
    expect(screen.getByText(/What we checked/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Book at $35" }));
    expect(await screen.findByText("P 123456")).toBeInTheDocument();
    expect(screen.getByText(localCopy.en.checkPlate)).toBeInTheDocument();
    expect(screen.getByText(localCopy.en.shareOnce)).toBeInTheDocument();
    expect(screen.getByText(/\/rides\/shared\/tok123$/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Call \+96170000000/ })).toHaveAttribute("href", "tel:+96170000000");
    expect(screen.getByText("Pay $35 to the driver in the car.")).toBeInTheDocument();
  });

  it("says prices are on their way while none have arrived", async () => {
    route([["/api/v1/rides/requests/r1", { ...REQUEST, quotes: [] }]]);
    render(wrap(<RideRequestView requestId="r1" />));
    expect(await screen.findByText(localCopy.en.quotesWaiting)).toBeInTheDocument();
  });

  it("lists booked rides and open requests", async () => {
    route([["/api/v1/rides/mine", { requests: [REQUEST], rides: [RIDE] }]]);
    render(wrap(<MyRides />));
    const booked = await screen.findByRole("heading", { name: localCopy.en.bookedRides });
    expect(booked).toBeInTheDocument();
    expect(screen.getByText(/Georges/)).toBeInTheDocument();
    expect(screen.getByText("Prices: 1")).toBeInTheDocument();
  });
});

describe("the shared ride page", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows only the driver, the car and the plate", async () => {
    route([
      [
        "/api/v1/rides/shared/abc",
        {
          state: "confirmed",
          starts_at: "2026-10-01T18:00:00Z",
          kind: "airport",
          pickup: "Beirut airport",
          dropoff: "Gemmayzeh",
          driver: { display_name: "Georges", photo_url: null, trust_level: "verified" },
          vehicle: { plate: "P 123456", make: "Toyota", model: "Corolla", colour: "Grey" },
        },
      ],
    ]);
    render(wrap(<SharedRideView token="abc" />));
    expect(await screen.findByText("P 123456")).toBeInTheDocument();
    expect(screen.getByText("Georges")).toBeInTheDocument();
    expect(screen.queryByText(/\+961/)).not.toBeInTheDocument();
  });

  it("explains an expired link", async () => {
    route([]);
    render(wrap(<SharedRideView token="gone" />));
    expect(await screen.findByText(localCopy.en.sharedGone)).toBeInTheDocument();
  });
});

describe("the driver directory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    navigationMocks.search = "";
  });

  it("filters by destination picked by name", async () => {
    navigationMocks.search = "destination=byblos";
    const calls = route([
      [
        "/api/v1/catalogue/destinations",
        [{ slug: "byblos", name: "Byblos", region: "Mount Lebanon", lat: 34.1, lng: 35.6 }],
      ],
      ["/api/v1/rides/drivers", [DRIVER]],
    ]);
    render(wrap(<DriverDirectory />));
    const card = await screen.findByRole("link", { name: /See Georges/ });
    expect(card).toHaveAttribute("href", "/drivers/georges");
    expect(within(card).getByText(localCopy.en.newDriver)).toBeInTheDocument();
    expect(calls.some((call) => call.url === "/api/v1/rides/drivers?destination=byblos")).toBe(true);
  });
});
