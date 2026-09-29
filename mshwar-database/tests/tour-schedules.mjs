import assert from "node:assert/strict";

// Guide plan step 2 (migration 061): schedules make starts, and the booking guard keeps
// one guide in one place. Everything runs inside a rolled-back transaction.
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

const USER = "72000000-0000-0000-0000-000000000001";
const ORG = "73000000-0000-0000-0000-000000000001";
const VENUE = "74000000-0000-0000-0000-000000000001";
const TRAVELLER = "72000000-0000-0000-0000-000000000002";

const setup = async (db) => {
  await db.query(
    "INSERT INTO app.users (id, auth_issuer, auth_subject, display_name) VALUES ($1, 'test', 'schedule-guide', 'Test Schedule Guide'), ($2, 'test', 'schedule-traveller', 'Test Traveller')",
    [USER, TRAVELLER],
  );
  await db.query(
    "INSERT INTO app.organizations (id, name, slug, verification) VALUES ($1, 'Test Schedule Org', 'test-schedule-org', 'verified')",
    [ORG],
  );
  await db.query(
    "INSERT INTO app.guide_profiles (user_id, tier, display_name, slug, status, organization_id) VALUES ($1, 'licensed', 'Test Schedule Guide', 'test-schedule-guide', 'approved', $2)",
    [USER, ORG],
  );
  await db.query(
    "INSERT INTO app.guide_availability (guide_profile_id, min_notice_hours, max_tours_per_day, buffer_minutes, travel_aware) SELECT id, 1, 4, 30, false FROM app.guide_profiles WHERE user_id = $1",
    [USER],
  );
  await db.query(
    "INSERT INTO app.venues (id, organization_id, name, address, location, location_source) VALUES ($1, $2, 'Test meeting point', 'Test address', ST_SetSRID(ST_MakePoint(35.5018, 33.8938), 4326)::geography, 'synthetic')",
    [VENUE, ORG],
  );
};

const tour = async (db, n) => {
  const id = `75000000-0000-0000-0000-00000000000${n}`;
  await db.query(
    "INSERT INTO app.experiences (id, organization_id, venue_id, slug, title, status, booking_mode, duration_minutes, max_party, setting) VALUES ($1, $2, $3, $4, $5, 'published', 'request', 120, 8, 'outdoor')",
    [id, ORG, VENUE, `test-schedule-tour-${n}`, `Test tour ${n}`],
  );
  return id;
};

// A schedule with one start on one day, three days from now in Beirut.
const schedule = async (db, experience, start, extra = {}) => {
  const { iso, weekday } = await one(
    db,
    "SELECT to_char(d, 'YYYY-MM-DD') AS iso, extract(isodow FROM d)::int - 1 AS weekday FROM (SELECT (now() AT TIME ZONE 'Asia/Beirut')::date + 3 AS d) x",
  );
  const payload = { weekdays: [weekday], start_times: [start], valid_from: iso, valid_to: iso, ...extra };
  return (await one(db, "SELECT app.guide_save_schedule($1, $2, $3::jsonb) AS s", [USER, experience, payload])).s;
};

const slotOf = async (db, experience) =>
  (await one(db, "SELECT id FROM app.slots WHERE experience_id = $1 ORDER BY starts_at LIMIT 1", [experience])).id;

const book = (db, experience, slot, key) =>
  db.query(
    "INSERT INTO app.bookings (customer_id, organization_id, experience_id, slot_id, party_size, status, mode, hold_until, inventory_reserved, currency, total_minor, payment_required, price_snapshot, policy_snapshot, request_key, request_hash) VALUES ($1, $2, $3, $4, 2, 'pending', 'request', now() + interval '1 day', false, 'USD', 0, false, '{}', '{}', $5, $6)",
    [TRAVELLER, ORG, experience, slot, key, `${key}-hash-0000000000`],
  );

// An expected error aborts the transaction, so each one runs inside a savepoint.
const refused = async (db, run, pattern) => {
  await db.exec("SAVEPOINT expected_refusal");
  await assert.rejects(run, pattern);
  await db.exec("ROLLBACK TO SAVEPOINT expected_refusal");
};

const clash = async (db, slot) => (await one(db, "SELECT app.guide_slot_clash($1) AS c", [slot])).c;

