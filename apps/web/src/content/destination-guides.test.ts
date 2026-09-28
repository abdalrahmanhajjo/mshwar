import { describe, expect, it } from "vitest";
import { DESTINATION_GUIDES, publishedGuide } from "./destination-guides";

describe("destination guides", () => {
  it("never shows a guide before a person has approved it", () => {
    for (const [slug, guide] of Object.entries(DESTINATION_GUIDES)) {
      expect(publishedGuide(slug) === undefined).toBe(!guide.reviewed);
      if (guide.reviewed) expect(guide.reviewedBy, `${slug} needs reviewedBy`).toBeTruthy();
    }
  });

  it("has the same shape in English and Arabic", () => {
    for (const [slug, guide] of Object.entries(DESTINATION_GUIDES)) {
      expect(guide.overview.en.length, slug).toBeGreaterThan(0);
      expect(guide.overview.ar.length, slug).toBe(guide.overview.en.length);
      for (const text of [guide.bestTime, guide.gettingThere]) {
        expect(text.en.trim(), slug).not.toBe("");
        expect(text.ar.trim(), slug).not.toBe("");
      }
      for (const source of guide.sources) expect(source.url, slug).toMatch(/^https:\/\//);
    }
  });
});
