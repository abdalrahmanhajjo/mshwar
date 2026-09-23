import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GuideDirectory, filterGuides } from "./guide-directory";
import { GuideProvider } from "./guide-provider";
import { LanguagePicker, RegionPicker } from "./pickers";
import { PlaceSearch } from "./place-search";
import { TourBuilder } from "./tour-builder";
import { LocaleProvider } from "@/components/shell/locale-provider";
import type { MyGuideProfile, PublicGuide } from "@/lib/guides";
import { matchesQuery, resetDestinationCache } from "@/lib/place-search";

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body, headers: new Headers(), statusText: "" };
}

const DESTINATIONS = [
  { slug: "byblos", name: "Byblos", region: "Mount Lebanon", lat: 34.12, lng: 35.65 },
  { slug: "beirut", name: "Beirut", region: "Beirut", lat: 33.89, lng: 35.5 },
  { slug: "north-lebanon", name: "North Lebanon", region: "North", lat: 34.43, lng: 35.84 },
];

const PLACES = [
  {
    slug: "byblos-citadel",
    title: "Byblos Citadel",
    place_label: "Byblos, Mount Lebanon",
    destination_slug: "byblos",
    lat: 34.1208,
    lng: 35.6453,
    image: null,
  },
  {
    slug: "byblos-old-souk",
    title: "Byblos Old Souk",
    place_label: "Byblos, Mount Lebanon",
    destination_slug: "byblos",
    lat: 34.1213,
    lng: 35.6475,
    image: null,
  },
];

function stubCatalogue(extra: Record<string, unknown> = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("/api/v1/catalogue/experiences")) {
        const q = new URL(url, "http://x").searchParams.get("q")?.toLowerCase() ?? "";
        return jsonResponse({ items: PLACES.filter((place) => place.title.toLowerCase().includes(q)) });
      }
      if (url.includes("/api/v1/catalogue/destinations")) {
        return jsonResponse(DESTINATIONS);
      }
      const key = Object.keys(extra)
        .sort((a, b) => b.length - a.length)
        .find((prefix) => url.includes(prefix));
      return key ? jsonResponse(extra[key]) : jsonResponse({ detail: "not found" }, 404);
    }),
  );
  return calls;
}

const GUIDE: MyGuideProfile = {
  id: "g1",
  slug: "rami-haddad",
  tier: "licensed",
  badge: true,
  display_name: "Rami Haddad",
  headline: "",
  bio: "",
  languages: ["ar", "en"],
  regions: ["beirut"],
  specialities: [],
  years_guiding: null,
  status: "approved",
  organization_id: "org-1",
  phone: "",
  submitted_at: null,
  decided_at: null,
  decision_reason: "",
  required_documents: ["id", "licence"],
  documents: [],
};

function guide(overrides: Partial<PublicGuide>): PublicGuide {
  return {
    id: overrides.slug ?? "g",
    slug: "g",
    tier: "licensed",
    badge: false,
    display_name: "",
    headline: "",
    bio: "",
    languages: [],
    regions: [],
    specialities: [],
    years_guiding: null,
    status: "approved",
    organization_id: null,
    ...overrides,
  };
}

const GUIDES = [
  guide({ slug: "rami", display_name: "Rami Haddad", regions: ["beirut"], languages: ["ar", "en"] }),
  guide({
    slug: "nour",
    display_name: "Nour Khoury",
    regions: ["north-lebanon"],
    languages: ["fr"],
    headline: "Qadisha hikes",
  }),
  guide({ slug: "elie", display_name: "Élie Saab", regions: ["byblos"], languages: ["en"] }),
];