export async function testTourSchedules(db) {
  await db.exec("BEGIN");
  try {
    await setup(db);
    const morning = await tour(db, 1);
    const noon = await tour(db, 2);
    const evening = await tour(db, 3);

    const made = await schedule(db, morning, "10:00");
    assert.equal(made.created, 1, "one day, one start");
    assert.equal(made.mode, "shared");
    await schedule(db, noon, "12:15");
    await schedule(db, evening, "18:00", { mode: "private" });
    const [a, b, c] = [await slotOf(db, morning), await slotOf(db, noon), await slotOf(db, evening)];
    assert.equal(await clash(db, a), null);
    assert.equal(await clash(db, b), null);

    await book(db, morning, a, "schedule-key-a");
    assert.equal(await clash(db, b), "overlap", "12:15 falls inside the 30-minute buffer after 10:00-12:00");
    await refused(db, () => book(db, noon, b, "schedule-key-b"), /another tour/);

    await book(db, evening, c, "schedule-key-c");
    assert.equal(await clash(db, c), "private_taken", "a private start takes one party");

    // The daily cap counts the two booked runs.
    await db.query(
      "UPDATE app.guide_availability SET max_tours_per_day = 2 WHERE guide_profile_id = (SELECT id FROM app.guide_profiles WHERE user_id = $1)",
      [USER],
    );
    const late = await tour(db, 4);
    await schedule(db, late, "21:00");
    assert.equal(await clash(db, await slotOf(db, late)), "daily_cap");

    // A blocked hour closes a start; a block over a live booking is refused.
    const blockable = await tour(db, 5);
    await schedule(db, blockable, "06:00");
    const early = await slotOf(db, blockable);
    const starts = (await one(db, "SELECT starts_at FROM app.slots WHERE id = $1", [early])).starts_at;
    await db.query(
      "INSERT INTO app.guide_busy_blocks (guide_profile_id, period) SELECT id, tstzrange($2::timestamptz - interval '1 hour', $2::timestamptz + interval '1 hour') FROM app.guide_profiles WHERE user_id = $1",
      [USER, starts],
    );
    assert.equal(await clash(db, early), "blocked");
    const overBooking = {
      starts_at: new Date(starts.getTime() + 4 * 3600e3).toISOString(),
      ends_at: new Date(starts.getTime() + 7 * 3600e3).toISOString(),
    };
    await refused(
      db,
      () => db.query("SELECT app.guide_add_block($1, $2::jsonb)", [USER, overBooking]),
      /you have a booking in that time/,
    );

    // A changed schedule replaces empty starts and keeps the booked one.
    const changed = await one(db, "SELECT app.guide_save_schedule($1, $2, $3::jsonb) AS s", [
      USER,
      morning,
      { id: made.id, weekdays: [0, 1, 2, 3, 4, 5, 6], start_times: ["07:00"] },
    ]);
    assert.equal(changed.s.cleared, 0, "the only start was booked");
    assert.ok(changed.s.created >= 119, "the new rule fills 120 days");
    assert.equal((await one(db, "SELECT count(*)::int AS n FROM app.slots WHERE id = $1", [a])).n, 1);

    // A shared run short of its minimum group, past its deadline, is cancelled.
    const small = await tour(db, 6);
    await schedule(db, small, "15:00", { min_group: 4, min_group_deadline_hours: 168 });
    const smallSlot = await slotOf(db, small);
    await db.query(
      "UPDATE app.guide_availability SET max_tours_per_day = 8, buffer_minutes = 0 WHERE guide_profile_id = (SELECT id FROM app.guide_profiles WHERE user_id = $1)",
      [USER],
    );
    await book(db, small, smallSlot, "schedule-key-small");
    const result = (await one(db, "SELECT app.guide_min_group_check() AS r")).r;
    assert.ok(result.bookings_cancelled >= 1);
    const cancelled = await one(db, "SELECT status, reason FROM app.bookings WHERE request_key = 'schedule-key-small'");
    assert.equal(cancelled.status, "cancelled");
    assert.match(cancelled.reason, /minimum group of 4/);
  } finally {
    await db.exec("ROLLBACK");
  }
}
