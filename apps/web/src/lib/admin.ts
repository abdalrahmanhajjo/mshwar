export type AdminTier = "ops" | "elevated";

export type AdminMe = {
  id: string;
  email?: string;
  display_name?: string;
  tier: AdminTier | null;
  elevated: boolean;
};

export type VerificationRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  verification: string;
  created_at?: string;
  submitted_at?: string | null;
  sla_hours?: number | null;
  document_count?: number;
  paused_experiences: number;
  published_experiences: number;
};

export type VerificationCase = {
  id: string;
  name: string;
  slug: string;
  status: string;
  verification: string;
  verified_badge: boolean;
  documents: {
    id: string;
    filename: string;
    content_type: string;
    signed_url?: string;
    public: boolean;
  }[];
  events: { id: string; decision: string; reason: string; created_at: string }[];
  submissions: { id: string; registration_details: Record<string, unknown>; created_at: string }[];
};

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, { ...init, credentials: "include", headers });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    if (typeof body.detail === "string") {
      return body.detail;
    }
  } catch {
    /* ignore */
  }
  return "request-failed";
}

export function fetchAdminMe(): Promise<AdminMe> {
  return adminFetch("/api/v1/admin/me");
}

export function listVerificationQueue(query = ""): Promise<VerificationRow[]> {
  return adminFetch(`/api/v1/admin/organizations${query}`);
}

export function getVerificationCase(orgId: string): Promise<VerificationCase> {
  return adminFetch(`/api/v1/admin/organizations/${orgId}`);
}

