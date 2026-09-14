import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { RatingSummary } from "./reviews-panel";

describe("rating summary", () => {
  it("shows the low-sample rule instead of a misleading average", () => {
    render(
      <LocaleProvider>
        <RatingSummary
          aggregate={{
            count: 1,
            average: 5,
            distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 1 },
            low_sample: true,
            honest: "Too few reviews to show a reliable average.",
          }}
        />
      </LocaleProvider>,
    );
    expect(screen.getByText(/Too few reviews/)).toBeInTheDocument();
    expect(screen.getByText("5 · 1")).toBeInTheDocument();
  });
});
