import { describe, expect, it } from "vitest";
import { businessCopy, CHECKLIST_LABELS } from "./business-copy";

describe("business copy", () => {
  it("has the same keys in en, ar and fr", () => {
    const keys = Object.keys(businessCopy.en);
    expect(Object.keys(businessCopy.ar)).toEqual(keys);
    expect(Object.keys(businessCopy.fr)).toEqual(keys);
    expect(CHECKLIST_LABELS.verified).toBe("itemVerified");
  });
});
