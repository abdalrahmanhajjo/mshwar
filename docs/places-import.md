# Finding places: open data to checked listings

The planner only offers trusted places. Open data tells staff where to look. It never puts a place
in front of a traveller: a lead becomes a listing only after a person has visited or called it.

```
download (staff) ──► import as leads ──► queue, most asked-for first ──► field visit or call
                                                                          │
                     listing, with the facts seen there ◄── publish ◄─────┘   (or reject / duplicate)
```

## 1. Download

The queries are generated from the importer's own maps, so they never ask for a kind of place the
importer cannot map. Regenerate them with `python scripts/export_lead_queries.py`; a test fails if
the committed files drift.

| Source        | Query                                                   | Where to run it                                                                                                | Save as                 |
| ------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------- |
| OpenStreetMap | `services/api/app/seed/queries/lebanon.overpassql`      | [overpass-turbo.eu](https://overpass-turbo.eu): paste, Run, then Export → "raw OSM data" (JSON)                | `lebanon-overpass.json` |
| Wikidata      | `services/api/app/seed/queries/lebanon-wikidata.sparql` | [query.wikidata.org](https://query.wikidata.org): paste, Run, then Download → JSON                             | `lebanon-wikidata.json` |
| Official list | A ministry or municipality list                         | Convert it to GeoJSON points with `name`, `name_ar`, `name_fr`, `place_type` and `destination_slug` properties | `official-list.geojson` |

From a shell, the OpenStreetMap query can also be run with:

```bash
curl --data-urlencode data@services/api/app/seed/queries/lebanon.overpassql \
  https://overpass-api.de/api/interpreter -o lebanon-overpass.json
```

The build environment used to write this code cannot reach these services, so the first download is
a staff step. Check the Wikidata class ids in the query service before the first run: a wrong id
returns no rows, never wrong rows.

## 2. Import

```bash
cd services/api
DATABASE_URL=... python scripts/import_leads.py lebanon-overpass.json --source osm --admin you@mshwar.example
DATABASE_URL=... python scripts/import_leads.py lebanon-wikidata.json --source wikidata --admin you@mshwar.example
DATABASE_URL=... python scripts/import_leads.py official-list.geojson --source official_list --admin you@mshwar.example
```

The import:

- keeps only **named places inside Lebanon**;
- maps OpenStreetMap tags and Wikidata classes to Mshwar kinds of place; an unmapped place is
  imported without a kind;
- merges **duplicates**: a similar name within 75 m of another lead or an existing listing;
- never imports a lead it already knows, including one staff rejected;
- prints how many leads were created, merged as duplicates, already known or invalid. Re-running
  it is safe.

Record the counts in the table at the end of this file. They are the "measured" in the plan's
phase 2b.

## 3. Work the queue

At `/admin/catalogue`, **Leads to check** lists leads with the kinds travellers asked for and could
not get first. That order comes from the planner's unmet-demand counts
(`/admin/planner/language`). For each lead:

1. **Start checking** when someone takes it.
2. **Download the field sheet (CSV)** for a destination before a trip. It has one row per lead, a map
   link, and empty columns for what to confirm there: open, phone, hours, halal, wheelchair access,
   parking, children, cards, the published price and its link, and notes.
3. After the visit or call, choose one of:
   - **Publish after the check:** write a description for travellers and note what you checked and
     how. For an OpenStreetMap lead, tick "I took the name and location on site" and enter the name
     on the sign and the point, typed or taken with "use my location". Set the facts you confirmed; leave the rest "Not checked". The listing is published under
     the Mshwar catalogue organisation. A restaurant or stay is marked as checked by Mshwar and must
     be checked again within 180 days.
   - **Reject**, with the reason (closed, not a real place, unsafe). A rejected lead is never
     imported again.
   - **Duplicate**, when it is a place already listed.

A published lead's price is **on request** until someone records a published price (see
`docs/sourced-prices.md`, "Places with no published price").

## 4. Credit and licences

- A listing published from an OpenStreetMap lead shows "Name and location from © OpenStreetMap
  contributors (ODbL-1.0)" with links to the record and the licence. A listing from Wikidata
  credits Wikidata (CC0, credit not required but given).
- **Before the first listing that copies OpenStreetMap data goes live, legal must decide the ODbL
  questions in `docs/legal/odbl-review.md`.** Until then, publish OpenStreetMap leads with **"I
  took the name and location on site"**: the name from the sign and the point taken there. Nothing
  is copied, so nothing needs crediting. Wikidata and official-list leads can be published as they
  are.

## Desk-research leads: Beirut and Batroun

`services/api/app/seed/data/guide-leads-beirut-batroun.geojson` lists 16 real businesses found in
guides and on their own sites: sweets shops, breakfast places, dinner restaurants, hotels and
guesthouses, and a bowling alley. Each lead has its `source_url` and address. Load them with:

```bash
DATABASE_URL=... python scripts/import_leads.py app/seed/data/guide-leads-beirut-batroun.geojson --source guide --admin you@mshwar.example
```

`location_precision` says how far to trust the point. `exact` is the building. `area` is the
neighbourhood or town centre, because no published point was found. For an `area` lead, take the
point at the door with "use my location" before publishing. Restaurants and stays need that visit
anyway: the planner uses them only once Mshwar has checked them.

Cinemas and bowling alleys with a published point are in the curated catalogue instead
(`app/seed/lebanon_catalogue.py`, kinds from migration 054), so the planner can offer them now:

| Place                          | Where                     | Point from                                                          |
| ------------------------------ | ------------------------- | ------------------------------------------------------------------- |
| Cinemacity Beirut Souks        | Downtown Beirut           | 961guide / vymaps listing (33.9003, 35.5049)                        |
| Grand Cinemas ABC Achrafieh    | ABC Achrafieh mall        | near-place listing of the mall (33.8886, 35.5201)                   |
| Grand Cinemas ABC Verdun       | ABC Verdun mall           | near-place listing of the cinema (33.8844, 35.4843)                 |
| VOX Cinemas City Centre Beirut | City Centre Beirut mall   | Google Maps place link of the mall (33.8620, 35.5296)               |
| Grand Cinemas Las Salinas      | Las Salinas resort, Enfeh | Wikimapia "Las Salinas cinema theatre" (34.3639, 35.7358)           |
| Las Salinas Bowling            | Las Salinas resort, Enfeh | plus code 9P7P+MC2 Anfeh in its Trip.com listing (34.3636, 35.7360) |

Money changers are not listings. A changer is shown only after it registers in the changer portal
with its Banque du Liban number, the number is matched against the BDL list, and the branch is checked
(migration 042).

## Import record

| Date | Source | File | Read | Created | Duplicates | Known | Invalid | By  |
| ---- | ------ | ---- | ---- | ------- | ---------- | ----- | ------- | --- |
|      |        |      |      |         |            |       |         |     |
