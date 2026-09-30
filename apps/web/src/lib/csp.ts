/**
 * The Content Security Policy for pages (security plan SEC-35 to SEC-37).
 *
 * `src/proxy.ts` mints a fresh nonce for every page request and sends this policy both to the
 * browser and to Next.js, which puts the nonce on its own scripts. Scripts without the nonce do
 * not run; `'strict-dynamic'` lets the nonced bootstrap load the page's chunks. Every page is
 * already rendered per request (the root layout reads the locale cookie), so nonces cost no
 * static rendering.
 *
 * Images may come only from this origin (map tiles are proxied at /map-tiles), ImageKit,
 * Wikimedia (catalogue photos with their licences) and Unsplash (destination heroes).
 */

export const CSP_REPORT_PATH = "/api/v1/security/csp-report";
export const CSP_REPORT_GROUP = "csp";

const IMAGE_HOSTS = ["https://ik.imagekit.io", "https://upload.wikimedia.org", "https://images.unsplash.com"];

function origin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export interface CspOptions {
  nonce: string;
  /** `next dev` needs eval for React's error overlays. */
  development?: boolean;
  /** NEXT_PUBLIC_SENTRY_DSN: the browser reports errors straight to Sentry's ingest host. */
  sentryDsn?: string;
  /** NEXT_PUBLIC_IMAGEKIT_URL: a custom ImageKit endpoint. */
  imagekitUrl?: string;
}

export function contentSecurityPolicy({ nonce, development = false, sentryDsn, imagekitUrl }: CspOptions): string {
  const images = ["'self'", "data:", "blob:", ...IMAGE_HOSTS, origin(imagekitUrl)];
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // React style attributes (and MapLibre's) cannot carry a nonce; styles cannot run code.
    "style-src 'self' 'unsafe-inline'",
    `img-src ${[...new Set(images.filter(Boolean))].join(" ")}`,
    "font-src 'self' data:",
    ["connect-src 'self'", origin(sentryDsn)].filter(Boolean).join(" "),
    // MapLibre draws on a web worker it creates from a blob.
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    // Turnstile, the optional human check on sign-up and password reset, runs in its own frame.
    "frame-src https://www.google.com https://challenges.cloudflare.com",
    `report-uri ${CSP_REPORT_PATH}`,
    `report-to ${CSP_REPORT_GROUP}`,
  ].join("; ");
}

/** The Reporting API endpoint named by `report-to` (sent as the Reporting-Endpoints header). */
export const REPORTING_ENDPOINTS = `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`;

export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
