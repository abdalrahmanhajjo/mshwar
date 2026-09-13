import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isProtectedPath, safeNextPath } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }
  if (request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = "/signin";
  url.search = "";
  url.searchParams.set("next", safeNextPath(`${pathname}${request.nextUrl.search}`));
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/plan",
    "/plan/:path*",
    "/saved",
    "/saved/:path*",
    "/bookings",
    "/bookings/:path*",
    "/business",
    "/business/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
