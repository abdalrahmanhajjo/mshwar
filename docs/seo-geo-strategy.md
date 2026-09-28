# Mshwar organic growth: SEO and GEO strategy

Owner: growth / web. Last reviewed: September 2026. Applies to `apps/web`.

Goal: when someone asks Google, an AI assistant or a friend "what should I do in Lebanon?",
Mshwar is the source they land on, quote or recommend. This document is the audit, the
architecture and the plan. The code that implements the first phase ships with it
(`src/lib/seo/*`, `src/components/seo/*`, the new pages listed in §10).

Principle that overrides every tactic below: **facts come from the catalogue, never from copy
or the AI**. Mshwar's advantage over generic travel blogs is that every place is real, sourced,
located and timed. Every SEO surface must expose that data, not dilute it with invented text,
fake reviews or schema the page cannot back up.

---

## 1. Audit (before this work)

Scored against what Google and answer engines need from a travel marketplace, from reading
the code, the catalogue model and the rendered pages.

| Area                | Before | After phase 1 | Why                                                                                                                                                                                                                                                                  |
| ------------------- | ------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Technical SEO       | 28/100 | 78/100        | No sitemap, robots, canonical or hreflang; metadata hand-written per page with no base URL. Now one builder emits canonical, hreflang (+x-default), Open Graph and Twitter for every public page; sitemap and robots are generated.                                  |
| Content             | 35/100 | 55/100        | Real, sourced places (a strength) but thin hub pages, slogan H1s and titles ("Where will you wander?"), no question-and-answer content. Now: a pillar guide, six landing pages, data-derived FAQs on destinations. Still needs editorial depth per destination (§7). |
| Authority (E-E-A-T) | 15/100 | 30/100        | New domain, no About, no named people, no backlinks. About page and Organization entity now exist; authority itself only comes from §14 and §21 over months.                                                                                                         |
| AI visibility (GEO) | 10/100 | 55/100        | Nothing machine-readable beyond one flawed JSON-LD block. Now: entity graph, direct-answer paragraphs, visible FAQ + FAQPage, `llms.txt`, clean semantic headings.                                                                                                   |
| Local SEO           | 20/100 | 45/100        | Destinations had no hierarchy (region ↔ town) visible to crawlers. Now breadcrumbs and schema nest town → governorate → Lebanon, and each destination links its neighbours. Google Business Profile and citations are off-site actions (§12).                        |
| Performance         | 70/100 | 72/100        | Already good: self-hosted variable fonts, `srcset` + lazy images, LCP image `fetchpriority=high`. Remaining: the root layout reads cookies so every page is dynamic (no static caching), and no image CDN is configured yet.                                         |

### Top 50 problems, by impact

**High impact** (fixed in this PR unless marked ⏳)

1. No `sitemap.xml` — crawlers had to discover every destination by links alone.
2. No `robots.txt` — admin, account, portal and one-time email pages were crawlable.
3. No canonical URLs — filter and pagination variants of `/experiences` competed with the page.
4. No hreflang — Arabic and French pages could be treated as duplicates of English.
5. `/ar` and `/fr` pages carried English titles and descriptions.
6. No `metadataBase` — relative Open Graph/Twitter URLs, broken link previews.
7. Experience JSON-LD used a relative URL, invalid for Google.
8. Experience JSON-LD published an `Offer` with price 0 for "on request" prices (a false price).
9. Experience JSON-LD claimed `PreOrder` availability for unknown availability.
10. Experience JSON-LD put "Byblos · Mount Lebanon" in `addressLocality`.
11. No WebSite/Organization entity — Google cannot show "Mshwar" as the site name.
12. No breadcrumbs — no hierarchy for destinations (town → governorate) or places.
13. Destination pages had no answer content ("what is there to do in X?").
14. Category browsing lived only at `/experiences?category=…` (query-string URLs, not landing pages).
15. No pillar page for the head term "Lebanon travel guide / things to do in Lebanon".
16. Slogan titles ("Experiences — A whole country. Your next discovery.") carried no search intent.
17. Six public pages had no title or description at all.
18. No About page or named owner — a trust gap for Google and for travellers.
19. No machine-readable site summary for AI assistants (`llms.txt`).
20. ⏳ Destination pages lack editorial depth: history, best season, how to get there, map (§7).
21. ⏳ No Google Search Console property or sitemap submission (§19).
22. ⏳ No analytics, so organic conversion is invisible (§19).
23. ⏳ No backlinks; the domain is new (§21).
24. ⏳ No Google Business Profile for Mshwar the company (§12).
25. ⏳ Destination H1s are brand lines ("Byblos, at your own pace.") rather than the topic; kept for brand, the title tag now carries the intent.

