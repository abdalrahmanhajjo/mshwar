import { apiRequest } from "@/lib/api/client";

/** Sign-in and security settings (security plan SEC-22, SEC-24, SEC-25). */

export type AccountSession = {
  id: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  user_agent: string;
  current: boolean;
};

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export function fetchSessions() {
  return apiRequest<AccountSession[]>("/api/v1/auth/sessions");
}

export function endSession(id: string) {
  return apiRequest<{ revoked: number }>(`/api/v1/auth/sessions/${id}`, send("DELETE"));
}

export function endOtherSessions() {
  return apiRequest<{ revoked: number }>("/api/v1/auth/sessions/revoke-others", send("POST"));
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiRequest<{ changed: boolean; sessions_revoked: number }>(
    "/api/v1/auth/password",
    send("POST", { current_password: currentPassword, new_password: newPassword }),
  );
}

export function requestEmailChange(newEmail: string, password: string) {
  return apiRequest<{ sent_to: string }>("/api/v1/auth/email", send("POST", { new_email: newEmail, password }));
}

export function confirmEmailChange(token: string) {
  return apiRequest<{ email: string }>("/api/v1/auth/email/confirm", send("POST", { token }));
}

/** "Chrome on macOS" from a user-agent string, or null when it cannot be read. */
export function describeDevice(userAgent: string): string | null {
  const ua = userAgent || "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : null;
  const system = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  if (browser && system) return `${browser} · ${system}`;
  return browser ?? system;
}
