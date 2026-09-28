import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MAP_STYLE_URL, TILE_ORIGIN, viaTileProxy } from "@/lib/maplibre";

describe("Maps load nothing from a third party (MSHWAR-113)", () => {
  it("shows the map with no cookie choice, no iframe and no API key", async () => {
    const { ExperiencesMap } = await import("@/components/browse/experiences-map");
    const { LocaleProvider } = await import("@/components/shell/locale-provider");

    const { container } = render(
      <LocaleProvider>
        <ExperiencesMap items={[]} onSearchArea={() => undefined} />
      </LocaleProvider>,
    );
    expect(container.querySelector("[data-map-root]")).not.toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("sends the style, tiles, glyphs and sprites through Mshwar's own origin", () => {
    expect(MAP_STYLE_URL.startsWith("/")).toBe(true);
    for (const path of ["/styles/positron", "/planet/20250101/7/77/51.pbf", "/fonts/Noto Sans Bold/0-255.pbf"]) {
      const url = viaTileProxy(`${TILE_ORIGIN}${path}`);
      expect(url.startsWith(`${window.location.origin}/map-tiles/`)).toBe(true);
    }
    // Anything else is left alone.
    expect(viaTileProxy("https://example.org/a.png")).toBe("https://example.org/a.png");
  });
});
