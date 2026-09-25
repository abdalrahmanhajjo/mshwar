import assert from "node:assert/strict";

// Real prices with proof (migration 047). Runs after place-types.mjs and day-pricing.mjs.
const alice = "00000000-0000-0000-0000-000000000001"; // platform admin (granted in place-types.mjs)
const bob = "00000000-0000-0000-0000-000000000002";
const bowling = "73000000-0000-0000-0000-000000000001";
const castle = "73000000-0000-0000-0000-000000000007";

const today = async (db) => (await db.query("SELECT app.beirut_today()::text AS d")).rows[0].d;
const plusDays = async (db, days) =>
  (await db.query("SELECT (app.beirut_today() + $1::integer)::text AS d", [days])).rows[0].d;
const setPrice = (db, user, id, body) =>
  db.query("SELECT app.admin_set_sourced_price($1, $2, $3::jsonb) AS j", [user, id, JSON.stringify(body)]);
const candidate = async (db, body) =>
  (await db.query("SELECT app.planner_retrieve_step($1::jsonb) AS r", [JSON.stringify(body)])).rows[0].r[0];

async function rejects(db, user, id, body, pattern) {
  await db.exec("BEGIN");
  try {
    await assert.rejects(setPrice(db, user, id, body), pattern);
  } finally {
    await db.exec("ROLLBACK");
  }
}

export async function testSourcedPrices(db) {
  const source = {
    price_type: "fixed",
    amount_minor: 800,
    currency: "USD",
    unit: "person",
    source_url: "https://example.org/sea-castle/tickets",
    source_name: "Sea Castle ticket office",
    checked_on: await today(db),
  };
  // A place with no price at all gets its published price, with the proof attached.
  const saved = (await setPrice(db, alice, castle, source)).rows[0].j;
  assert.equal(saved.source_name, "Sea Castle ticket office");
  assert.equal(saved.review_by, await plusDays(db, 180), "reviewed within six months by default");
  const sea = await candidate(db, { role: "sight", tags: ["castle"], destination_slugs: ["pt-batroun"] });
  assert.equal(sea.slug, "pt-castle");
  assert.deepEqual([sea.price.type, Number(sea.price.amount_minor), sea.price.has_rule], ["fixed", 800, true]);
  assert.equal(sea.price.source_url, "https://example.org/sea-castle/tickets");
  assert.equal(sea.price.checked_on, await today(db));

  // Replacing an earlier price ends it rather than deleting it (bookings may point at it).
  const before = (await db.query("SELECT count(*)::int AS n FROM app.price_rules WHERE experience_id = $1", [bowling]))
    .rows[0].n;
  await setPrice(db, alice, bowling, {
    ...source,
    price_type: "range",
    amount_minor: 1200,
    max_amount_minor: 2000,
    source_name: "Strike Lanes price board",
    source_url: "https://example.org/lanes",
    review_by: await plusDays(db, 20),
  });
  const rules = (
    await db.query(
      "SELECT price_type, upper_inf(valid_during) AS open FROM app.price_rules WHERE experience_id = $1 ORDER BY lower(valid_during)",
      [bowling],
    )
  ).rows;
  assert.equal(rules.length, before + 1);
  assert.deepEqual(
    rules.map((rule) => [rule.price_type, rule.open]),
    [
      ["range", false],
      ["range", false],
    ],
    "the owner's earlier range was ended, the sourced one ends at its review date",
  );
  const lanes = await candidate(db, { role: "activity", tags: ["bowling"], destination_slugs: ["pt-batroun"] });
  assert.deepEqual([Number(lanes.price.amount_minor), Number(lanes.price.max_amount_minor)], [1200, 2000]);
  assert.equal(lanes.price.source_name, "Strike Lanes price board");

  // What staff must re-check soon.
  const due = (await db.query("SELECT app.admin_sourced_prices_due($1, 30) AS j", [alice])).rows[0].j;
  assert.deepEqual(
    due.map((item) => item.slug),
    ["pt-bowling"],
  );

  // Proof is required, checks are recent, reviews are within a year, and only staff record prices.
  await rejects(db, alice, castle, { ...source, source_url: "http://example.org" }, /https link/);
  await rejects(db, alice, castle, { ...source, source_name: " " }, /https link/);
  await rejects(db, alice, castle, { ...source, checked_on: await plusDays(db, 3) }, /last 60 days/);
  await rejects(db, alice, castle, { ...source, checked_on: await plusDays(db, -90) }, /last 60 days/);
  await rejects(db, alice, castle, { ...source, review_by: await plusDays(db, 400) }, /within a year/);
  await rejects(db, alice, castle, { ...source, price_type: "quote" }, /fixed, from or a range/);
  await rejects(db, alice, castle, { ...source, price_type: "range", max_amount_minor: 10 }, /check the amounts/);
  await rejects(db, alice, castle, { ...source, currency: "XXX" }, /unknown currency/);
  await rejects(db, alice, castle, source, /already set/);
  await rejects(db, bob, castle, source, /admin role required/);

  // A lapsed price stops applying: the place is "on request" again, never shown with an old price.
  await db.exec("BEGIN");
  try {
    await db.query(
      "UPDATE app.price_rules SET valid_during = tstzrange(now() - interval '3 days', now() - interval '1 day', '[)') WHERE experience_id = $1 AND source LIKE 'sourced:%'",
      [castle],
    );
    const lapsed = await candidate(db, { role: "sight", tags: ["castle"], destination_slugs: ["pt-batroun"] });
    assert.equal(lapsed.price.has_rule, false);
    assert.equal(lapsed.price.source_url, undefined);
  } finally {
    await db.exec("ROLLBACK");
  }

  // Every recorded price and its proof is audited.
  const audited = (await db.query("SELECT count(*)::int AS n FROM app.audit_log WHERE table_name = 'price_sources'"))
    .rows[0].n;
  assert.equal(audited, 2);
}
