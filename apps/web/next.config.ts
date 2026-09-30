import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const isProduction = process.env.NODE_ENV === "production";

// The Content Security Policy is set per request with a nonce in src/proxy.ts (src/lib/csp.ts).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), geolocation=(self)" },
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    return [
      // OpenFreeMap (OpenStreetMap vector tiles, no key) served from our origin: browsers never
      // contact a third party for a map, so maps need no cookie choice (see src/lib/maplibre.ts).
      {
        source: "/map-tiles/:path*",
        destination: "https://tiles.openfreemap.org/:path*",
      },
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
