/**
 * Links built from data (security plan SEC-38). A stored address is only ever used as a link
 * when it is plain http(s): `javascript:`, `data:` and anything unparseable render as text.
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  return url.href;
}

/** The host of a link for display, or the text itself when it is not a safe address. */
export function linkHost(value: string): string {
  const safe = safeHttpUrl(value);
  return safe ? new URL(safe).hostname : value;
}
