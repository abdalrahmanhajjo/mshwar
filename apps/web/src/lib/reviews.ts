export const LOW_SAMPLE_THRESHOLD = 3;

export type ReviewAggregate = {
  experience_id?: string;
  average?: number | null;
  count: number;
  distribution: Record<string, number>;
  low_sample: boolean;
  honest?: string | null;
};

export type PublicReview = {
  id: string;
  rating: number;
  body: string;
  verified?: boolean;
  created_at?: string;
  response?: { id: string; body: string; label: string; created_at?: string } | null;
};

export type ReviewEligibility = {
  can_review: boolean;
  items: { booking_id: string; eligible: boolean; reviewed: boolean }[];
};

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    return body.detail ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...init });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as T;
}

export function fetchReviews(listingSlug: string) {
  return request<{ items: PublicReview[]; aggregate: ReviewAggregate }>(
    `/api/v1/reviews?listing_slug=${encodeURIComponent(listingSlug)}`,
  );
}

export function fetchReviewAggregates(listingSlug: string) {
  return request<ReviewAggregate>(`/api/v1/reviews/aggregates?listing_slug=${encodeURIComponent(listingSlug)}`);
}

export function fetchReviewEligibility(listingSlug: string) {
  return request<ReviewEligibility>(`/api/v1/reviews/eligibility?listing_slug=${encodeURIComponent(listingSlug)}`);
}

export function submitReview(input: {
  booking_id: string;
  rating: number;
  body: string;
  dimensions?: Record<string, number>;
}) {
  return request("/api/v1/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function reportReview(reviewId: string, reason: string) {
  return request(`/api/v1/reviews/${reviewId}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

export function fetchPortalReviews(orgId: string) {
  return request<
    {
      id: string;
      rating: number;
      body: string;
      experience_title: string;
      response?: { body: string; label: string } | null;
    }[]
  >(`/api/v1/portal/organizations/${orgId}/reviews`);
}

export function respondToReview(orgId: string, reviewId: string, body: string) {
  return request(`/api/v1/portal/organizations/${orgId}/reviews/${reviewId}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

export function honestAverageLabel(aggregate: ReviewAggregate): string {
  if (aggregate.count === 0) {
    return aggregate.honest || "No verified traveller reviews yet.";
  }
  if (aggregate.low_sample || aggregate.count < LOW_SAMPLE_THRESHOLD) {
    return aggregate.honest || "Too few reviews to show a reliable average.";
  }
  return `${Number(aggregate.average).toFixed(1)} from ${aggregate.count} reviews`;
}
