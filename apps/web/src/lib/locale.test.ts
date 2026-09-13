import { describe, expect, it } from "vitest";
import { applyDocumentLocale, isLocale, localeDirection, parseLocale } from "./locale";

describe("locale helpers", () => {
  it("parses and rejects unknown locales", () => {
    expect(parseLocale("ar")).toBe("ar");
    expect(parseLocale("nope")).toBe("en");
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(localeDirection("ar")).toBe("rtl");
    expect(localeDirection("fr")).toBe("ltr");
  });

  it("applies lang and dir on the document", () => {
    applyDocumentLocale("ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
  });
});
