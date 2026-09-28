import type { MetadataRoute } from "next";
import { LOCALES, withLocalePrefix } from "@/lib/locale";
import { PRIVATE_PATHS, SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Every private path, in each locale (/plan, /ar/plan, /fr/plan …), plus the API.
  const disallow = [
    "/api/",
    ...LOCALES.flatMap((locale) => PRIVATE_PATHS.map((path) => withLocalePrefix(locale, path))),
  ];
  return {
    rules: [
      {
        userAgent: "*",
        // The ride request form is public even though ride pages are not.
        allow: ["/", ...LOCALES.map((locale) => withLocalePrefix(locale, "/rides/new"))],
        disallow: [...new Set(disallow)],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
