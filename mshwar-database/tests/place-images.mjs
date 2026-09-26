import assert from "node:assert/strict";

// Every place shows a picture (migration 058): its own photo, else its town's, else its region's, marked 'area'.
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

export async function testPlaceImages(db) {
  const place = await one(
    db,
    `SELECT e.id, d.id AS dest_id, d.image_url, d.image_alt, d.parent_id
     FROM app.experiences e JOIN app.venues v ON v.id = e.venue_id JOIN app.destinations d ON d.id = v.destination_id
     WHERE NOT EXISTS (SELECT 1 FROM app.media m WHERE m.experience_id = e.id AND m.moderation = 'approved')
       AND app.catalogue_listing_row(e.id) IS NOT NULL
     LIMIT 1`,
  );
  assert.ok(place, "a place without a photo of its own");
  const image = async () => (await one(db, "SELECT app.place_image($1) AS i", [place.id])).i;

  await db.query(
    "UPDATE app.destinations SET image_url = 'https://cdn.example.org/town.jpg', image_alt = 'The town' WHERE id = $1",
    [place.dest_id],
  );
  assert.deepEqual(await image(), { url: "https://cdn.example.org/town.jpg", alt: "The town", kind: "area" });

  await db.query("UPDATE app.destinations SET image_url = NULL WHERE id = $1", [place.dest_id]);
  const region = await one(
    db,
    "INSERT INTO app.destinations (slug, name, region, status, image_url) VALUES ('test-region-photo', 'Test Region', 'Test Region', 'published', 'https://cdn.example.org/region.jpg') RETURNING id",
  );
  await db.query("UPDATE app.destinations SET parent_id = $1 WHERE id = $2", [region.id, place.dest_id]);
  assert.deepEqual(await image(), { url: "https://cdn.example.org/region.jpg", alt: "Test Region", kind: "area" });

  const listing = (await one(db, "SELECT app.catalogue_listing_row($1) AS l", [place.id])).l;
  assert.equal(listing.image_kind, "area", "listings carry the fallback and say it is the area");
  assert.deepEqual(listing.gallery, [], "the gallery stays the place's own photos");

  await db.query("UPDATE app.destinations SET parent_id = $2, image_url = $3, image_alt = $4 WHERE id = $1", [
    place.dest_id,
    place.parent_id,
    place.image_url,
    place.image_alt,
  ]);
  await db.query("DELETE FROM app.destinations WHERE id = $1", [region.id]);
}
