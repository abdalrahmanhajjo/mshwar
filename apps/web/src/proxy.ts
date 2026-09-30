import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIES, isProtectedPath, safeNextPath } from "@/lib/auth";
import { REPORTING_ENDPOINTS, contentSecurityPolicy, newNonce } from "@/lib/csp";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  PATH_LOCALE_HEADER,
  parseLocale,
  splitLocalePrefix,
  withLocalePrefix,
} from "@/lib/locale";
import { REQUEST_ID_HEADER, newRequestId } from "@/lib/request-id";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Minted here, never taken from the browser, and forwarded to the API through the rewrite.
  const requestId = newRequestId();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }

  // Pages get a fresh nonce; Next.js reads it from the request's policy and puts it on its scripts.
  const csp =
    process.env.NODE_ENV === "production"
      ? contentSecurityPolicy({
          nonce: newNonce(),
          sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
          imagekitUrl: process.env.NEXT_PUBLIC_IMAGEKIT_URL,
        })
      : null;
  if (csp) requestHeaders.set("Content-Security-Policy", csp);

  const { locale: prefixLocale, pathname: stripped } = splitLocalePrefix(pathname);
  const locale = prefixLocale ?? parseLocale(request.cookies.get(LOCALE_COOKIE)?.value);
  requestHeaders.set(LOCALE_HEADER, locale);
  requestHeaders.set(PATH_LOCALE_HEADER, prefixLocale ?? DEFAULT_LOCALE);

  function withLocaleCookie(response: NextResponse) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    response.headers.set(REQUEST_ID_HEADER, requestId);
    if (csp) {
      response.headers.set("Content-Security-Policy", csp);
      response.headers.set("Reporting-Endpoints", REPORTING_ENDPOINTS);
    }
    return response;
  }

  const signedIn = SESSION_COOKIES.some((name) => Boolean(request.cookies.get(name)?.value));
  if (isProtectedPath(stripped) && !signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = withLocalePrefix(locale, "/signin");
    url.search = "";
    url.searchParams.set("next", safeNextPath(`${pathname}${request.nextUrl.search}`));
    return withLocaleCookie(NextResponse.redirect(url));
  }

  if (prefixLocale) {
    const url = request.nextUrl.clone();
    url.pathname = stripped;
    return withLocaleCookie(NextResponse.rewrite(url, { request: { headers: requestHeaders } }));
  }

  return withLocaleCookie(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  matcher: ["/api/:path*", "/((?!api|map-tiles|map-route|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