**Medium impact**

26. Destination pages didn't link to neighbouring destinations — orphan-prone town pages. (fixed)
27. Homepage mood tiles linked to query URLs instead of indexable pages. (fixed)
28. Footer didn't link the guide, things-to-do or About. (fixed)
29. The `destination` blurb is the only description; many are one sentence. ⏳
30. Listing descriptions sometimes reuse the long `body`; snippets were cut mid-word. (fixed: `snippet()`)
31. No Open Graph images on destinations/places — poor sharing on WhatsApp, the main channel in Lebanon. (fixed)
32. Empty landing pages would be indexable thin content. (fixed: `noindex` when empty)
33. `/rides/new` was `noindex` but would have been listed in a sitemap. (fixed)
34. Paginated `/experiences?page=N` all canonicalise to page 1 — acceptable now; revisit when the catalogue passes ~500 places (§10).
35. Every page renders dynamically because the root layout reads cookies — no CDN caching of HTML. ⏳
36. Unprefixed URLs render in the cookie's language for returning visitors; crawlers (no cookie) always get English, and canonicals use the URL's own language, so this is safe for search — but keep it that way (§11).
37. No image sitemap / image licensing data. ⏳ (§15)
38. `alt=""` on decorative tiles is correct; place photos use `imageAlt` from the catalogue — audit that the catalogue fills it. ⏳
39. No author/expert profiles for guides as Person entities. ⏳ (§14)
40. No seasonal or audience pages (summer, winter, families, couples). ⏳ (§6)

**Low impact**

41. `Host:` directive not needed in robots (dropped).
42. No `x-default` hreflang. (fixed)
43. No Twitter card. (fixed)
44. Arabic URLs are Latin slugs — fine; do not transliterate (§11).
45. Legal pages lacked descriptions. (fixed)
46. No `CollectionPage` semantics on hub pages. (fixed)
47. `/discover`, `/ideas` and `/collections` overlap in intent. ⏳ consolidate (§3).
48. No RSS/Atom for future articles. ⏳
49. Organization logo is SVG; add a 512×512 PNG for Google's logo guidelines. ⏳
50. No 404 monitoring for removed catalogue slugs (redirects when places merge). ⏳

---

## 2. Entity model (what search engines should understand)

```
Mshwar (Organization, WebSite, alternateName مشوار)
  └─ about → Lebanon (Country)
       └─ Governorates (TouristDestination + AdministrativeArea): /destinations/{region}
            └─ Towns (TouristDestination + Place): /destinations/{town}
                 └─ Places (TouristAttraction | Restaurant): /experiences/{slug}
                      └─ geo, address, image, offer (only when published)
  └─ Ways of travelling (CollectionPage): /things-to-do/{nature|coast|culture|adventure|city|food}
  └─ Guide (Article): /lebanon
  └─ Local guides (Person, future): /guides/{slug}
```

Implemented in `src/lib/seo/schema.ts`: `organizationSchema`, `websiteSchema`,
`destinationSchema` (nests town → region → country), `experienceSchema`, `breadcrumbSchema`,
`itemListSchema`, `faqSchema`, joined with `graph()` and rendered by `<JsonLd>`.

Deliberately **not** used: `AggregateRating`/`Review` (no review counts published yet),
`Product` (places are not products), `TravelAgency` (Mshwar does not sell packages),
`LocalBusiness` for Mshwar itself (no public premises). Adding them without backing data is
the fastest way to a manual action.

---

## 3. Information architecture

Evaluated the proposed structure against the existing app:

