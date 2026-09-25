import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DestinationsView } from "@/components/browse/destinations-view";
import { ExperienceDetailView } from "@/components/browse/experience-detail-view";
import { HomeView } from "@/components/browse/home-view";
import { IdeasView } from "@/components/browse/ideas-view";
import { TravellerShell } from "@/components/shell/app-shell";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { DESTINATIONS, EXPERIENCES, IDEAS } from "@/lib/catalog";
import { LOCALES, type Locale } from "@/lib/locale";

function wrap(locale: Locale, ui: ReactNode) {
  return <LocaleProvider initialLocale={locale}>{ui}</LocaleProvider>;
}

describe("MSHWAR-32 locale snapshots", () => {
  it.each(LOCALES)("renders the destinations index in %s", (locale) => {
    const { container } = render(wrap(locale, <DestinationsView destinations={DESTINATIONS} />));
    expect(container).toMatchSnapshot();
  });

  it.each(LOCALES)("renders home in %s", (locale) => {
    const { container } = render(wrap(locale, <HomeView />));
    expect(container).toMatchSnapshot();
  });

  it.each(LOCALES)("renders ideas in %s", (locale) => {
    const { container } = render(wrap(locale, <IdeasView ideas={IDEAS} />));
    expect(container).toMatchSnapshot();
  });

  it.each(LOCALES)("renders listing detail in %s", (locale) => {
    const experience = EXPERIENCES[0];
    const related = EXPERIENCES.filter((item) => item.slug !== experience.slug).slice(0, 3);
    const { container } = render(wrap(locale, <ExperienceDetailView experience={experience} related={related} />));
    expect(container).toMatchSnapshot();
  });

  it.each(LOCALES)("renders traveller shell chrome in %s", (locale) => {
    const { container } = render(
      wrap(
        locale,
        <TravellerShell currentPath="/">
          <p>Page</p>
        </TravellerShell>,
      ),
    );
    expect(container).toMatchSnapshot();
  });

  it("prefixes destination cards for a shareable Arabic URL", () => {
    render(wrap("ar", <DestinationsView destinations={DESTINATIONS} />));
    expect(screen.getByRole("link", { name: "Byblos" })).toHaveAttribute("href", "/ar/destinations/byblos");
  });
});

describe("open data credit", () => {
  it("credits OpenStreetMap on a listing made from it, and nothing on others", () => {
    const experience = {
      ...EXPERIENCES[0],
      attributions: [
        {
          source: "osm",
          name: "OpenStreetMap contributors",
          licence: "ODbL-1.0",
          licence_url: "https://www.openstreetmap.org/copyright",
          record_url: "https://www.openstreetmap.org/node/42",
        },
      ],
    };
    const { rerender } = render(wrap("en", <ExperienceDetailView experience={experience} related={[]} />));
    expect(screen.getByRole("link", { name: "© OpenStreetMap contributors" })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/node/42",
    );
    expect(screen.getByRole("link", { name: "ODbL-1.0" })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/copyright",
    );
    rerender(wrap("en", <ExperienceDetailView experience={EXPERIENCES[0]} related={[]} />));
    expect(screen.queryByText(/OpenStreetMap/)).not.toBeInTheDocument();
  });
});
