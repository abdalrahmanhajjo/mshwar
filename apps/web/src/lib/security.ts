export const POLICY_VERSION = "2026-09-14";
export const COOKIE_CONSENT_KEY = "mshwar_cookie_consent";
export type CookieConsent = { essential: true; analytics: boolean; version: string };
export const ESSENTIAL_ONLY: CookieConsent = { essential: true, analytics: false, version: POLICY_VERSION };

export function readCookieConsent(): CookieConsent {
  if (typeof window === "undefined") return ESSENTIAL_ONLY;
  try {
    const value = JSON.parse(localStorage.getItem(COOKIE_CONSENT_KEY) ?? "null");
    return value?.version === POLICY_VERSION && value?.analytics === true
      ? { ...ESSENTIAL_ONLY, analytics: true }
      : ESSENTIAL_ONLY;
  } catch {
    return ESSENTIAL_ONLY;
  }
}

export function saveCookieConsent(analytics: boolean) {
  const value = { ...ESSENTIAL_ONLY, analytics };
  try { localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(value)); } catch { /* Essential-only without storage. */ }
  window.dispatchEvent(new CustomEvent("mshwar:consent", { detail: value }));
}

// Analytics integrations must call this before loading or emitting an optional event.
export function analyticsAllowed() { return readCookieConsent().analytics; }

export async function securityFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("X-Request-ID", crypto.randomUUID());
  return fetch(input, { ...init, headers });
}

const sensitive = /password|secret|token|authorization|cookie|signature|payment.?id|provider.?ref|email|phone|content.?base64|prompt|body|^data$/i;
export function scrubTelemetry(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubTelemetry);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitive.test(key) ? "[REDACTED]" : scrubTelemetry(item)]));
  if (typeof value === "string") return value
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:pi|pm|cus|ch|re|acct|evt|sk|pk)_[A-Za-z0-9_]+\b/g, "[REDACTED]")
    .replace(/([?&](?:token|key|code|signature|ik-s)=)[^&#\s]*/gi, "$1[REDACTED]")
    .replace(/(\/(?:files|join|unsubscribe)\/)[^/?\s]*/g, "$1[REDACTED]");
  return value;
}
export function sentryBeforeSend(event: Record<string, unknown>) {
  const clean = scrubTelemetry(event) as Record<string, unknown>;
  delete clean.user;
  delete clean.request;
  delete clean.extra;
  // Error messages and stack locals can contain unlabelled user input.
  delete clean.exception;
  return clean;
}
