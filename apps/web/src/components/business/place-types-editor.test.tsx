/// <reference types="vitest-axe/extend-expect" />
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { PlaceTypesEditor } from "./place-types-editor";
import { LocaleProvider } from "@/components/shell/locale-provider";
import type { PlaceType } from "@/lib/venues";

const type = (slug: string, group: PlaceType["group"], role: PlaceType["role"], extra: Partial<PlaceType> = {}) => ({
  slug,
  group,
  role,
  names: { en: slug.replace("-", " "), ar: slug, fr: slug },
  default_minutes: 60,
  meal_services: [],
  season_months: null,
  needs_schedule: false,
  ...extra,
});

const CATALOGUE: PlaceType[] = [
  type("sweets", "food", "meal", { meal_services: ["breakfast"] }),
  type("cafe", "food", "meal"),
  type("hotel", "stay", "stay"),
  type("bowling", "entertainment", "activity"),
  type("cinema", "entertainment", "activity", { needs_schedule: true }),
  type("arcade", "entertainment", "activity"),
  type("karting", "entertainment", "activity"),
  type("escape-room", "entertainment", "activity"),
  type("billiards", "entertainment", "activity"),
  type("museum", "heritage", "sight"),
];

function mockApi(current: { place_types: string[]; meal_services?: string[]; schedule_note?: string }) {
  const puts: unknown[] = [];
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const reply = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    if (String(url).endsWith("/venues/place-types")) return reply(CATALOGUE);
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body));
      puts.push(body);
      return reply({ roles: ["activity"], meal_services: [], schedule_note: "", ...body });
    }
    return reply({ roles: [], meal_services: [], schedule_note: "", ...current });
  }) as unknown as typeof fetch;
  return puts;
}

const renderEditor = (kind: "restaurant" | "experience") =>
  render(
    <LocaleProvider>
      <PlaceTypesEditor orgId="org-1" experienceId="exp-1" listingKind={kind} />
    </LocaleProvider>,
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe("place types editor", () => {
  it("offers only the kinds a restaurant can be, and saves meals", async () => {
    const puts = mockApi({ place_types: ["sweets"], meal_services: ["breakfast"] });
    renderEditor("restaurant");
    await screen.findByRole("checkbox", { name: "sweets" });
    expect(screen.queryByRole("checkbox", { name: "bowling" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "hotel" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Dinner" }));
    fireEvent.click(screen.getByRole("button", { name: "Save kinds of place" }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ place_types: ["sweets"], meal_services: ["breakfast", "dinner"] });
    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
  });

  it("keeps the order chosen, marks the main kind, caps at six and asks for film times", async () => {
    const puts = mockApi({ place_types: [] });
    const { container } = renderEditor("experience");
    await screen.findByRole("checkbox", { name: "bowling" });
    expect(screen.queryByRole("checkbox", { name: "sweets" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save kinds of place" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("at least one");

    for (const slug of ["cinema", "bowling", "arcade", "karting", "escape-room", "museum"]) {
      fireEvent.click(screen.getByRole("checkbox", { name: slug.replace("-", " ") }));
    }
    const chosen = screen.getByRole("list", { name: "Chosen" });
    expect(within(chosen).getAllByRole("listitem")[0]).toHaveTextContent("cinema");
    expect(within(chosen).getAllByRole("listitem")[0]).toHaveTextContent("Main");
    expect(screen.getByRole("checkbox", { name: "billiards" })).toBeDisabled();
    expect(screen.getByText(/chosen six/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove arcade" }));
    expect(screen.getByRole("checkbox", { name: "billiards" })).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Note about times"), { target: { value: " Call the box office " } });
    fireEvent.click(screen.getByRole("button", { name: "Save kinds of place" }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({
      place_types: ["cinema", "bowling", "karting", "escape-room", "museum"],
      schedule_note: "Call the box office",
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("drops a saved kind the listing can no longer be", async () => {
    const puts = mockApi({ place_types: ["sweets", "bowling"] });
    renderEditor("experience");
    await screen.findByRole("checkbox", { name: "bowling" });
    expect(screen.getByRole("checkbox", { name: "bowling" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Save kinds of place" }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ place_types: ["bowling"] });
  });
});
