/**
 * Build-time switches. Each is off unless the environment turns it on, so a
 * deploy that forgets a variable gets the product as launched, not a half-hidden one.
 */

/** The business portal, hidden while Mshwar's supply side is guides (see the guide product spec). */
export function businessPortalEnabled(): boolean {
  return process.env.NEXT_PUBLIC_BUSINESS_PORTAL === "true";
}
