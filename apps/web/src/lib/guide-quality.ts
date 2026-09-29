import { apiRequest } from "@/lib/api/client";

/** Guide plan step 7: quality, levels, ranking and strikes. Every number comes from real bookings. */

export type GuideLevel = "new" | "trusted" | "top";

export type ReviewPartKey = "knowledge" | "communication" | "value" | "route";
export const REVIEW_PARTS: ReviewPartKey[] = ["knowledge", "communication", "value", "route"];
export type ReviewParts = Partial<Record<ReviewPartKey, number | null>>;

export type QualityStats = {
  completed_runs: number;
  recent_runs: number;
  reviews: number;
  rating: number | null;
  requests_due: number;
  answered_24h: number;
  answered_24h_rate: number | null;
  median_response_minutes: number | null;
  requests_accepted: number;
  bookings_held: number;
  guide_cancellations: number;
  cancel_rate: number;
  completeness: number;
  profile: Record<"bio" | "languages" | "photos" | "meeting_point" | "schedule", boolean>;
};

export type RankPartKey = "review" | "response" | "reliability" | "conversion" | "completeness" | "freshness";
export const RANK_PARTS: RankPartKey[] = [
  "review",
  "response",
  "reliability",
  "conversion",
  "completeness",
  "freshness",
];

export type Strike = {
  id: string;
  kind: "guide_cancellation" | "no_show" | "safety" | "conduct" | "other";
  reason: string;
  booking_id: string | null;
  automatic: boolean;
  created_at: string;
  expires_at: string;
  voided_at: string | null;
  void_reason: string;
  active: boolean;
};

export type MyQuality = {
  level: GuideLevel;
  earned: GuideLevel;
  held_until: string | null;
  computed_at: string | null;
  stats: QualityStats;
  thresholds: {
    trusted: { completed_runs: number; rating: number; answered_24h_rate: number; cancel_rate: number };
    top: { completed_runs: number; rating: number; median_response_minutes: number; cancel_rate: number };
  };
  ranking: { score: number; boost: number; parts: Record<RankPartKey, number> };
  paused_until: string | null;
  active_strikes: number;
  strikes: Strike[];
};

export type AdminGuideQuality = {
  id: string;
  slug: string;
  display_name: string;
  status: string;
  level: GuideLevel;
  earned: GuideLevel;
  held_until: string | null;
  score: number | null;
  stats: Partial<QualityStats>;
  computed_at: string | null;
  paused_until: string | null;
  active_strikes: number;
  strikes: Strike[];
};

export type AdminGuideReview = {
  id: string;
  direction: "traveller_to_guide" | "guide_to_traveller";
  rating: number;
  body: string;
  parts: ReviewParts | null;
  reply: string | null;
  replied_at: string | null;
  created_at: string;
  released: boolean;
  hidden: boolean;
  hidden_reason: string;
  guide: { slug: string; display_name: string };
  author: string | null;
};

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function fetchMyQuality() {
  return apiRequest<MyQuality>("/api/v1/guides/me/quality");
}

export function replyToReview(reviewId: string, body: string) {
  return apiRequest<{ id: string; reply: string; replied_at: string }>(
    `/api/v1/guides/reviews/${reviewId}/reply`,
    post({ body }),
  );
}

export function fetchAdminGuideQuality(q = "") {
  return apiRequest<AdminGuideQuality[]>(`/api/v1/admin/guide-quality?q=${encodeURIComponent(q)}`);
}

export function addGuideStrike(guideId: string, kind: Strike["kind"], reason: string) {
  return apiRequest<{ outcome: string; guides: AdminGuideQuality[] }>(
    `/api/v1/admin/guides/${guideId}/strikes`,
    post({ kind, reason }),
  );
}

export function voidGuideStrike(strikeId: string, reason: string) {
  return apiRequest<AdminGuideQuality[]>(`/api/v1/admin/guide-strikes/${strikeId}/void`, post({ reason }));
}

export function fetchAdminGuideReviews(state: "all" | "hidden" | "low" | "replied" = "all") {
  return apiRequest<AdminGuideReview[]>(`/api/v1/admin/guide-reviews?state=${state}`);
}

export function moderateGuideReview(reviewId: string, action: "hide" | "show" | "remove_reply", reason: string) {
  return apiRequest<AdminGuideReview[]>(`/api/v1/admin/guide-reviews/${reviewId}`, post({ action, reason }));
}

/** Only the parts a traveller actually rated. */
export function ratedParts(parts: ReviewParts | null | undefined): [ReviewPartKey, number][] {
  if (!parts) return [];
  return REVIEW_PARTS.flatMap((key) => {
    const value = parts[key];
    return typeof value === "number" ? [[key, value] as [ReviewPartKey, number]] : [];
  });
}

/** What still stands between the guide and the next level, as short items the page can word. */
export function nextLevelGaps(quality: MyQuality): { key: string; have: string; need: string }[] {
  const target = quality.earned === "new" ? "trusted" : quality.earned === "trusted" ? "top" : null;
  if (!target) return [];
  const s = quality.stats;
  const gaps: { key: string; have: string; need: string }[] = [];
  const t = quality.thresholds[target];
  if (s.completed_runs < t.completed_runs) {
    gaps.push({ key: "runs", have: String(s.completed_runs), need: String(t.completed_runs) });
  }
  if (s.rating === null || s.rating < t.rating) {
    gaps.push({ key: "rating", have: s.rating === null ? "—" : s.rating.toFixed(1), need: t.rating.toFixed(1) });
  }
  if (
    target === "trusted" &&
    s.requests_due > 0 &&
    (s.answered_24h_rate ?? 0) < quality.thresholds.trusted.answered_24h_rate
  ) {
    gaps.push({
      key: "answered",
      have: `${Math.round((s.answered_24h_rate ?? 0) * 100)}%`,
      need: `${Math.round(quality.thresholds.trusted.answered_24h_rate * 100)}%`,
    });
  }
  if (
    target === "top" &&
    s.requests_due > 0 &&
    (s.median_response_minutes ?? Infinity) >= quality.thresholds.top.median_response_minutes
  ) {
    gaps.push({
      key: "median",
      have: s.median_response_minutes === null ? "—" : String(s.median_response_minutes),
      need: String(quality.thresholds.top.median_response_minutes),
    });
  }
  if (s.cancel_rate > t.cancel_rate) {
    gaps.push({
      key: "cancel",
      have: `${Math.round(s.cancel_rate * 100)}%`,
      need: `${Math.round(t.cancel_rate * 100)}%`,
    });
  }
  return gaps;
}
