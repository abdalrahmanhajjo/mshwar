import { apiRequest } from "@/lib/api/client";

export type CommunicationPreferences = {
  transactional_email: boolean;
  marketing_email: boolean;
  marketing_in_app: boolean;
  unsubscribe_token?: string;
  locale?: string;
};

export type ConsentEvent = {
  id: string;
  purpose: string;
  granted: boolean;
  policy_version: string;
  created_at: string;
};

export type NotificationHealth = {
  outbox_depth: number;
  dead_letters: number;
  pending: number;
  max_attempts: number;
  backoff: string;
  channels: {
    channel: string;
    sent: number;
    failed: number;
    pending: number;
    suppressed: number;
    dead_lettered: number;
    delivery_rate: number;
    failure_rate: number;
  }[];
  recent_failures: {
    id: string;
    channel: string;
    event_type: string;
    status: string;
    attempts: number;
    last_error_code?: string | null;
    dead_lettered_at?: string | null;
  }[];
};

export type AdminNotificationRow = {
  id: string;
  channel: string;
  category: string;
  event_type: string;
  status: string;
  attempts: number;
  dead_lettered_at?: string | null;
  last_error_code?: string | null;
  deep_link?: string | null;
};

export type RoleNotificationPref = {
  role: string;
  event_type: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
};

export type OrgNotificationSettings = {
  escalation: { first_minutes: number; repeat_minutes: number; max: number };
  roles: RoleNotificationPref[];
};

const request = apiRequest;

export function fetchPreferences(): Promise<CommunicationPreferences> {
  return request("/api/v1/notifications/preferences");
}

export function savePreferences(payload: { marketing_email: boolean; marketing_in_app: boolean }) {
  return request<CommunicationPreferences>("/api/v1/notifications/preferences", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function fetchConsentHistory(): Promise<ConsentEvent[]> {
  return request("/api/v1/notifications/consent");
}

export function lookupUnsubscribe(token: string): Promise<{ marketing_email: boolean; email_domain?: string | null }> {
  return request(`/api/v1/notifications/unsubscribe/${token}`);
}

export function applyUnsubscribe(token: string): Promise<CommunicationPreferences> {
  return request(`/api/v1/notifications/unsubscribe/${token}`, { method: "POST" });
}

export function fetchNotificationHealth(): Promise<NotificationHealth> {
  return request("/api/v1/admin/notifications/health");
}

export function listAdminNotifications(status = ""): Promise<AdminNotificationRow[]> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
  return request(`/api/v1/admin/notifications${suffix}`);
}

export function resendNotification(id: string, reason: string): Promise<{ id: string; status: string }> {
  return request(`/api/v1/admin/notifications/${id}/resend`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function fetchOrgNotificationPrefs(orgId: string): Promise<OrgNotificationSettings> {
  return request(`/api/v1/portal/organizations/${orgId}/notification-preferences`, {
    headers: { "x-organization-id": orgId },
  });
}

export function saveRoleNotificationPref(
  orgId: string,
  payload: RoleNotificationPref,
): Promise<OrgNotificationSettings> {
  return request(`/api/v1/portal/organizations/${orgId}/notification-preferences`, {
    method: "PUT",
    headers: { "x-organization-id": orgId },
    body: JSON.stringify(payload),
  });
}

export function saveEscalation(
  orgId: string,
  payload: { first_minutes: number; repeat_minutes: number; max: number },
): Promise<OrgNotificationSettings> {
  return request(`/api/v1/portal/organizations/${orgId}/escalation`, {
    method: "PUT",
    headers: { "x-organization-id": orgId },
    body: JSON.stringify(payload),
  });
}

export function marketingOptOutNeverBlocksTransactional(prefs: CommunicationPreferences): boolean {
  return prefs.transactional_email === true;
}
