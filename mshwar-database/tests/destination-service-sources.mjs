import assert from "node:assert/strict";

export async function testDestinationServiceSources(db) {
  const slugs = [
    "beirut",
    "mount-lebanon",
    "north-lebanon",
    "akkar",
    "beqaa",
    "baalbek-hermel",
    "south-lebanon",
    "nabatieh",
  ];
  const categories = ["transport", "drivers", "money", "eat", "stay"];
  const { rows } = await db.query("SELECT * FROM app.destination_service_sources");
  assert.equal(rows.length, 80);
  for (const slug of slugs) {
    for (const category of categories) {
      const entries = rows.filter((r) => r.destination_slug === slug && r.category === category);
      assert.ok(entries.length >= 2, `${slug}/${category}: at least two sources`);
      assert.equal(new Set(entries.map((r) => r.name)).size, entries.length);
      for (const entry of entries) {
        assert.equal(new URL(entry.source_url).protocol, "https:");
        assert.ok(entry.source_name && entry.locality);
        assert.ok(entry.checked_on <= entry.review_by);
        if (["eat", "stay", "money"].includes(category)) assert.equal(entry.coverage, "local");
      }
    }
  }

  await db.exec("BEGIN");
  try {
    // Keep the visibility contract test valid after the real research expires.
    await db.exec(
      "UPDATE app.destination_service_sources SET checked_on = app.beirut_today(), review_by = app.beirut_today() + 90",
    );
    for (const slug of slugs) {
      await db.query(
        "INSERT INTO app.destinations(slug, name, country_code, status) VALUES ($1, $1, 'LB', 'published') ON CONFLICT (slug) DO UPDATE SET status = 'published'",
        [slug],
      );
      const result = await db.query("SELECT app.public_destination_service_sources($1) AS entries", [slug]);
      assert.equal(result.rows[0].entries.length, 10, slug);
      assert.ok(result.rows[0].entries.every((r) => r.destination_slug === slug && !("active" in r)));
    }
    await db.exec("SET LOCAL ROLE mshwar_backend");
    const publicRead = await db.query("SELECT app.public_destination_service_sources('akkar') AS entries");
    assert.equal(publicRead.rows[0].entries.length, 10);
    await db.exec("SAVEPOINT access_check");
    await assert.rejects(db.query("SELECT * FROM app.destination_service_sources"), /permission denied/);
    await db.exec("ROLLBACK TO SAVEPOINT access_check; RESET ROLE");
    const hidden = async (slug) =>
      (await db.query("SELECT app.public_destination_service_sources($1) AS entries", [slug])).rows[0].entries;
    assert.deepEqual(await hidden("nonexistent"), []);
    await db.exec("UPDATE app.destinations SET status = 'draft' WHERE slug = 'akkar'");
    assert.deepEqual(await hidden("akkar"), []);
    await db.exec(
      "UPDATE app.destination_service_sources SET checked_on = app.beirut_today() - 100, review_by = app.beirut_today() - 1 WHERE destination_slug = 'beirut'",
    );
    assert.deepEqual(await hidden("beirut"), []);
    await db.exec("UPDATE app.destination_service_sources SET active = false WHERE destination_slug = 'beqaa'");
    assert.deepEqual(await hidden("beqaa"), []);
    await db.exec(
      "UPDATE app.destination_service_sources SET checked_on = app.beirut_today() + 1 WHERE destination_slug = 'nabatieh'",
    );
    assert.deepEqual(await hidden("nabatieh"), []);
  } finally {
    await db.exec("ROLLBACK");
  }
}
