import { apiRequest } from "@/lib/api/client";

export type GuideTier = "licensed" | "host";
export type GuideStatus = "draft" | "submitted" | "approved" | "rejected" | "suspended";
export type DocumentKind = "licence" | "id" | "first_aid" | "insurance" | "driving";

/** What everyone may see: an approved guide's shopfront. Never their documents. */
export type PublicGuide = {
  id: string;
  slug: string;
  tier: GuideTier;
  badge: boolean;
  display_name: string;
  headline: string;
  bio: string;
  languages: string[];
  regions: string[];
  specialities: string[];
  years_guiding: number | null;
  status: GuideStatus;
  organization_id: string | null;
};

export type GuideDocument = {
  id: string;
  kind: DocumentKind;
  reference: string;
  issuer: string;
  issued_on: string | null;
  expires_on: string | null;
  verification: "pending" | "verified" | "rejected";
  reason: string;
  expired: boolean;
};

/** The applicant's own view, which does carry the documents. */
export type MyGuideProfile = PublicGuide & {
  phone: string;
  submitted_at: string | null;
  decided_at: string | null;
  decision_reason: string;
  required_documents: DocumentKind[];
  documents: GuideDocument[];
};

export type GuideApplicationRow = {
  id: string;
  slug: string;
  display_name: string;
  tier: GuideTier;
  status: GuideStatus;
  badge: boolean;
  submitted_at: string | null;
  document_count: number;
  missing_documents: DocumentKind[];
};

export type GuideCase = MyGuideProfile & { document_keys: Record<string, string> };

export type GuideProfileInput = {
  tier: GuideTier;
  display_name: string;
  headline?: string;
  bio?: string;
  languages?: string[];
  regions?: string[];
  specialities?: string[];
  years_guiding?: number | null;
  phone?: string;
};

export type GuideDocumentInput = {
  kind: DocumentKind;
  document_key: string;
  reference?: string;
  issuer?: string;
  issued_on?: string | null;
  expires_on?: string | null;
};

const json = (body: unknown): RequestInit => ({
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function fetchMyGuideProfile() {
  return apiRequest<MyGuideProfile | null>("/api/v1/guides/me");
}

export function saveGuideProfile(input: GuideProfileInput) {
  return apiRequest<MyGuideProfile>("/api/v1/guides/me", json(input));
}

export function saveGuideDocument(input: GuideDocumentInput) {
  return apiRequest<MyGuideProfile>("/api/v1/guides/me/documents", json(input));
}

export function submitGuideApplication() {
  return apiRequest<MyGuideProfile>("/api/v1/guides/me/submit", { method: "POST" });
}

export function fetchGuideDirectory(filters: { region?: string; language?: string; tier?: string } = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      search.set(key, value);
    }
  }
  const query = search.toString();
  return apiRequest<PublicGuide[]>(`/api/v1/guides${query ? `?${query}` : ""}`);
}

export function fetchGuidePage(slug: string) {
  return apiRequest<PublicGuide>(`/api/v1/guides/${encodeURIComponent(slug)}`);
}

export function fetchGuideQueue(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<GuideApplicationRow[]>(`/api/v1/admin/guides${query}`);
}

export function fetchGuideCase(profileId: string) {
  return apiRequest<GuideCase>(`/api/v1/admin/guides/${profileId}`);
}

export function reviewGuideDocument(credentialId: string, decision: "verified" | "rejected", reason = "") {
  return apiRequest<MyGuideProfile>(`/api/v1/admin/guides/documents/${credentialId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, reason }),
  });
}

export function decideGuideApplication(
  profileId: string,
  decision: "approved" | "rejected" | "suspended",
  reason = "",
) {
  return apiRequest<MyGuideProfile>(`/api/v1/admin/guides/${profileId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, reason }),
  });
}