export function transitionVerification(
  orgId: string,
  action: "verify" | "reject" | "revoke" | "suspend" | "re-verify",
  reason: string,
): Promise<{ verification: string }> {
  return adminFetch(`/api/v1/admin/organizations/${orgId}/${action}`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function listModeration(entityType?: string): Promise<{
  listings: Record<string, unknown>[];
  images: Record<string, unknown>[];
  reviews: Record<string, unknown>[];
}> {
  const suffix = entityType ? `?entity_type=${encodeURIComponent(entityType)}` : "";
  return adminFetch(`/api/v1/admin/moderation${suffix}`);
}

export function moderateContent(
  entityType: string,
  entityId: string,
  action: string,
  reason: string,
): Promise<unknown> {
  return adminFetch(`/api/v1/admin/moderation/${entityType}/${entityId}`, {
    method: "POST",
    body: JSON.stringify({ action, reason }),
  });
}

export function bulkModerate(payload: {
  entity_type: string;
  ids: string[];
  action: string;
  reason: string;
  confirm: boolean;
}): Promise<unknown> {
  return adminFetch("/api/v1/admin/moderation/bulk", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listTaxonomy(): Promise<{ id: string; kind: string; slug: string; label: string; active: boolean }[]> {
  return adminFetch("/api/v1/admin/taxonomy");
}

export function createTaxonomy(payload: {
  kind: string;
  slug: string;
  label: string;
  reason: string;
}): Promise<unknown> {
  return adminFetch("/api/v1/admin/taxonomy", { method: "POST", body: JSON.stringify(payload) });
}

export function renameTaxonomy(id: string, label: string, reason: string): Promise<unknown> {
  return adminFetch(`/api/v1/admin/taxonomy/${id}/rename`, {
    method: "POST",
    body: JSON.stringify({ label, reason }),
  });
}

export function retireTaxonomy(id: string, reason: string): Promise<unknown> {
  return adminFetch(`/api/v1/admin/taxonomy/${id}/retire`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function mergeTaxonomy(id: string, targetId: string, reason: string): Promise<unknown> {
  return adminFetch(`/api/v1/admin/taxonomy/${id}/merge`, {
    method: "POST",
    body: JSON.stringify({ target_id: targetId, reason }),
  });
}

export function listAdminBookings(): Promise<{ id: string; status: string; experience_title: string }[]> {
  return adminFetch("/api/v1/admin/bookings");
}

export function inspectBooking(id: string): Promise<{
  id: string;
  status: string;
  price_snapshot: Record<string, unknown>;
  policy_snapshot: Record<string, unknown>;
  timeline: { to_status: string; reason: string | null; created_at: string }[];
  payments: { provider: string; external_id: string | null; status: string; amount_minor: number }[];
}> {
  return adminFetch(`/api/v1/admin/bookings/${id}`);
}

export function bookingAction(
  id: string,
  action: "force-cancel" | "mark-refunded" | "resend-confirmation",
  reason: string,
): Promise<unknown> {
  return adminFetch(`/api/v1/admin/bookings/${id}/${action}`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function listConfig(): Promise<{ key: string; version: number; value: Record<string, unknown> }[]> {
  return adminFetch("/api/v1/admin/config");
}

export function putConfig(key: string, value: Record<string, unknown>, reason: string): Promise<unknown> {
  return adminFetch("/api/v1/admin/config", {
    method: "PUT",
    body: JSON.stringify({ key, value, reason }),
  });
}

export function rollbackConfig(key: string, reason: string): Promise<unknown> {
  return adminFetch(`/api/v1/admin/config/${encodeURIComponent(key)}/rollback`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function listFlags(): Promise<{ key: string; environment: string; cohort: string; enabled: boolean }[]> {
  return adminFetch("/api/v1/admin/flags");
}

export function putFlag(payload: {
  key: string;
  environment: string;
  cohort: string;
  enabled: boolean;
  reason: string;
}): Promise<unknown> {
  return adminFetch("/api/v1/admin/flags", { method: "PUT", body: JSON.stringify({ ...payload, payload: {} }) });
}

export function fetchKpis(
  from?: string,
  to?: string,
): Promise<{
  metrics: Record<string, number>;
  definitions: { key: string; label: string; definition: string }[];
  planner_source: string;
}> {
  const params = new URLSearchParams();
  if (from) {
    params.set("from", from);
  }
  if (to) {
    params.set("to", to);
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return adminFetch(`/api/v1/admin/kpis${suffix}`);
}

export function listCases(status = ""): Promise<{ id: string; status: string; reason: string; age_hours: number }[]> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
  return adminFetch(`/api/v1/admin/cases${suffix}`);
}

export function createCase(reason: string, evidence: unknown[] = []): Promise<{ id: string }> {
  return adminFetch("/api/v1/admin/cases", {
    method: "POST",
    body: JSON.stringify({ reason, evidence }),
  });
}

export function assignCase(id: string, assigneeId: string, note = ""): Promise<unknown> {
  return adminFetch(`/api/v1/admin/cases/${id}/assign`, {
    method: "POST",
    body: JSON.stringify({ assignee_id: assigneeId, note }),
  });
}

export function escalateCase(id: string, note: string): Promise<unknown> {
  return adminFetch(`/api/v1/admin/cases/${id}/escalate`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export function resolveCase(id: string, outcome: string): Promise<unknown> {
  return adminFetch(`/api/v1/admin/cases/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ outcome }),
  });
}

export function listQuality(): Promise<{
  issues: { id: string; rule_code: string; status: string; details: Record<string, unknown> }[];
  scheduler: { enabled: boolean; trigger: string };
}> {
  return adminFetch("/api/v1/admin/quality");
}

export function runQuality(notify = true): Promise<unknown> {
  return adminFetch(`/api/v1/admin/quality/run?notify=${notify ? "true" : "false"}`, { method: "POST" });
}

export function notifyQuality(id: string): Promise<unknown> {
  return adminFetch(`/api/v1/admin/quality/${id}/notify`, { method: "POST" });
}

export function listRoles(): Promise<{ user_id: string; email: string; display_name: string; tier: string }[]> {
  return adminFetch("/api/v1/admin/roles");
}

export function grantRole(userId: string, tier: string): Promise<unknown> {
  return adminFetch("/api/v1/admin/roles", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, tier }),
  });
}

export function revokeRole(userId: string, reason: string): Promise<unknown> {
  return adminFetch(`/api/v1/admin/roles/${userId}/revoke`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function listAdminSessions(): Promise<
  { user_id: string; ip: string | null; duration_seconds: number; started_at: string }[]
> {
  return adminFetch("/api/v1/admin/sessions");
}

export function isAdminTier(value: string | null | undefined): value is AdminTier {
  return value === "ops" || value === "elevated";
}

export function isElevatedTier(value: string | null | undefined): boolean {
  return value === "elevated";
}

export const LIVE_SAFE_CONFIG_KEYS = ["marketplace.fees", "feature_flags"] as const;
