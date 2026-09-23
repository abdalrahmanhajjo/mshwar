import { apiRequest } from "@/lib/api/client";

export type ProposalKind = "new" | "correction";
export type ProposalStatus = "submitted" | "accepted" | "rejected" | "withdrawn";

export type ProposalPhoto = {
  id: string;
  source: "guide-upload" | "wikimedia-commons";
  provider: string;
  object_key: string;
  source_url: string | null;
  license: string;
  license_url: string | null;
  attribution: string;
  alt_text: string;
  url: string | null;
};

export type ProposedPlace = {
  name?: string;
  title?: string;
  description?: string;
  category?: string;
  destination_slug?: string;
  address?: string;
  lat?: number;
  lng?: number;
  setting?: "indoor" | "outdoor" | "mixed";
  listing_kind?: "experience" | "attraction" | "restaurant";
  suggested_minutes?: number;
  free_entry?: boolean;
  closed?: boolean;
  note?: string;
};

export type PlaceProposal = {
  id: string;
  kind: ProposalKind;
  status: ProposalStatus;
  payload: ProposedPlace;
  evidence_urls: string[];
  reason: string;
  created_at: string;
  reviewed_at: string | null;
  target: {
    id: string;
    slug: string;
    title: string;
    description: string;
    address: string;
    lat: number;
    lng: number;
  } | null;
  resulting_slug: string | null;
  photos: ProposalPhoto[];
  guide: { id: string; slug: string; display_name: string; tier: string };
};

export type ProposalAllowance = {
  accepted: number;
  rejected: number;
  used: number;
  daily_cap: number;
  remaining: number;
};

export type QueuedProposal = PlaceProposal & { allowance: ProposalAllowance };

export type PlaceContributor = {
  role: "added" | "corrected";
  slug: string;
  display_name: string;
  tier: string;
  at: string;
};

export type OwnPhotoInput = {
  filename: string;
  content_type: string;
  content_base64: string;
  rights_granted: boolean;
  alt_text?: string;
};

export type CommonsPhotoInput = {
  commons_page_url: string;
  commons_image_url: string;
  license: string;
  license_url?: string;
  attribution?: string;
  alt_text?: string;
};

const post = (body?: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export function fetchMyProposals() {
  return apiRequest<{ allowance: ProposalAllowance; proposals: PlaceProposal[] }>("/api/v1/guides/me/proposals");
}

export function submitProposal(input: {
  kind: ProposalKind;
  target_slug?: string;
  place: ProposedPlace;
  evidence_urls: string[];
}) {
  return apiRequest<PlaceProposal>("/api/v1/guides/me/proposals", post(input));
}

export function withdrawProposal(proposalId: string) {
  return apiRequest<PlaceProposal>(`/api/v1/guides/me/proposals/${proposalId}/withdraw`, post());
}

export function addProposalPhoto(proposalId: string, input: OwnPhotoInput | CommonsPhotoInput) {
  return apiRequest<PlaceProposal>(`/api/v1/guides/me/proposals/${proposalId}/photos`, post(input));
}

export function fetchPlaceContributors(slug: string) {
  return apiRequest<PlaceContributor[]>(`/api/v1/guides/places/${encodeURIComponent(slug)}/contributors`);
}

export function fetchProposalQueue(status: ProposalStatus | "all" = "submitted") {
  return apiRequest<QueuedProposal[]>(`/api/v1/admin/proposals?status=${status}`);
}

export function decideProposal(proposalId: string, decision: "accepted" | "rejected", reason = "") {
  return apiRequest<PlaceProposal>(`/api/v1/admin/proposals/${proposalId}`, post({ decision, reason }));
}

/** Drop empty fields so a correction only carries what the guide changed. */
export function compactPlace(place: ProposedPlace): ProposedPlace {
  return Object.fromEntries(
    Object.entries(place).filter(
      ([, value]) => value !== "" && value !== undefined && value !== null && !Number.isNaN(value),
    ),
  ) as ProposedPlace;
}
