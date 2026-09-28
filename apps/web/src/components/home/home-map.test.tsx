import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { insideLebanon } from "@/lib/lebanon-outline";

// The live map needs WebGL; here it only has to show that it was mounted.
vi.mock("@/components/browse/lebanon-map", () => ({
  LebanonMap: ({ label }: { label: string }) => <div data-map-root aria-label={label} />,
}));

async function renderHomeMap() {
  const { HomeMap } = await import("@/components/home/home-map");
  const { LocaleProvider } = await import("@/components/shell/locale-provider");
  const { EXPERIENCES } = await import("@/lib/catalog");
  return render(
    <LocaleProvider>
      <HomeMap experiences={EXPERIENCES} />
    </LocaleProvider>,
  );
}

describe("The homepage map", () => {
  it("draws Lebanon's outline, not the sea or Syria", () => {
    expect(insideLebanon(35.5, 33.89)).toBe(true); // Beirut
    expect(insideLebanon(36.2, 34.0)).toBe(true); // Baalbek
    expect(insideLebanon(35.3, 33.9)).toBe(false); // at sea off Beirut
    expect(insideLebanon(36.29, 33.51)).toBe(false); // Damascus
  });

  it("shows every place as a pin and as a button, and a tap selects it", async () => {
    await renderHomeMap();
    const section = screen.getByRole("region", { name: "All of Lebanon, one map away." });
    const pins = within(section).getAllByRole("button", { pressed: false });
    expect(pins.length).toBeGreaterThan(1);
    const pin = pins[pins.length - 1];
    if (!pin) throw new Error("no pin");
    fireEvent.click(pin);
    expect(pin).toHaveAttribute("aria-pressed", "true");
    expect(section.querySelector("iframe")).toBeNull();
  });

  it("puts the real map in without asking for a cookie choice", async () => {
    const { container } = await renderHomeMap();
    await waitFor(() => expect(container.querySelector("[data-map-root]")).not.toBeNull());
  });
});
