import assert from "node:assert/strict";

// Trip builder v2, phase 4 (migration 046): real prices for a whole day. Runs after place-types.mjs,
// whose synthetic Batroun listings it prices.
const alice = "00000000-0000-0000-0000-000000000001";
const sweets = "73000000-0000-0000-0000-000000000004";
const bowling = "73000000-0000-0000-0000-000000000001";
const hotel = "73000000-0000-0000-0000-000000000006";

const step = async (db, body) =>
  (await db.query("SELECT app.planner_retrieve_step($1::jsonb) AS r", [JSON.stringify(body)])).rows[0].r;
const setTypes = (db, id, body) =>
  db.query("SELECT app.admin_set_place_types($1, $2, $3::jsonb) AS j", [alice, id, JSON.stringify(body)]);

async function rejects(db, id, body, pattern) {
  await db.exec("BEGIN");
  try {
    await assert.rejects(setTypes(db, id, body), pattern);
  } finally {
    await db.exec("ROLLBACK");
  }
}

export async function testDayPricing(db) {
  // A restaurant's own typical spend per person travels with it to the planner.
  const saved = (await setTypes(db, sweets, { place_types: ["sweets", "cafe"], typical_spend_minor: 1200 })).rows[0].j;
  assert.equal(Number(saved.typical_spend_minor), 1200);
  const [knefeh] = await step(db, { role: "meal", tags: ["sweets"] });
  assert.equal(Number(knefeh.details.typical_spend_minor), 1200);
  assert.equal(knefeh.price.has_rule, false, "no price rule: the planner must not call it free");
  // Leaving the key out keeps it; only restaurants have one; it must be a sane amount.
  await setTypes(db, sweets, { place_types: ["sweets", "cafe"] });
  assert.equal(Number((await step(db, { role: "meal", tags: ["sweets"] }))[0].details.typical_spend_minor), 1200);
  await rejects(db, bowling, { place_types: ["bowling"], typical_spend_minor: 1500 }, /only a restaurant/);
  await rejects(db, sweets, { place_types: ["sweets"], typical_spend_minor: 5 }, /typical spend/);
  await rejects(db, sweets, { place_types: ["sweets"], typical_spend_minor: "a lot" }, /whole number/);

  // A price range keeps its top, so the day's total can be a range too.
  await db.query(
    `INSERT INTO app.price_rules (experience_id, currency, price_type, unit, amount_minor, max_amount_minor, valid_during, source)
     VALUES ($1, 'USD', 'range', 'person', 1000, 1800, tstzrange(now() - interval '1 day', now() + interval '1 year'), 'owner')`,
    [bowling],
  );
  const [lanes] = await step(db, { role: "activity", tags: ["bowling"], destination_slugs: ["pt-batroun"] });
  assert.deepEqual(
    [lanes.price.type, Number(lanes.price.amount_minor), Number(lanes.price.max_amount_minor), lanes.price.has_rule],
    ["range", 1000, 1800, true],
  );

  // A stay brings what the traveller books with: its price per night and check-in time.
  await db.query(
    `INSERT INTO app.listing_details (experience_id, price_from_minor, check_in, booking_url)
     VALUES ($1, 9000, '14:00', 'https://example.com/book')
     ON CONFLICT (experience_id) DO UPDATE SET price_from_minor = 9000, check_in = '14:00', booking_url = 'https://example.com/book'`,
    [hotel],
  );
  const [night] = await step(db, { role: "stay", tags: ["hotel", "boutique-hotel"] });
  assert.equal(Number(night.details.price_from_minor), 9000);
  assert.equal(night.details.booking_url, "https://example.com/book");
  assert.match(night.details.check_in, /^14:00/);

  // Drivers' published day rates: none are live in this database, so none are shown - never a guess.
  await db.exec("BEGIN; SET LOCAL ROLE mshwar_backend");
  try {
    const rates = (await db.query("SELECT app.planner_driver_day_rates('pt-batroun', 2) AS r")).rows[0].r;
    assert.deepEqual(rates, []);
  } finally {
    await db.exec("ROLLBACK");
  }
}
