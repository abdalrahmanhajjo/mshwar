import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DestinationsView } from "@/components/browse/destinations-view";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { LOCALES } from "@/lib/locale";

describe("MSHWAR-32 locale snapshots", () => {
  it.each(LOCALES)("renders the destinations index in %s", (locale) => {
    const { container } = render(
      <LocaleProvider initialLocale={locale}>
        <DestinationsView />
      </LocaleProvider>,
    );
    expect(container).toMatchSnapshot();
  });
});
