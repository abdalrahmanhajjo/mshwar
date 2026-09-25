import assert from "node:assert/strict";

// Attribution for listings published from open data, and the price worklist (migration 051).
// Runs after leads-and-facts.mjs, which publishes an OpenStreetMap lead ("Batroun Lanes").
const alice = "00000000-0000-0000-0000-000000000001";
const bob = "00000000-0000-0000-0000-000000000002";

const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

async function rejects(db, sql, params, pattern) {
  await db.exec("BEGIN");
  try {
    await assert.rejects(db.query(sql, params), pattern);
  } finally {
    await db.exec("ROLLBACK");
  }
}

export async function testAttributionAndWorklist(db) {
  const lead = await one(
    db,
    "SELECT experience_id, external_id FROM app.place_leads WHERE status = 'published' AND source = 'osm' LIMIT 1",
  );
  assert.ok(lead, "the leads suite published an OpenStreetMap lead");

  const credits = (await one(db, "SELECT app.listing_attributions($1) AS j", [lead.experience_id])).j;
  assert.deepEqual(credits, [
    {
      source: "osm",
      name: "OpenStreetMap contributors",
      licence: "ODbL-1.0",
      licence_url: "https://www.openstreetmap.org/copyright",
      record_url: `https://www.openstreetmap.org/${lead.external_id}`,
    },
  ]);
  const other = await one(
    db,
    "SELECT e.id FROM app.experiences e JOIN app.venues v ON v.id = e.venue_id WHERE v.source_reference IS DISTINCT FROM ('lead:osm:' || $1) LIMIT 1",
    [lead.external_id],
  );
  assert.deepEqual((await one(db, "SELECT app.listing_attributions($1) AS j", [other.id])).j, []);

  // Option A (docs/legal/odbl-review.md): the name on the sign and the point taken on site. Nothing copied,
  // so nothing to credit; the lead is still recorded as where we heard of the place.
  const leads = [
    {
      source: "osm",
      external_id: "node/9001",
      name: "Old Lanes",
      lat: 34.2601,
      lng: 35.6602,
      place_type: "bowling",
      destination_slug: "pt-batroun",
    },
  ];
  await one(db, "SELECT app.admin_import_leads($1, $2::jsonb) AS j", [alice, JSON.stringify(leads)]);
  const found = await one(db, "SELECT id FROM app.place_leads WHERE external_id = 'node/9001'");
  const publish = (site) =>
    one(db, "SELECT app.admin_publish_lead($1, $2, $3::jsonb) AS j", [
      alice,
      found.id,
      JSON.stringify({
        description: "Six lanes above the old souk, open late.",
        notes: "Visited; name on the sign, point taken at the door.",
        on_site: site,
      }),
    ]);
  await rejects(
    db,
    "SELECT app.admin_publish_lead($1, $2, $3::jsonb)",
    [
      alice,
      found.id,
      JSON.stringify({
        description: "Six lanes above the old souk, open late.",
        notes: "Visited on site.",
        on_site: { name: "Souk Lanes" },
      }),
    ],
    /must be in Lebanon/,
  );
  const onSite = (await publish({ name: "Souk Lanes", name_ar: "بولينغ السوق", lat: 34.2603, lng: 35.6605 })).j;
  assert.equal(onSite.slug.startsWith("souk-lanes"), true, "the name on the sign, not the lead's");
  const venue = await one(
    db,
    "SELECT v.name, v.location_source, v.source_reference, ST_Y(v.location::geometry) AS lat FROM app.experiences e JOIN app.venues v ON v.id = e.venue_id WHERE e.slug = $1",
    [onSite.slug],
  );
  assert.deepEqual(
    [venue.name, venue.location_source, venue.source_reference, Number(venue.lat.toFixed(4))],
    ["Souk Lanes", "on-site", "lead-found:osm:node/9001", 34.2603],
  );
  const siteId = (await one(db, "SELECT id FROM app.experiences WHERE slug = $1", [onSite.slug])).id;
  assert.deepEqual((await one(db, "SELECT app.listing_attributions($1) AS j", [siteId])).j, []);

  // The worklist: planner listings without a published price, never one that has an amount.
  const list = async (filter = {}) =>
    (await one(db, "SELECT app.admin_price_worklist($1, $2::jsonb) AS j", [alice, JSON.stringify(filter)])).j;
  const before = await list();
  const lanes = before.find((row) => row.experience_id === lead.experience_id);
  assert.ok(lanes, "a lead published with its price on request needs a published price");
  assert.deepEqual([lanes.current_price_type, lanes.planned, lanes.last_source], ["quote-required", 0, null]);
  assert.ok(lanes.place_types.includes("bowling"));
  assert.ok((await list({ kind: "hotel" })).every((row) => row.listing_kind === "hotel"));
  await rejects(db, "SELECT app.admin_price_worklist($1, '{}'::jsonb)", [bob], /admin role required/);

  // Staff record the published price from the official source: it leaves the worklist.
  await one(db, "SELECT app.admin_set_sourced_price($1, $2, $3::jsonb) AS j", [
    alice,
    lead.experience_id,
    JSON.stringify({
      price_type: "fixed",
      amount_minor: 1200,
      source_url: "https://example.org/lanes/prices",
      source_name: "Batroun Lanes price board",
      checked_on: new Date().toISOString().slice(0, 10),
    }),
  ]);
  assert.ok(!(await list()).some((row) => row.experience_id === lead.experience_id));
}