describe("finding things by name, not by handle", () => {
  beforeEach(() => resetDestinationCache());
  afterEach(() => vi.unstubAllGlobals());

  it("matches every word, ignoring case and accents", () => {
    expect(matchesQuery("elie", "Élie Saab")).toBe(true);
    expect(matchesQuery("saab el", "Élie Saab")).toBe(true);
    expect(matchesQuery("rami", "Élie Saab")).toBe(false);
    expect(matchesQuery("  ", "anything")).toBe(true);
  });

  it("filters the directory by name, area and language together", () => {
    expect(filterGuides(GUIDES, { query: "nour", region: "", language: "" }).map((g) => g.slug)).toEqual(["nour"]);
    expect(filterGuides(GUIDES, { query: "qadisha", region: "", language: "" }).map((g) => g.slug)).toEqual(["nour"]);
    expect(filterGuides(GUIDES, { query: "", region: "", language: "en" }).map((g) => g.slug)).toEqual([
      "rami",
      "elie",
    ]);
    expect(filterGuides(GUIDES, { query: "", region: "beirut", language: "fr" })).toEqual([]);
  });

  it("finds a place by typing its name and hands back the handle", async () => {
    stubCatalogue();
    const onPick = vi.fn();
    render(wrap(<PlaceSearch label="Add a stop" onPick={onPick} exclude={["byblos-old-souk"]} />));
    const box = screen.getByRole("combobox", { name: "Add a stop" });
    fireEvent.change(box, { target: { value: "b" } });
    expect(screen.getByText("Type at least two letters.")).toBeInTheDocument();
    fireEvent.change(box, { target: { value: "byblos" } });
    const option = await screen.findByRole("option", { name: /Byblos Citadel/ });
    expect(screen.queryByRole("option", { name: /Old Souk/ })).not.toBeInTheDocument();
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ slug: "byblos-citadel", title: "Byblos Citadel" }));
    expect(option).not.toBeInTheDocument();
  });

  it("says so when no place matches", async () => {
    stubCatalogue();
    render(wrap(<PlaceSearch onPick={() => undefined} />));
    fireEvent.change(screen.getByRole("combobox", { name: "Search places by name" }), {
      target: { value: "zzzz" },
    });
    expect(await screen.findByText(/No places match/)).toBeInTheDocument();
  });

  it("picks areas by destination name and languages by language name", async () => {
    stubCatalogue();
    const onRegions = vi.fn();
    const onLanguages = vi.fn();
    render(
      wrap(
        <>
          <RegionPicker value={["beirut"]} onChange={onRegions} />
          <LanguagePicker value={["ar"]} onChange={onLanguages} />
        </>,
      ),
    );
    fireEvent.click(await screen.findByRole("button", { name: "North Lebanon" }));
    expect(onRegions).toHaveBeenCalledWith(["beirut", "north-lebanon"]);
    expect(screen.getByRole("button", { name: "Beirut" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "French" }));
    expect(onLanguages).toHaveBeenCalledWith(["ar", "fr"]);
    fireEvent.change(screen.getByLabelText(/Other language/), { target: { value: "EL" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onLanguages).toHaveBeenLastCalledWith(["ar", "el"]);
  });

  it("lets a traveller search the directory and shows areas by name", async () => {
    stubCatalogue();
    render(wrap(<GuideDirectory initial={GUIDES} />));
    expect(await screen.findByRole("option", { name: "North Lebanon" })).toBeInTheDocument();
    expect(screen.getAllByText("North Lebanon").length).toBeGreaterThan(1);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search guides by name" }), {
      target: { value: "rami" },
    });
    expect(screen.getByText("Rami Haddad")).toBeInTheDocument();
    expect(screen.queryByText("Nour Khoury")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 shown");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search guides by name" }), {
      target: { value: "nobody" },
    });
    expect(screen.getByText("No guides match these filters.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Clear filters/ }));
    expect(screen.getByText("Nour Khoury")).toBeInTheDocument();
  });

  it("builds a tour route from place names and sends only the handles", async () => {
    const calls = stubCatalogue({
      "/api/v1/guides/me/tours": [],
      "/api/v1/guides/me": GUIDE,
    });
    render(
      wrap(
        <GuideProvider>
          <TourBuilder />
        </GuideProvider>,
      ),
    );
    fireEvent.click(await screen.findByRole("button", { name: /New tour/ }));
    const form = screen.getByRole("form", { name: "New tour" });
    fireEvent.change(within(form).getByLabelText("Title"), { target: { value: "Old Byblos" } });
    fireEvent.change(within(form).getByLabelText("What happens on the day"), {
      target: { value: "A slow walk through the old town." },
    });
    const stopBox = within(form).getByRole("combobox", { name: "Add stop" });
    fireEvent.change(stopBox, { target: { value: "citadel" } });
    fireEvent.mouseDown(await screen.findByRole("option", { name: /Byblos Citadel/ }));
    expect(within(form).getByText("Byblos Citadel")).toBeInTheDocument();

    const meetBox = within(form).getByRole("combobox", { name: "Meet at a place from the catalogue" });
    fireEvent.change(meetBox, { target: { value: "souk" } });
    fireEvent.mouseDown(await screen.findByRole("option", { name: /Old Souk/ }));
    expect(within(form).getByLabelText("Meeting point")).toHaveValue("Byblos Old Souk");
    expect(within(form).getByText(/Pin set: 34\.1213, 35\.6475/)).toBeInTheDocument();

    fireEvent.submit(form);
    await waitFor(() => expect(calls.some((call) => call.init?.method === "PUT")).toBe(true));
    const body = JSON.parse(String(calls.find((call) => call.init?.method === "PUT")?.init?.body));
    expect(body.route).toEqual(["byblos-citadel"]);
    expect(body.meeting).toMatchObject({
      name: "Byblos Old Souk",
      lat: 34.1213,
      lng: 35.6475,
      destination_slug: "byblos",
    });
    expect(body.languages).toEqual(["ar", "en"]);
  });
});
