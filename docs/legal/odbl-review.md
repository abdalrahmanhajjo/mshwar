# OpenStreetMap data (ODbL): legal review

**Status:** waiting for counsel. Until it is approved, no listing whose name or location was copied
from OpenStreetMap should be published (`docs/places-import.md`, section 4).

This page is the packet for counsel: what we do with OpenStreetMap data, what the licence says as we
understand it, and the questions only counsel can answer. It is not legal advice.

## What Mshwar does with the data

| Step                  | What happens                                                                                             | Who sees it          |
| --------------------- | -------------------------------------------------------------------------------------------------------- | -------------------- |
| Download              | Staff run an Overpass query for named places in Lebanon (about 70 kinds: restaurants, museums, beaches…) | Staff                |
| Import as leads       | Name (en/ar/fr), point, OSM id and the raw tags are stored in `app.place_leads`                          | Staff only           |
| Deduplicate and queue | Leads are compared with each other and with our own listings; the queue is ordered by unmet demand       | Staff only           |
| Check                 | A person visits or calls the place                                                                       | Staff only           |
| Publish               | A listing is created. **Today it copies the lead's name, Arabic and French names, and point**            | Travellers, publicly |
| Credit                | The listing shows "© OpenStreetMap contributors (ODbL-1.0)" linking to the record and the licence        | Travellers           |

Leads are never shown to travellers and never used by the planner. Our own facts (description,
hours, prices, place facts, trust checks) are written by staff and owners.

## The licence, as we understand it

- **Attribution.** Public use of OpenStreetMap data, or of a work produced from it, must credit
  "© OpenStreetMap contributors" and point to the licence. We do this on each listing page.
- **Internal use is not public use.** Holding leads, deduplicating and queueing them for staff is
  internal.
- **Share-alike for derivative databases.** A database adapted from OpenStreetMap that is used
  publicly must be offered under the ODbL. The share-alike covers the OpenStreetMap-derived part.
- **Collective databases.** Where OpenStreetMap data sits next to independent data as a separate,
  independent layer, share-alike is understood to apply only to the OpenStreetMap layer. The
  OpenStreetMap Foundation publishes community guidelines on this: collective database,
  substantial extract, horizontal layers, trivial transformations. Counsel should check them.
- **Wikidata** is CC0: no conditions. **Official lists** depend on their own terms.

## Options

| Option                                                                                                                                                               | Effect                                                                                | Cost                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------- |
| **A. Leads only.** OpenStreetMap only tells staff where to go. The published name comes from the signage and the point is re-captured on site, so nothing is copied. | No OpenStreetMap data in the published catalogue (to confirm with counsel).           | A GPS capture step on the field sheet       |
| **B. A separate OpenStreetMap layer.** Keep the copied name and point of OpenStreetMap-origin listings as a separable layer, and offer that layer under the ODbL.    | Share-alike limited to that layer (to confirm); the rest of the catalogue stays ours. | Publish and keep an ODbL extract up to date |
| **C. No OpenStreetMap in listings.** Publish only from Wikidata, official lists and our own visits.                                                                  | No ODbL obligations beyond map tiles, if any.                                         | Fewer leads                                 |

**Our recommendation: A. It is built.** Every published lead is already visited or called. The
publish form has "I took the name and location on site": the name on the sign, the Arabic name,
and the point, typed or taken with "use my location". With that option:

- only the kind of place and the destination come from the lead;
- the venue records `location_source = on-site` and `lead-found:osm:<id>`, meaning where we heard
  of it rather than copied data;
- no credit is shown, because nothing was copied.

Without the option, today's behaviour (copied name and point, credited) remains until counsel
decides.

## Questions for counsel

1. Is holding OpenStreetMap-derived leads for staff only (never displayed) "public use" under the
   ODbL?
2. If a listing's name and point are re-captured on site, is it free of OpenStreetMap's database
   right even though OpenStreetMap told us where to look (option A)?
3. If we copy the name and point (as today), is our catalogue a derivative database or a
   collective database? What exactly would we have to offer under the ODbL?
4. Is the attribution on each listing page enough, or is a site-wide credit also needed (footer,
   about page, the app)?
5. The planner shows listing names in a traveller's day plan and PDF. Are those "produced works"
   that need the credit too?
6. Do Lebanese law and our terms (approved 18 September 2026) add anything: database rights,
   consumer information, or the language of the credit?

## Record

| Date | Sent to | Decision | Changes made |
| ---- | ------- | -------- | ------------ |
|      |         |          |              |
