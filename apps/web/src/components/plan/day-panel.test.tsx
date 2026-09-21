import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DayPanel, issueMessage } from "./day-panel";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { plannerCopy } from "@/lib/planner-copy";
import type { DayIssue, ManualPreview } from "@/lib/planner";
import type { Experience } from "@/lib/catalog";

const copy = plannerCopy.en;

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

function pick(slug: string, title: string, placeLabel = "Saida"): Experience {
  return {
    slug,
    title,
    summary: "",
    body: "",
    category: "culture",
    destinationSlug: placeLabel.toLowerCase(),
    placeLabel,
    hours: 2,
    tags: [],
    image: "",
    imageAlt: "",
    priceFrom: 20,
    priceLabel: "from",
    bookingMode: "request",
  } as unknown as Experience;
}

function preview(overrides: Partial<ManualPreview> = {}): ManualPreview {
  return {
    stops: [
      {
        position: 1,
        slug: "saida-souks",
        title: "Saida Souks",
        destination_slug: "saida",
        destination_name: "Saida",
        arrives_at: "2026-09-26T09:40:00+03:00",
        leaves_at: "2026-09-26T11:10:00+03:00",
        travel_minutes: 40,
        travel_distance_m: 46_000,
        travel_available: true,
        opens: "09:00",
        closes: "20:00",
        wait_minutes: 0,
        flags: [],
      },
    ],
    feasibility: {
      feasible: true,
      travel_minutes: 40,
      travel_distance_m: 46_000,
      day_minutes: 600,
      travel_share: 0.07,
      spread_m: 0,
      destination_slugs: ["saida"],
      issues: [],
      suggested_order: [],
      order_saves_minutes: 0,
    },
    suggested_days: [],
    total_minor: 4000,
    currency: "USD",
    budget_warning: null,
    infeasible_reason: null,
    ...overrides,
  };
}

const spread: DayIssue = {
  code: "region_spread",
  severity: "blocking",
  positions: [],
  labels: ["Saida Souks", "Tripoli Citadel"],
  detail: { distance_m: 134_000, limit_m: 70_000 },
};

function renderPanel(props: Partial<Parameters<typeof DayPanel>[0]> = {}) {
  const noop = () => {};
  return render(
    wrap(
      <DayPanel
        picks={[pick("saida-souks", "Saida Souks")]}
        preview={preview()}
        checking={false}
        copy={copy}
        locale="en"
        onMove={noop}
        onRemove={noop}
        onReorder={noop}
        onSplit={noop}
        onClear={noop}
        {...props}
      />,
    ),
  );
}

describe("day panel", () => {
  it("shows each stop once, with its town, arrival and opening hours", () => {
    renderPanel();
    expect(screen.getAllByText("Saida Souks")).toHaveLength(1);
    expect(screen.getByText("Saida")).toBeInTheDocument();
    expect(screen.getByText("Open 09:00–20:00")).toBeInTheDocument();
    expect(screen.getByText("40 min driving · 46 km")).toBeInTheDocument();
    expect(screen.getByText("This day fits comfortably.")).toBeInTheDocument();
  });

  it("names both places when they are too far apart for one day", () => {
    renderPanel({
      preview: preview({
        feasibility: { ...preview().feasibility, feasible: false, spread_m: 134_000, issues: [spread] },
      }),
    });
    expect(
      screen.getByText("Saida Souks and Tripoli Citadel are about 134 km apart — too far for one day."),
    ).toBeInTheDocument();
    expect(screen.getByText("Something needs to change before this day can be saved.")).toBeInTheDocument();
  });

  it("offers the shorter driving order and hands back the suggested slugs", () => {
    const onReorder = vi.fn();
    renderPanel({
      onReorder,
      preview: preview({
        feasibility: { ...preview().feasibility, suggested_order: ["b", "a"], order_saves_minutes: 25 },
      }),
    });
    fireEvent.click(screen.getByRole("button", { name: /shortest driving order/i }));
    expect(onReorder).toHaveBeenCalledWith(["b", "a"]);
  });

  it("removes the stop the traveller points at, not the first one", () => {
    const onRemove = vi.fn();
    renderPanel({
      picks: [pick("saida-souks", "Saida Souks"), pick("tripoli-citadel", "Tripoli Citadel", "Tripoli")],
      onRemove,
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove: Tripoli Citadel" }));
    expect(onRemove.mock.calls[0]?.[0]?.slug).toBe("tripoli-citadel");
  });

  it("says what to do when nothing is picked yet", () => {
    renderPanel({ picks: [], preview: null });
    expect(screen.getByText(/Nothing picked yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear all" })).not.toBeInTheDocument();
  });

  it("turns every issue code into a sentence rather than a code", () => {
    const codes: DayIssue[] = [
      { ...spread },
      { code: "long_transfer", severity: "warning", positions: [2], labels: ["Batroun"], detail: { minutes: 95 } },
      {
        code: "travel_heavy",
        severity: "warning",
        positions: [],
        labels: [],
        detail: { travel_minutes: 200, day_minutes: 360 },
      },
      { code: "long_wait", severity: "warning", positions: [1], labels: ["Museum"], detail: { wait_minutes: 70 } },
      { code: "closed_that_day", severity: "blocking", positions: [1], labels: ["Museum"], detail: {} },
      {
        code: "day_overflow",
        severity: "blocking",
        positions: [3],
        labels: ["Souks"],
        detail: { over_by_minutes: 50 },
      },
      { code: "after_hours", severity: "warning", positions: [3], labels: ["Souks"], detail: {} },
      { code: "hours_unknown", severity: "info", positions: [1], labels: ["Museum"], detail: {} },
      { code: "route_unavailable", severity: "info", positions: [1], labels: ["Museum"], detail: {} },
    ];
    for (const issue of codes) {
      const message = issueMessage(issue, copy);
      expect(message).not.toEqual(issue.code);
      expect(message).not.toMatch(/\{\w+\}/);
    }
  });
});
