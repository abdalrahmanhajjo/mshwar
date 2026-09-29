import assert from "node:assert/strict";
import { bookingGuide } from "./tour-booking.mjs";

// Guide plan step 7 (migration 066): levels follow the public thresholds, the score has a
// fair prior, a late guide cancellation is a strike, and a paused guide takes no bookings.
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

const GUIDE = "7a000000-0000-0000-0000-000000000001";
const TRAVELLER = "7a000000-0000-0000-0000-000000000002";
const ORG = "7a100000-0000-0000-0000-000000000001";
const TOUR = "7a200000-0000-0000-0000-000000000001";

const refused = async (db, run, pattern) => {
  await db.exec("SAVEPOINT expected_refusal");
  await assert.rejects(run, pattern);
  await db.exec("ROLLBACK TO SAVEPOINT expected_refusal");
};

const stats = (overrides = {}) => ({
  completed_runs: 0,
  recent_runs: 0,
  reviews: 0,
  rating: null,
  requests_due: 0,
  answered_24h_rate: null,
  median_response_minutes: null,
  requests_accepted: 0,
  bookings_held: 0,
  guide_cancellations: 0,
  cancel_rate: 0,
  completeness: 1,
  approved_at: null,
  ...overrides,
});

export async function testGuideQuality(db) {
  const earned = async (s) => (await one(db, "SELECT app.guide_level_earned($1::jsonb) AS l", [stats(s)])).l;
  assert.equal(await earned({}), "new");
  assert.equal(await earned({ completed_runs: 5, rating: 4.6 }), "trusted", "no requests: nothing to be slow on");
  assert.equal(await earned({ completed_runs: 5, rating: 4.6, requests_due: 3, answered_24h_rate: 0.5 }), "new");
  assert.equal(await earned({ completed_runs: 25, rating: 4.9 }), "top");
  assert.equal(await earned({ completed_runs: 25, rating: 4.9, cancel_rate: 0.03 }), "trusted");

  const part = async (s) => (await one(db, "SELECT app.guide_rank_parts($1::jsonb, 'new') AS p", [stats(s)])).p;
  const few = await part({ reviews: 2, rating: 5 });
  const many = await part({ reviews: 80, rating: 4.9 });
  assert.ok(Number(many.parts.review) > Number(few.parts.review), "two 5-star reviews do not beat eighty at 4.9");

  await db.exec("BEGIN");
  try {
    await db.query(
      "INSERT INTO app.users (id, auth_issuer, auth_subject, display_name) VALUES ($1, 'test', 'quality-guide', 'Test Guide'), ($2, 'test', 'quality-traveller', 'Test Traveller')",
      [GUIDE, TRAVELLER],
    );
    await bookingGuide(db, GUIDE, ORG, "licensed", TOUR, 11);
    const profile = (await one(db, "SELECT id FROM app.guide_profiles WHERE user_id = $1", [GUIDE])).id;
    await db.query("SELECT app.guide_set_booking_settings($1, $2, $3::jsonb)", [
      GUIDE,
      TOUR,
      { instant_booking: true },
    ]);
    const { iso, weekday } = await one(
      db,
      "SELECT to_char(d, 'YYYY-MM-DD') AS iso, extract(isodow FROM d)::int - 1 AS weekday FROM (SELECT (now() AT TIME ZONE 'Asia/Beirut')::date + 2 AS d) x",
    );
    await db.query("SELECT app.guide_save_schedule($1, $2, $3::jsonb)", [
      GUIDE,
      TOUR,
      { weekdays: [weekday], start_times: ["10:00", "16:00"], valid_from: iso, valid_to: iso },
    ]);
    const slots = (await db.query("SELECT id FROM app.slots WHERE experience_id = $1 ORDER BY starts_at", [TOUR])).rows;
    const booking = (
      await one(
        db,
        "SELECT app.tour_book($1, 'test-booking-tour-11', $2::jsonb, 'quality-key-0001', 'quality-hash-00000001') AS b",
        [TRAVELLER, { slot_id: slots[0].id, adults: 1 }],
      )
    ).b;
    assert.equal(booking.status, "confirmed");

    // Cancelling two days before the start is a late cancellation: one strike, a warning.
    await db.query("SELECT app.tour_cancel($1, $2, 'I am unwell')", [GUIDE, booking.id]);
    const strikes = await one(
      db,
      "SELECT count(*)::int AS n, bool_and(created_by IS NULL) AS automatic FROM app.guide_strikes WHERE guide_profile_id = $1",
      [profile],
    );
    assert.deepEqual(strikes, { n: 1, automatic: true });
    assert.equal((await one(db, "SELECT app.guide_active_strikes($1) AS n", [profile])).n, 1);

    // A paused guide takes no new bookings.
    await db.query("UPDATE app.guide_profiles SET paused_until = now() + interval '1 day' WHERE id = $1", [profile]);
    await refused(
      db,
      () =>
        db.query(
          "SELECT app.tour_book($1, 'test-booking-tour-11', $2::jsonb, 'quality-key-0002', 'quality-hash-00000002')",
          [TRAVELLER, { slot_id: slots[1].id, adults: 1 }],
        ),
      /not taking new bookings/,
    );

    // Nightly levels: a new guide with a neutral score.
    const run = (await one(db, "SELECT app.guide_recompute_levels() AS r")).r;
    assert.ok(run.guides >= 1);
    const level = await one(db, "SELECT level, score FROM app.guide_levels WHERE guide_profile_id = $1", [profile]);
    assert.equal(level.level, "new");
    assert.ok(Number(level.score) > 0);
  } finally {
    await db.exec("ROLLBACK");
  }
}
