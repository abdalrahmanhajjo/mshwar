import assert from "node:assert/strict";

// Restaurants and stays from a published source (migration 056): planned, marked "sourced" with the source link,
// but only from the curated catalogue with a source; any other unvisited restaurant still waits for its visit.
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

export async function testSourcedRestaurants(db) {
  const place = await one(
    db,
    `SELECT e.id, o.id AS org_id, v.id AS venue_id, v.location_source, v.source_url
     FROM app.experiences e
     JOIN app.venues v ON v.id = e.venue_id
     JOIN app.organizations o ON o.id = e.organization_id AND o.slug = 'mshwar-catalogue'
     WHERE e.listing_kind = 'restaurant' AND e.status = 'published' AND NOT app.venue_is_checked(e.id)
     LIMIT 1`,
  );
  assert.ok(place, "an unvisited published restaurant of the curated catalogue");
  const eligible = async () => (await one(db, "SELECT app.planner_step_eligible($1) AS ok", [place.id])).ok;
  const trust = async () => (await one(db, "SELECT app.planner_trust_json($1) AS t", [place.id])).t;

  await db.query("UPDATE app.venues SET location_source = 'curated', source_url = NULL WHERE id = $1", [
    place.venue_id,
  ]);
  assert.equal(await eligible(), false, "no source, no plan");

  await db.query("UPDATE app.venues SET source_url = 'https://example.org/guide' WHERE id = $1", [place.venue_id]);
  assert.equal(await eligible(), true, "a curated place with its source can be planned");
  const sourced = await trust();
  assert.equal(sourced.level, "sourced");
  assert.equal(sourced.source_url, "https://example.org/guide");

  await assert.rejects(
    db.query("UPDATE app.venues SET source_url = 'http://example.org' WHERE id = $1", [place.venue_id]),
    "a source link is https",
  );

  await db.query("UPDATE app.organizations SET slug = 'someone-else' WHERE id = $1", [place.org_id]);
  assert.equal(await eligible(), false, "an owner's unvisited restaurant still waits for its visit");
  await db.query("UPDATE app.organizations SET slug = 'mshwar-catalogue' WHERE id = $1", [place.org_id]);

  await db.query("UPDATE app.venues SET location_source = $2, source_url = $3 WHERE id = $1", [
    place.venue_id,
    place.location_source,
    place.source_url,
  ]);
}
