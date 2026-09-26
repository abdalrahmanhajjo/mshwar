/// <reference types="vitest-axe/extend-expect" />
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { SavePlan } from "./save-plan";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { plannerCopy } from "@/lib/planner-copy";

const copy = plannerCopy.en;

function fakeApi(saved: boolean) {
  const calls: { url: string; method: string; body?: string }[] = [];
  let state = saved;
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? "GET", body: init?.body as string | undefined });
    if (String(url).endsWith("/save")) state = true;
    return new Response(
      JSON.stringify({ trip_id: "t1", saved: state, saved_at: state ? "2026-09-26T10:00:00Z" : null }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }) as unknown as typeof fetch;
  return calls;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("saving a plan", () => {
  it("keeps a plan only after the traveller confirms", async () => {
    const calls = fakeApi(false);
    const { container } = render(
      <LocaleProvider>
        <SavePlan tripId="t1" title="Plan · batroun" copy={copy} />
      </LocaleProvider>,
    );
    expect(await screen.findByText(copy.unsavedNote)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
    expect(await screen.findByRole("dialog", { name: "Save this plan?" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Plan · batroun");
    expect(calls.map((call) => call.method)).toEqual(["GET"]);
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Batroun weekend" } });
    fireEvent.click(screen.getByRole("button", { name: "Yes, save it" }));
    expect(await screen.findByText("Saved to My trips")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in My trips" })).toHaveAttribute(
      "href",
      expect.stringContaining("/trips/t1"),
    );
    const save = calls.find((call) => call.url === "/api/v1/planner/trips/t1/save");
    expect(save?.method).toBe("POST");
    expect(JSON.parse(save?.body ?? "{}")).toEqual({ name: "Batroun weekend" });
  });

  it("does nothing when the traveller cancels", async () => {
    const calls = fakeApi(false);
    render(
      <LocaleProvider>
        <SavePlan tripId="t1" title="Plan" copy={copy} />
      </LocaleProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Save plan" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.map((call) => call.url)).toEqual(["/api/v1/planner/trips/t1/saved"]);
    expect(screen.getByText(copy.unsavedNote)).toBeInTheDocument();
  });

  it("says a saved plan is saved", async () => {
    fakeApi(true);
    render(
      <LocaleProvider>
        <SavePlan tripId="t1" title="Plan" copy={copy} />
      </LocaleProvider>,
    );
    expect(await screen.findByText("Saved to My trips")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save plan" })).not.toBeInTheDocument();
  });
});
