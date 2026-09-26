import assert from "node:assert/strict";

// Kinds of place from catalogue tags (migration 053): only for listings without one, and never a meal or
// stay kind for a listing that is not a restaurant or a stay.
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

async function tag(db, slug) {
  return (
    await one(
      db,
      "INSERT INTO app.taxonomy (kind, slug, label) VALUES ('tag', $1, $1) ON CONFLICT (kind, slug) DO UPDATE SET label = EXCLUDED.label RETURNING id",
      [slug],
    )
  ).id;
}

export async function testCataloguePlaceTypes(db) {
  const kinds = async (id) =>
    (
      await db.query(
        "SELECT place_type, is_primary FROM app.experience_place_types WHERE experience_id = $1 ORDER BY is_primary DESC, place_type",
        [id],
      )
    ).rows.map((row) => `${row.place_type}${row.is_primary ? "*" : ""}`);
  const untyped = async (kind) =>
    (
      await one(
        db,
        "SELECT e.id FROM app.experiences e WHERE e.listing_kind = $1 AND NOT EXISTS (SELECT 1 FROM app.experience_place_types t WHERE t.experience_id = e.id) LIMIT 1",
        [kind],
      )
    )?.id;

  const castle = await tag(db, "castle");
  const archaeology = await tag(db, "archaeological-site");
  const viewpoint = await tag(db, "viewpoint");
  const sight = await untyped("experience");
  assert.ok(sight, "an untyped listing to classify");
  for (const term of [viewpoint, archaeology, castle]) {
    await db.query(
      "INSERT INTO app.experience_taxonomy (experience_id, term_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [sight, term],
    );
  }
  const restaurant = await untyped("restaurant");
  if (restaurant) {
    await db.query(
      "INSERT INTO app.experience_taxonomy (experience_id, term_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [restaurant, castle],
    );
  }

  assert.ok((await one(db, "SELECT app.backfill_catalogue_place_types() AS n")).n >= 1);
  assert.deepEqual(await kinds(sight), ["castle*", "ruins", "viewpoint"], "the most specific tag is the main kind");
  if (restaurant) assert.deepEqual(await kinds(restaurant), [], "a restaurant is never given a sight kind");

  // A kind someone chose is kept: running it again changes nothing.
  await db.query("UPDATE app.experience_place_types SET is_primary = false WHERE experience_id = $1", [sight]);
  await db.query(
    "UPDATE app.experience_place_types SET is_primary = true WHERE experience_id = $1 AND place_type = 'viewpoint'",
    [sight],
  );
  await one(db, "SELECT app.backfill_catalogue_place_types() AS n");
  assert.deepEqual(await kinds(sight), ["viewpoint*", "castle", "ruins"]);
}
