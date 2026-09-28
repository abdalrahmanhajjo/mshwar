import type { Destination, Experience } from "@/lib/catalog";
import type { Locale } from "@/lib/locale";
import { SITE_NAME, SITE_URL, siteUrl } from "@/lib/site";
import { absoluteImage } from "@/lib/seo/metadata";

/**
 * Schema.org builders. Rules that keep this honest (and within Google's guidelines):
 * only facts the page itself shows; no ratings without real review counts; no offers
 * for prices given "on request"; every URL absolute and in the page's own language.
 */

type Thing = Record<string, unknown>;

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export function organizationSchema(): Thing {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    alternateName: "مشوار",
    url: SITE_URL,
    logo: `${SITE_URL}/logo-512.png`,
    description: "A Lebanon travel discovery platform: destinations, places to visit and a day planner.",
    areaServed: { "@type": "Country", name: "Lebanon" },
  };
}

export function websiteSchema(): Thing {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    alternateName: ["مشوار", "Mshwar Lebanon"],
    url: SITE_URL,
    inLanguage: ["en", "ar", "fr"],
    publisher: { "@id": ORGANIZATION_ID },
    about: { "@type": "Country", name: "Lebanon" },
  };
}

export type Crumb = { name: string; path: string };

export function breadcrumbSchema(crumbs: Crumb[], locale: Locale): Thing {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: siteUrl(crumb.path, locale),
    })),
  };
}

export type Faq = { question: string; answer: string };

/** Only for questions answered visibly on the same page. */
export function faqSchema(faqs: Faq[]): Thing | null {
  if (!faqs.length) return null;
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

function placeRef(experience: Experience, locale: Locale): Thing {
  return {
    "@type": experience.kind === "restaurant" ? "Restaurant" : "TouristAttraction",
    name: experience.title,
    url: siteUrl(`/experiences/${experience.slug}`, locale),
    image: absoluteImage(experience.image),
  };
}

/** An ordered list of places, for listing and landing pages. */
export function itemListSchema(name: string, experiences: Experience[], locale: Locale): Thing | null {
  if (!experiences.length) return null;
  return {
    "@type": "ItemList",
    name,
    numberOfItems: experiences.length,
    itemListElement: experiences.map((experience, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: placeRef(experience, locale),
    })),
  };
}

export function destinationSchema(destination: Destination, experiences: Experience[], locale: Locale): Thing {
  const isRegion = destination.region === destination.name;
  return {
    "@type": ["TouristDestination", isRegion ? "AdministrativeArea" : "Place"],
    "@id": `${siteUrl(`/destinations/${destination.slug}`, locale)}#place`,
    name: destination.name,
    description: destination.blurb || undefined,
    url: siteUrl(`/destinations/${destination.slug}`, locale),
    image: absoluteImage(destination.image),
    containedInPlace: isRegion
      ? { "@type": "Country", name: "Lebanon" }
      : {
          "@type": "AdministrativeArea",
          name: destination.region,
          containedInPlace: { "@type": "Country", name: "Lebanon" },
        },
    includesAttraction: experiences.slice(0, 20).map((experience) => placeRef(experience, locale)),
  };
}

export function experienceSchema(experience: Experience, destination: Destination | undefined, locale: Locale): Thing {
  const [town] = experience.placeLabel.split(" · ");
  const images = [experience.image, ...(experience.gallery ?? [])]
    .map((image) => absoluteImage(image))
    .filter((image): image is string => Boolean(image));
  // A price is an offer only when it is published; "estimated" and "on request" are not.
  const offer =
    experience.priceLabel === "from" && experience.priceFrom > 0
      ? {
          "@type": "Offer",
          priceCurrency: "USD",
          price: experience.priceFrom,
          url: siteUrl(`/experiences/${experience.slug}`, locale),
        }
      : undefined;
  return {
    ...placeRef(experience, locale),
    "@id": `${siteUrl(`/experiences/${experience.slug}`, locale)}#place`,
    description: experience.summary || experience.body || undefined,
    image: images.length ? images : undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: town || undefined,
      addressRegion: destination?.region,
      addressCountry: "LB",
    },
    geo:
      typeof experience.lat === "number" && typeof experience.lng === "number"
        ? { "@type": "GeoCoordinates", latitude: experience.lat, longitude: experience.lng }
        : undefined,
    containedInPlace: destination
      ? {
          "@type": "TouristDestination",
          name: destination.name,
          url: siteUrl(`/destinations/${destination.slug}`, locale),
        }
      : undefined,
    offers: offer,
    publicAccess: experience.kind === "attraction" ? true : undefined,
  };
}

/** Wraps nodes into one graph document; null entries are dropped. */
export function graph(...nodes: (Thing | null | undefined)[]): Thing {
  return { "@context": "https://schema.org", "@graph": nodes.filter(Boolean) };
}
