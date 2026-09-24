import { apiRequest } from "@/lib/api/client";
import type { MyPartner, PartnerKind, PartnerStatus, TrustLevel } from "@/lib/partners";

/** The verification queue for drivers and money changers. Mirrors services/api admin_trust.py. */
export type PartnerQueueRow = {
  id: string;
  kind: PartnerKind;
  slug: string;
  display_name: string;
  status: PartnerStatus;
  trust_level: TrustLevel;
  submitted_at: string | null;
  regions: string[];
  pending_documents: number;
  missing: MyPartner["missing"];
  waiting_hours: number | null;
};

export type TrustEvent = {
  event: string;
  reason: string;
  details: Record<string, unknown>;
  at: string;
  actor: string | null;
};

export type PartnerCase = MyPartner & {
  user_id: string;
  /** Short-lived links (15 minutes) to open each document, by document id. */
  document_links: Record<string, string | null>;
  events: TrustEvent[];
};

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export function fetchPartnerQueue(filter: { kind?: PartnerKind; status?: PartnerStatus | "lapsed" } = {}) {
  const params = new URLSearchParams();
  if (filter.kind) params.set("kind", filter.kind);
  if (filter.status) params.set("status", filter.status);
  const query = params.toString();
  return apiRequest<PartnerQueueRow[]>(`/api/v1/admin/partners${query ? `?${query}` : ""}`);
}

export function fetchPartnerCase(id: string) {
  return apiRequest<PartnerCase>(`/api/v1/admin/partners/${id}`);
}

export function reviewPartnerDocument(documentId: string, decision: "verified" | "rejected", reason = "") {
  return apiRequest<PartnerCase>(`/api/v1/admin/partners/documents/${documentId}`, json("POST", { decision, reason }));
}

export function recordPartnerCheck(
  id: string,
  kind: "video_call" | "visit" | "recheck",
  notes: string,
  outcome: "ok" | "concern" = "ok",
) {
  return apiRequest<PartnerCase>(`/api/v1/admin/partners/${id}/checks`, json("POST", { kind, notes, outcome }));
}

export function decidePartner(id: string, decision: "approved" | "rejected" | "suspended", reason = "") {
  return apiRequest<PartnerCase>(`/api/v1/admin/partners/${id}`, json("POST", { decision, reason }));
}

export function fetchRecheckSample(kind: PartnerKind, percent = 10) {
  return apiRequest<{ id: string; display_name: string; slug: string; last_in_person: string | null }[]>(
    `/api/v1/admin/partners/recheck-sample?kind=${kind}&percent=${percent}`,
  );
}
