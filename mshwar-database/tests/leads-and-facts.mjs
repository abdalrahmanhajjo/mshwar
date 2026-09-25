import assert from "node:assert/strict";

// Place facts and place leads (migration 049). Runs after place-types.mjs (synthetic Batroun listings)
// and planner-data.mjs (demand gaps). Alice is a platform admin; Bob owns the synthetic organisation.
const alice = "00000000-0000-0000-0000-000000000001";
const bob = "00000000-0000-0000-0000-000000000002";
const org = "10000000-0000-0000-0000-000000000002";
const sweets = "73000000-0000-0000-0000-000000000004";
const hotel = "73000000-0000-0000-0000-000000000006";

const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];
const step = async (db, body) =>
  (await db.query("SELECT app.planner_retrieve_step($1::jsonb) AS r", [JSON.stringify(body)])).rows[0].r;

async function rejects(db, sql, params, pattern) {
  await db.exec("BEGIN");
  try {
    await assert.rejects(db.query(sql, params), pattern);
  } finally {
    await db.exec("ROLLBACK");
  }
}

export async function testLeadsAndFacts(db) {
  // Facts: a "no" drops a place, an unknown keeps it (listed as unconfirmed), a view asked for ranks it.
  const saved = (
    await one(db, "SELECT app.portal_set_place_facts($1, $2, $3, $4::jsonb) AS j", [
      bob,
      org,
      sweets,
      JSON.stringify({ halal: true, vegan: false, views: ["sea"], accepts_card: true }),
    ])
  ).j;
  assert.deepEqual([saved.halal, saved.vegan, saved.source, saved.views], [true, false, "owner", ["sea"]]);
  assert.equal(saved.wheelchair_access, undefined, "unknown stays unknown");
  const halal = await step(db, { role: "meal", tags: ["sweets"], needs: { halal: true } });
  assert.deepEqual(
    halal.map((c) => [c.slug, c.unconfirmed_needs]),
    [["pt-sweets", []]],
  );
  assert.deepEqual(await step(db, { role: "meal", tags: ["sweets"], needs: { vegan: true } }), []);
  const access = await step(db, { role: "meal", tags: ["sweets"], needs: { wheelchair_access: true } });
  assert.deepEqual(access[0].unconfirmed_needs, ["wheelchair_access"]);
  const view = await step(db, { role: "meal", tags: ["sweets", "sea-view"] });
  assert.ok(view[0].hybrid > access[0].hybrid, "a sea view asked for ranks the place with one");
  await rejects(
    db,
    "SELECT app.admin_set_place_facts($1, $2, $3::jsonb)",
    [alice, hotel, JSON.stringify({ halal: "maybe" })],
    /yes, no or unknown/,
  );
  await rejects(
    db,
    "SELECT app.admin_set_place_facts($1, $2, $3::jsonb)",
    [alice, hotel, JSON.stringify({ views: ["moon"] })],
    /views are/,
  );
  await rejects(
    db,
    "SELECT app.portal_set_place_facts($1, $2, $3, $4::jsonb)",
    [alice, org, hotel, JSON.stringify({ halal: true })],
    /capability denied/,
  );

  // Leads: imported, deduplicated against leads and listings, never re-imported.
  const leads = [
    {
      source: "osm",
      external_id: "node/1",
      name: "Batroun Lanes",
      lat: 34.26,
      lng: 35.66,
      place_type: "bowling",
      destination_slug: "pt-batroun",
    },
    { source: "wikidata", external_id: "Q1", name: "Batroun Lanes", lat: 34.2601, lng: 35.6601, place_type: "bowling" },
    { source: "osm", external_id: "node/2", name: "Knefeh House", lat: 34.2553, lng: 35.659, place_type: "sweets" },
    { source: "osm", external_id: "node/3", name: "Somewhere in Paris", lat: 48.85, lng: 2.35 },
    {
      source: "osm",
      external_id: "node/4",
      name: "Old Mill Viewpoint",
      lat: 34.3,
      lng: 35.7,
      place_type: "viewpoint",
      destination_slug: "pt-batroun",
    },
  ];
  const first = (await one(db, "SELECT app.admin_import_leads($1, $2::jsonb) AS j", [alice, JSON.stringify(leads)])).j;
  assert.deepEqual(first, { created: 2, duplicates: 2, known: 0, invalid: 1 });
  const again = (await one(db, "SELECT app.admin_import_leads($1, $2::jsonb) AS j", [alice, JSON.stringify(leads)])).j;
  assert.deepEqual(again, { created: 0, duplicates: 0, known: 4, invalid: 1 });

  // The queue puts what travellers asked for and could not get first (bowling in pt-batroun).
  await db.query("SELECT app.planner_record_step_gaps($1::jsonb)", [
    JSON.stringify([
      { destination_slug: "pt-batroun", role: "activity", tags: ["bowling"], reason: "no_trusted_match" },
    ]),
  ]);
  const queue = (await one(db, "SELECT app.admin_list_leads($1, '{}'::jsonb) AS j", [alice])).j;
  assert.deepEqual(
    queue.map((lead) => [lead.name, lead.demand > 0]),
    [
      ["Batroun Lanes", true],
      ["Old Mill Viewpoint", false],
    ],
  );
  // Leads are never planned.
  assert.ok(!(await step(db, { role: "activity", tags: ["bowling"] })).some((c) => c.title === "Batroun Lanes"));

  // Publishing after a check makes a listing the planner can use; rejecting keeps the reason.
  const lanes = queue[0];
  await rejects(
    db,
    "SELECT app.admin_publish_lead($1, $2, $3::jsonb)",
    [alice, lanes.id, JSON.stringify({ description: "short", notes: "visited" })],
    /at least 20 characters/,
  );
  const published = (
    await one(db, "SELECT app.admin_publish_lead($1, $2, $3::jsonb) AS j", [
      alice,
      lanes.id,
      JSON.stringify({
        description: "Eight lanes and a snack bar by the old port.",
        notes: "Visited on Saturday evening.",
      }),
    ])
  ).j;
  assert.deepEqual([published.status, published.listing_kind], ["published", "experience"]);
  const found = await step(db, { role: "activity", tags: ["bowling"], destination_slugs: ["pt-batroun"] });
  const listed = found.find((c) => c.slug === published.slug);
  assert.ok(listed, "a published lead is a listing the planner can use");
  assert.equal(listed.price.type, "quote-required", "no price is invented for it");
  const viewpoint = queue[1];
  await rejects(
    db,
    "SELECT app.admin_decide_lead($1, $2, $3::jsonb)",
    [alice, viewpoint.id, JSON.stringify({ decision: "rejected" })],
    /say why/,
  );
  const rejected = (
    await one(db, "SELECT app.admin_decide_lead($1, $2, $3::jsonb) AS j", [
      alice,
      viewpoint.id,
      JSON.stringify({ decision: "rejected", reason: "Closed to the public" }),
    ])
  ).j;
  assert.equal(rejected.status, "rejected");
  const later = (
    await one(db, "SELECT app.admin_import_leads($1, $2::jsonb) AS j", [alice, JSON.stringify([leads[4]])])
  ).j;
  assert.equal(later.known, 1, "a rejected lead is never imported again");

  // Staff only; the API role cannot read leads directly.
  await rejects(db, "SELECT app.admin_import_leads($1, '[]'::jsonb)", [bob], /admin role required/);
  await db.exec("BEGIN; SET LOCAL ROLE mshwar_backend");
  try {
    await assert.rejects(db.query("SELECT * FROM app.place_leads"), /permission denied/);
  } finally {
    await db.exec("ROLLBACK");
  }
}
