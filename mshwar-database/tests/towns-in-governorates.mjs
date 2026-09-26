import assert from "node:assert/strict";

// A governorate shows its towns' places (migration 055): destination list and counts, listings, search, planner.
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

export async function testTownsInGovernorates(db) {
  const listing = await one(
    db,
    `SELECT e.id, e.slug, d.id AS town_id, d.slug AS town, d.region AS town_region
     FROM app.experiences e
     JOIN app.venues v ON v.id = e.venue_id
     JOIN app.destinations d ON d.id = v.destination_id
     WHERE e.status = 'published' AND e.hidden_at IS NULL AND app.planner_step_eligible(e.id)
       AND 'sight' = ANY (app.experience_roles(e.id))
     LIMIT 1`,
  );
  assert.ok(listing, "a published listing in a town");
  const region = await one(
    db,
    "INSERT INTO app.destinations (slug, name, region, status) VALUES ('test-governorate', 'Test Governorate', 'Test Governorate', 'published') RETURNING id",
  );
  // The town's region names the governorate, as in the catalogue.
  await db.query("UPDATE app.destinations SET parent_id = $1, region = 'Test Governorate' WHERE id = $2", [
    region.id,
    listing.town_id,
  ]);

  const offered = (await one(db, "SELECT app.public_catalogue_destinations() AS rows")).rows;
  const governorate = offered.find((row) => row.slug === "test-governorate");
  assert.ok(governorate && governorate.experience_count >= 1, "a governorate with only town places is offered");

  const listed = await db.query(
    "SELECT listing->>'slug' AS slug FROM app.public_catalogue_experiences(NULL, NULL, 'test-governorate', NULL, NULL, NULL, NULL, NULL, 48, 0)",
  );
  assert.ok(
    listed.rows.some((row) => row.slug === listing.slug),
    "the governorate lists its towns' places",
  );

  const found = (
    await one(db, "SELECT app.planner_retrieve_step($1::jsonb) AS items", [
      JSON.stringify({ role: "sight", destination_slugs: ["test-governorate"], limit: 24 }),
    ])
  ).items;
  assert.ok(
    found.some((item) => item.id === listing.id),
    "the planner finds a town's place for its governorate",
  );

  const terms = (await one(db, "SELECT app.planner_destination_terms() AS rows")).rows;
  assert.ok(
    !terms.some((row) => row.slug === listing.town && row.term === "Test Governorate"),
    "a town is not named by its governorate's region",
  );
  assert.ok(terms.some((row) => row.slug === "test-governorate" && row.term === "Test Governorate"));

  // A town left out of the list (059) is still a place: its listings and the planner still find it.
  await db.query("UPDATE app.destinations SET listed = false WHERE id = $1", [listing.town_id]);
  const listedNow = (await one(db, "SELECT app.public_catalogue_destinations() AS rows")).rows;
  assert.ok(!listedNow.some((row) => row.slug === listing.town), "an unlisted town is not in the list");
  assert.ok(
    listedNow.some((row) => row.slug === "test-governorate"),
    "its governorate still is",
  );
  const stillListed = await db.query(
    "SELECT listing->>'slug' AS slug FROM app.public_catalogue_experiences(NULL, NULL, $1, NULL, NULL, NULL, NULL, NULL, 48, 0)",
    [listing.town],
  );
  assert.ok(
    stillListed.rows.some((row) => row.slug === listing.slug),
    "its places are still listed",
  );
  await db.query("UPDATE app.destinations SET listed = true WHERE id = $1", [listing.town_id]);

  await db.query("UPDATE app.destinations SET parent_id = NULL, region = $2 WHERE id = $1", [
    listing.town_id,
    listing.town_region,
  ]);
  await db.query("DELETE FROM app.destinations WHERE id = $1", [region.id]);
}
