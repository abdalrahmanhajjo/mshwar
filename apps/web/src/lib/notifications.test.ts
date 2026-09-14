import { describe, expect, it } from "vitest";
import { marketingOptOutNeverBlocksTransactional } from "./notifications";
import { notificationCopy } from "./notifications-copy";

describe("notification consent helpers", () => {
  it("keeps transactional email on when marketing is off", () => {
    expect(
      marketingOptOutNeverBlocksTransactional({
        transactional_email: true,
        marketing_email: false,
        marketing_in_app: false,
      }),
    ).toBe(true);
  });

  it("has matching copy keys in en, ar and fr", () => {
    const keys = Object.keys(notificationCopy.en);
    expect(Object.keys(notificationCopy.ar)).toEqual(keys);
    expect(Object.keys(notificationCopy.fr)).toEqual(keys);
  });
});