| Proposed                                | Decision                                                | Why                                                                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/destinations`, `/destinations/{slug}` | Keep                                                    | Already the destination system; now with hierarchy, FAQ, neighbours.                                                                                                    |
| `/experiences/{hiking,food,…}`          | **Changed** to `/things-to-do/{slug}`                   | `/experiences/{slug}` is already the place detail URL; category slugs there would collide with place slugs. "Things to do" is also the head search phrase.              |
| `/guides/{article}`                     | **Changed** to `/lebanon` (+ future `/lebanon/{topic}`) | `/guides` is the local-guide directory (people). Editorial lives under the country: `/lebanon`, `/lebanon/7-day-itinerary`, `/lebanon/summer`.                          |
| `/trips`                                | Keep private                                            | Trips are personal; noindex + robots-disallowed. Shareable public itineraries become `/collections/{slug}`.                                                             |
| `/en/` prefix                           | **Not added**                                           | English is served unprefixed (`/`), Arabic at `/ar/`, French at `/fr/`, with hreflang + x-default. Adding `/en/` would redirect every existing URL for no ranking gain. |

Every indexable URL and its job:

| URL                    | Search intent                                            | Unique value                                     | Converts to                     |
| ---------------------- | -------------------------------------------------------- | ------------------------------------------------ | ------------------------------- |
| `/`                    | Brand, "Lebanon travel app"                              | Entry point, search                              | Search, plan                    |
| `/lebanon`             | "Lebanon travel guide", "places to visit in Lebanon"     | Direct answer, every region, ways to travel, FAQ | Destination, things-to-do, plan |
| `/things-to-do`        | "things to do in Lebanon"                                | Six ways to spend a day, counts                  | Category pages                  |
| `/things-to-do/{kind}` | "hiking/beaches/historical sites/restaurants in Lebanon" | Real places, where to go, FAQ                    | Place pages, plan               |
| `/destinations`        | "Lebanon regions/towns to visit"                         | Every destination                                | Destination pages               |
| `/destinations/{slug}` | "things to do in Byblos", "Byblos travel"                | Places there, region, neighbours, FAQ            | Place pages, plan               |
| `/experiences`         | Browsing/filtering                                       | Filters, map                                     | Place pages                     |
| `/experiences/{slug}`  | "Baalbek temples opening hours/price"                    | Facts, hours, price, map, source                 | Save, plan, book/enquire        |
| `/collections/{slug}`  | "Byblos day trip", "one day in Batroun"                  | A ready-made day                                 | Plan (adapt)                    |
| `/about`               | Brand trust                                              | Who, how data works                              | Contact                         |

Consolidation to do (⏳): `/discover` and `/ideas` overlap with `/things-to-do` and
`/collections`. Keep `/collections` for ready-made days; 301 `/ideas` → `/collections` and fold
`/discover` into `/things-to-do` once analytics shows their traffic.

---

## 4. Keyword universe (clusters → URLs)

Volumes are not quoted here: pull them from Search Console once it has 28 days of data and
from Google Keyword Planner for Lebanon + top diaspora markets (US, Canada, France, Australia,
UAE, Germany). Priority reflects intent fit and competition.

| Cluster      | Examples                                                                    | Intent                   | Target URL                                                     | Priority        |
| ------------ | --------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------- | --------------- |
| Head         | Lebanon travel, Lebanon tourism, visit Lebanon, Lebanon travel guide        | Informational            | `/lebanon`                                                     | A               |
| Things to do | things to do in Lebanon, places to visit in Lebanon, what to do in Lebanon  | Informational/commercial | `/things-to-do`, `/lebanon`                                    | A               |
| Destination  | things to do in Byblos/Batroun/Beirut, Qadisha Valley, Baalbek temples      | Informational/local      | `/destinations/{slug}`                                         | A               |
| Place        | Baalbek temples opening hours, Jeita Grotto tickets, Cedars of God          | Transactional/local      | `/experiences/{slug}`                                          | A               |
| Activity     | hiking in Lebanon, best hikes Lebanon, Lebanon beaches, wineries in Lebanon | Commercial               | `/things-to-do/{kind}` (+ future sub-pages)                    | A/B             |
| Itinerary    | Lebanon itinerary 7 days, 3 days in Lebanon, day trips from Beirut          | Informational            | `/lebanon/{n}-day-itinerary`, `/collections/{slug}`            | B               |
| Seasonal     | Lebanon in summer, winter in Lebanon, skiing Lebanon                        | Informational            | `/lebanon/{season}`                                            | B               |
| Audience     | Lebanon for families, romantic places Lebanon, diaspora visiting Lebanon    | Informational            | `/lebanon/{audience}`                                          | B               |
| Food         | Lebanese food tour, where to eat in Batroun, best restaurants Byblos        | Commercial/local         | `/things-to-do/food`, destination pages                        | B               |
| Hidden gems  | hidden villages Lebanon, off the beaten path Lebanon                        | Informational            | `/lebanon/hidden-gems` (built from low-traffic sourced places) | C               |
| Arabic       | أماكن سياحية في لبنان، ماذا أفعل في جبيل، رحلات نهاية الأسبوع من بيروت      | Informational/local      | `/ar/…` equivalents                                            | A for residents |
| French       | que faire au Liban, visiter Byblos, randonnée Liban                         | Informational            | `/fr/…` equivalents                                            | B               |

Arabic is written for **residents' weekend intent** ("وين نروح نهار الأحد") and French/English for
**visitor and diaspora intent**; titles in `src/lib/seo-copy.ts` follow that split.

---

## 5. GEO: being the source AI engines quote

What answer engines reward, and where Mshwar now provides it:

- **A direct answer first.** `/lebanon` opens with one quotable paragraph built from live counts.
  Destination and category pages answer "where is it / what is there / how do I plan it" in
  visible FAQ blocks.
- **Structured, consistent entities.** The same names, hierarchy and URLs appear in HTML,
  JSON-LD, the sitemap and `llms.txt`.
- **Verifiable facts.** Coordinates, addresses, source attributions, published prices.
  Answer engines prefer sources that state where facts come from; the About page says so.
- **`/llms.txt`**: a plain-language map of the site, its sourcing rules and every destination,
  regenerated from the catalogue. AI crawlers (GPTBot, ClaudeBot, PerplexityBot,
  Google-Extended) are allowed by `robots.txt`.

Questions to own next (each becomes a section or page with a direct answer, sourced facts and
links to places): "How many days do I need in Lebanon?", "What should I do in Beirut?",
"Where can I hike in Lebanon?", "Best Lebanon itinerary", "Hidden gems in Lebanon". Answers
must cite Mshwar's own data (drive times, opening hours, counts) — that is what makes them
quotable and not generic.

---

## 6. Programmatic SEO system

Templates that scale with the catalogue, each with a thin-content guard:

| Template              | URL                           | Built from                                  | Guard                                       |
| --------------------- | ----------------------------- | ------------------------------------------- | ------------------------------------------- |
| Destination           | `/destinations/{slug}`        | destination + its places + neighbours       | FAQ only includes answers the data supports |
| Kind of day           | `/things-to-do/{kind}`        | category/kind filter                        | `noindex` when empty                        |
| Destination × kind ⏳ | `/destinations/{slug}/{kind}` | intersection                                | index only with ≥ 4 places                  |
| Season ⏳             | `/lebanon/{season}`           | places with seasonal tags/opening           | needs season data in catalogue first        |
| Audience ⏳           | `/lebanon/{families           | couples                                     | …}`                                         | places tagged by suitability | needs suitability tags first |
| Itinerary ⏳          | `/collections/{slug}`         | planner output saved as a public collection | human-reviewed before indexing              |

Rule: a template page ships only when the catalogue has the field that makes it true.
"Lebanon for families" needs a `family_friendly` fact per place first — add it to the
catalogue (and the admin editor) before the page.

---

## 7. Destination page framework

Each `/destinations/{slug}` should become the best page online for that place. Today it has:
hero, blurb, tags, plan box, places, local services, neighbours, FAQ, breadcrumbs, schema.

To add, in this order (each needs a catalogue field, not free text in the web app):

1. **Overview (150–300 words)** written by a person, stored per locale on the destination.
2. **Getting there**: drive time from Beirut (the router already computes it), public transport notes.
3. **Best time to visit**: month range + why (weather already comes from Open-Meteo).
4. **Map** of its places (the map component exists on `/experiences`).
5. **History / why visit**: 2–3 short sourced paragraphs.
6. **Photos** with credits (image licensing data, §15).
7. **Reviews** once verified-booking reviews exist (never before).

---

## 8. Place (experience) page framework

Already strong on facts: category, place, hours, distance from Beirut, price label, booking
mode, facts, policies, gallery, contributors, related places, sources. Schema now reflects
only what is shown. Next:

- Duration, difficulty and "who it suits" as structured facts (catalogue fields), then
  surfaced in the page and in `experienceSchema`.
- Meeting point / entrance coordinates (the `geo` is already emitted when present).
- "What to bring" and seasonal notes per place.
- FAQ from real facts ("Is it open on Sundays?" from opening hours).

---

## 9. Structured data inventory

| Page                   | Types                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| Home                   | WebSite, Organization                                                                                     |
| `/lebanon`             | Article, BreadcrumbList, FAQPage                                                                          |
| `/things-to-do`        | CollectionPage, BreadcrumbList                                                                            |
| `/things-to-do/{kind}` | ItemList (TouristAttraction/Restaurant), BreadcrumbList, FAQPage                                          |
| `/destinations/{slug}` | TouristDestination (+Place/AdministrativeArea), BreadcrumbList, FAQPage                                   |
| `/experiences/{slug}`  | TouristAttraction or Restaurant (geo, address, containedInPlace, Offer only if published), BreadcrumbList |
| `/about`               | Organization, AboutPage, BreadcrumbList                                                                   |

Validate after each deploy with Google's Rich Results Test and the Schema.org validator on one
URL per template. Note: Google shows FAQ rich results only for government/health sites since
2023; FAQPage is kept because answer engines still read it and the content is visible.

---

## 10. Technical SEO (implemented)

- `src/lib/seo/metadata.ts` — `buildMetadata({ title, description, path, image, noindex })`:
  self-referencing canonical in the URL's own language, hreflang for en/ar/fr + x-default,
  Open Graph (locale-aware), Twitter card, word-safe snippets.
- `src/proxy.ts` — sets `x-mshwar-path-locale` from the URL prefix only, so canonicals never
  follow a visitor's cookie.
- `src/app/sitemap.ts` — sections in nav order, every destination, place and collection, per
  locale with alternates; refreshed every 10 minutes; sample data never listed.
- `src/app/robots.ts` — private, account, portal and one-time pages disallowed in every locale.
- `src/app/llms.txt/route.ts` — AI-readable site map.
- Breadcrumbs: visible (`<Breadcrumbs>`) and in data (`breadcrumbSchema`) from the same list.
- Filters and pagination: `/experiences?…` canonicalises to `/experiences`; landing pages give
  the important filters their own clean URLs.

Next (⏳): static caching for public pages (move the cookie read out of the root layout so
catalogue pages can be ISR), 301 map for renamed slugs, image sitemap.

---

## 11. International SEO

- English unprefixed, Arabic `/ar/…`, French `/fr/…`; `<html lang dir>` set per request.
- hreflang on every page and in the sitemap; x-default → English.
- Titles and descriptions for the main hubs are written per language in `seo-copy.ts`, not
  machine-translated at runtime.
- Keep slugs Latin in every language (shareable, stable); translate the page, not the URL.
- Never auto-redirect crawlers by `Accept-Language`; the current proxy does not.

## 12. Local SEO (off-site actions for the team)

1. Google Business Profile for Mshwar (service-area business, Lebanon), linking to the site.
2. Consistent name/URL/contact across: Google, Apple Business Connect, Bing Places, Facebook,
   Instagram, LinkedIn, and Lebanese directories (e.g. the Ministry of Tourism listings where
   possible, chambers of commerce, university startup pages).
3. Ask partner venues, guides and drivers to link to their Mshwar page ("Find us on Mshwar"
   badge) — the most natural local backlinks available.
4. Region authority: a named local contributor per governorate (Beirut, Mount Lebanon, North,
   Keserwan-Jbeil, Akkar, Bekaa, Baalbek-Hermel, South, Nabatieh) credited on the destination pages.

## 13. Content engine (12 months)

| Months | Pillar                          | Supporting pieces                                                         | Converts to       |
| ------ | ------------------------------- | ------------------------------------------------------------------------- | ----------------- |
| 1–2    | `/lebanon` (done)               | 3-, 5-, 7-day itineraries built in the planner                            | Plan a trip       |
| 2–3    | Hiking (`/things-to-do/nature`) | Qadisha, Chouf cedars, Lebanon Mountain Trail sections                    | Places, save      |
| 3–4    | Coast & summer                  | Batroun, Byblos, Tyre; summer weekends from Beirut                        | Places, plan      |
| 4–5    | Food                            | Where to eat by town; Lebanese breakfast; wineries in the Bekaa           | Restaurants, plan |
| 5–6    | Culture                         | Baalbek, Byblos, Tripoli souks, Beiteddine                                | Places, guides    |
| 6–8    | Seasons                         | Winter (skiing, Faraya/Cedars), spring flowers, autumn harvest            | Places            |
| 8–10   | Audiences                       | Families, couples, diaspora "first trip back", accessible Lebanon         | Plan              |
| 10–12  | Data reports                    | "Lebanon travel report 2027" from planner demand (aggregated, anonymised) | Links, PR         |

Every article: one search intent, a direct answer in the first paragraph, links to ≥ 5 real
places and 2 destinations, a plan CTA, Article + BreadcrumbList schema, a named author with a
profile, and a "last checked" date. Store articles in the database (per locale) so the same
template, sitemap and `llms.txt` pick them up.

## 14. E-E-A-T

Done: About page (who, what, how data works), Organization entity. Next: founder story with a
photo, profiles for local guides as `Person` (the guide directory already has the data),
"checked by" and "last verified" dates on places, photography credits per image, a public
corrections address.

## 15. Images

Done: responsive `srcset`, lazy loading, LCP priority, OG images. Next: store photographer and
licence per image (needed for credits and `ImageObject`), descriptive filenames at upload,
AVIF/WebP via ImageKit when configured, an image sitemap from the same data.

## 16. Performance

Good today: self-hosted variable fonts with `display: swap`, no third-party scripts before
consent, width-based `srcset`. Next: serve catalogue pages statically with revalidation (see
§10), set `Cache-Control` for images through the CDN, measure field Core Web Vitals in Search
Console before optimising further.

## 17. Internal linking (implemented)

Home → mood tiles → `/things-to-do/{kind}` → places and destinations. Footer → `/lebanon`,
`/things-to-do`, `/about` on every page. `/lebanon` → every region and town. Destination →
its places + neighbouring destinations + parent region (breadcrumb). Place → its destination
(breadcrumb) + related places. No public page is more than three clicks from home.

## 18. Conversion

Every search landing page ends in a plan CTA; places have "Plan a day here" and save. Next:
"Save this place" prompts sign-up with the place pre-selected; landing pages show "Add all to a
plan"; measure each step (§19).

## 19. Analytics (to set up)

1. **Search Console**: Domain property `mshwarlb.com` (TXT record in Cloudflare), submit
   `sitemap.xml`, watch Pages → Indexing and the Performance report by page type.
2. **GA4 or Plausible**, loaded only after analytics consent (the cookie banner already has the
   category). Events: `view_place`, `view_destination`, `save_place`, `start_plan`,
   `plan_saved`, `sign_up`, `login`, `booking_intent`, each with `landing_page_type`.
3. Dashboard: organic sessions by template → save/plan/sign-up rate by template.

## 20. AI crawler readiness (implemented)

Semantic HTML (one H1, ordered H2/H3), visible answers, entity JSON-LD, `llms.txt`, clean
URLs, no content hidden behind JavaScript for the key facts (pages are server-rendered).

## 21. Authority and backlinks

- Linkable assets: the Lebanon travel guide, an interactive map of every sourced place,
  a yearly "Lebanon travel report" from anonymised planner demand, open data credits back to
  OpenStreetMap contributors.
- Partners: UNRWA Digital Hub, Lebanese universities (student projects, tourism faculties),
  municipalities and tourism offices, guesthouses and guides listed on Mshwar.
- Digital PR: "the first Lebanon planner that never invents a price", diaspora summer guides
  pitched to Lebanese diaspora media, a weekend-ideas newsletter for residents.
- Avoid: paid link packages, directory spam, AI-written guest posts.

## 22. Roadmap

| When        | Work                                                                                                            |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| Week 1      | Deploy; Search Console + sitemap; request indexing for `/`, `/lebanon`, `/things-to-do`; GBP profile            |
| Weeks 2–4   | Destination overview fields (§7) and write the top 10 destinations in en + ar; PNG logo; analytics with consent |
| Month 2     | Itinerary pages from the planner; `/ideas` → `/collections`; static caching for public pages                    |
| Month 3     | Place facts: duration, difficulty, suits, season; destination × kind pages where ≥ 4 places                     |
| Months 4–6  | Content engine rows 3–6; guide profiles as Person; partner badge programme                                      |
| Months 6–12 | Seasonal and audience pages; yearly report; review system for verified bookings (then AggregateRating)          |

## Final review of phase 1

- _Would Google understand every page?_ Yes for templates shipped here: one topic per URL,
  canonical, language alternates, breadcrumbs and entity data.
- _Could Mshwar rank?_ For long-tail destination and place queries, yes, once indexed. For
  head terms ("Lebanon travel") it needs authority (§21) and destination depth (§7) — months,
  not a deploy.
- _Would an AI assistant recommend it?_ It can now read what Mshwar is, how its facts are
  sourced and where each destination lives; being cited depends on the same authority work.
- _Weakest point_: editorial depth per destination and zero backlinks. Both are content and
  partnership work that code cannot replace.
