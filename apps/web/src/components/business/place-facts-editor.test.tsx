/// <reference types="vitest-axe/extend-expect" />
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { PlaceFactsEditor } from "./place-facts-editor";
import { LocaleProvider } from "@/components/shell/locale-provider";

function mockApi(current: Record<string, unknown>) {
  const puts: Record<string, unknown>[] = [];
  globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    const reply = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body));
      puts.push(body);
      return reply({ ...body, source: "owner", checked_on: "2026-09-25", stale: false });
    }
    return reply(current);
  }) as unknown as typeof fetch;
  return puts;
}

const renderEditor = (kind: "restaurant" | "experience") =>
  render(
    <LocaleProvider>
      <PlaceFactsEditor orgId="org-1" experienceId="exp-1" listingKind={kind} />
    </LocaleProvider>,
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe("place facts editor", () => {
  it("keeps unknown answers unknown and sends only what the owner is sure of", async () => {
    const puts = mockApi({ halal: true, views: ["sea"], languages: ["arabic"], checked_on: "2026-01-10" });
    const { container } = renderEditor("restaurant");
    const halal = await screen.findByLabelText("Halal");
    expect(halal).toHaveValue("yes");
    expect(screen.getByLabelText("Vegan dishes")).toHaveValue("unknown");
    expect(screen.getByLabelText("Sea")).toBeChecked();
    expect(screen.queryByLabelText("Minimum age")).toBeNull();
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.change(screen.getByLabelText("Wheelchair access"), { target: { value: "no" } });
    fireEvent.click(screen.getByLabelText("Sunset"));
    fireEvent.change(screen.getByLabelText("Languages spoken"), { target: { value: "Arabic, English" } });
    fireEvent.click(screen.getByRole("button", { name: "Save facts" }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({
      halal: true,
      wheelchair_access: false,
      views: ["sea", "sunset"],
      languages: ["Arabic", "English"],
      dress_code: "",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Saved.");
  });

  it("says when answers are too old to be used, and hides food questions for an activity", async () => {
    mockApi({ parking: false, stale: true, checked_on: "2025-01-01" });
    renderEditor("experience");
    expect(await screen.findByText(/over a year old/)).toBeInTheDocument();
    expect(screen.getByLabelText("Parking")).toHaveValue("no");
    expect(screen.queryByLabelText("Halal")).toBeNull();
    expect(screen.getByLabelText("Minimum age")).toBeInTheDocument();
  });
});
