import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isProtectedPath, safeNextPath } from "@/lib/auth";
import { LOCALE_COOKIE, LOCALE_HEADER, parseLocale, splitLocalePrefix, withLocalePrefix } from "@/lib/locale";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { locale: prefixLocale, pathname: stripped } = splitLocalePrefix(pathname);
  const locale = prefixLocale ?? parseLocale(request.cookies.get(LOCALE_COOKIE)?.value);

  const requestHeaders = new Headers(request.headers);
  const correlation = crypto.randomUUID();
  requestHeaders.set("X-Request-ID", correlation);
  requestHeaders.set(LOCALE_HEADER, locale);

  function withLocaleCookie(response: NextResponse) {
    response.headers.set("X-Request-ID", correlation);
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  }

  if (isProtectedPath(stripped) && !request.cookies.get(SESSION_COOKIE)?.value) {
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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
