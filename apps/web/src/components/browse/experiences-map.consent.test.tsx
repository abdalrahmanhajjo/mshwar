import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  document.cookie = "mshwar-consent=; Path=/; Max-Age=0";
});

describe("The map waits for consent (MSHWAR-113)", () => {
  it("loads no third-party map until maps are allowed, and needs no API key", async () => {
    vi.resetModules();
    const { ExperiencesMap } = await import("@/components/browse/experiences-map");
    const { CookieConsentProvider } = await import("@/components/legal/cookie-consent");
    const { LocaleProvider } = await import("@/components/shell/locale-provider");
    const { readCookieChoices } = await import("@/lib/cookie-consent");

    const { container } = render(
      <LocaleProvider>
        <CookieConsentProvider initial={null}>
          <ExperiencesMap items={[]} onSearchArea={() => undefined} />
        </CookieConsentProvider>
      </LocaleProvider>,
    );
    expect(container.querySelector("[data-map-root]")).toBeNull();
    expect(screen.getByText("The map is off")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Allow maps" }));
    expect(readCookieChoices()).toEqual({ errors: false, maps: true });
    expect(container.querySelector("[data-map-root]")).not.toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
  });
});
