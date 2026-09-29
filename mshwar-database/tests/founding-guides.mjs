import assert from "node:assert/strict";

// The first fifty approved guides are Founding Guides (migration 060): numbered by the
// database in approval order, kept through a suspension, and counted for the public page.
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

const guide = async (db, n) => {
  const user = `70000000-0000-0000-0000-00000000000${n}`;
  const org = `71000000-0000-0000-0000-00000000000${n}`;
  await db.query("INSERT INTO app.users (id, auth_issuer, auth_subject, display_name) VALUES ($1, 'test', $2, $3)", [
    user,
    `founding-${n}`,
    `Test Guide ${n}`,
  ]);
  await db.query("INSERT INTO app.organizations (id, name, slug, verification) VALUES ($1, $2, $3, 'verified')", [
    org,
    `Test Guide Org ${n}`,
    `test-guide-org-${n}`,
  ]);
  const row = await one(
    db,
    "INSERT INTO app.guide_profiles (user_id, tier, display_name, slug, status) VALUES ($1, 'licensed', $2, $3, 'submitted') RETURNING id",
    [user, `Test Guide ${n}`, `test-guide-${n}`],
  );
  return { id: row.id, org };
};

const approve = (db, g) =>
  db.query(
    "UPDATE app.guide_profiles SET status = 'approved', organization_id = $2, decided_at = now() WHERE id = $1",
    [g.id, g.org],
  );
const number = async (db, g) =>
  (await one(db, "SELECT founding_number FROM app.guide_profiles WHERE id = $1", [g.id])).founding_number;
const programme = async (db) => (await one(db, "SELECT app.founding_guide_programme() AS p")).p;

export async function testFoundingGuides(db) {
  await db.exec("BEGIN");
  try {
    const before = await programme(db);
    assert.equal(before.limit, 50);
    assert.equal(before.taken + before.remaining, 50);

    const first = await guide(db, 1);
    const second = await guide(db, 2);
    assert.equal(await number(db, first), null, "a submitted guide has no number yet");

    await approve(db, first);
    await approve(db, second);
    assert.equal(await number(db, first), before.taken + 1, "numbered in approval order");
    assert.equal(await number(db, second), before.taken + 2);
    assert.deepEqual(await programme(db), { limit: 50, taken: before.taken + 2, remaining: before.remaining - 2 });

    await db.query("UPDATE app.guide_profiles SET status = 'suspended' WHERE id = $1", [first.id]);
    await db.query("UPDATE app.guide_profiles SET status = 'approved' WHERE id = $1", [first.id]);
    assert.equal(await number(db, first), before.taken + 1, "a suspension does not cost the place");

    const json = (await one(db, "SELECT app.guide_profile_json($1, false) AS j", [second.id])).j;
    assert.equal(json.founding_number, before.taken + 2, "the public profile carries the number");

    // Once the fifty are taken, later guides are approved without one.
    await db.query("UPDATE app.guide_profiles SET founding_number = 50 WHERE id = $1", [second.id]);
    const late = await guide(db, 3);
    await approve(db, late);
    assert.equal(await number(db, late), null, "no number after the fiftieth");
  } finally {
    await db.exec("ROLLBACK");
  }
}
