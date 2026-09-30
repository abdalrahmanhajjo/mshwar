import assert from "node:assert/strict";
import { bookingGuide } from "./tour-booking.mjs";

// Guide plan step 6 (migration 065): busy time from another calendar keeps only the time,
// a failed read keeps what was known, the private feed opens only with its hash, and
// check-in and payment happen on the day.
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

const GUIDE = "79000000-0000-0000-0000-000000000001";
const TRAVELLER = "79000000-0000-0000-0000-000000000002";
const ORG = "79100000-0000-0000-0000-000000000001";
const TOUR = "79200000-0000-0000-0000-000000000001";

const refused = async (db, run, pattern) => {
  await db.exec("SAVEPOINT expected_refusal");
  await assert.rejects(run, pattern);
  await db.exec("ROLLBACK TO SAVEPOINT expected_refusal");
};

export async function testGuideWorkspace(db) {
  await db.exec("BEGIN");
  try {
    await db.query(
      "INSERT INTO app.users (id, auth_issuer, auth_subject, display_name) VALUES ($1, 'test', 'workspace-guide', 'Test Guide'), ($2, 'test', 'workspace-traveller', 'Test Traveller')",
      [GUIDE, TRAVELLER],
    );
    await bookingGuide(db, GUIDE, ORG, "licensed", TOUR, 9);
    const profile = (await one(db, "SELECT id FROM app.guide_profiles WHERE user_id = $1", [GUIDE])).id;

    // Another calendar: webcal becomes https, other schemes are refused, three at most.
    const listed = (
      await one(
        db,
        "SELECT app.guide_add_external_calendar($1, 'webcal://cal.example.com/secret/basic.ics', 'Home') AS c",
        [GUIDE],
      )
    ).c;
    assert.equal(listed.length, 1);
    assert.equal(listed[0].host, "cal.example.com");
    assert.equal(listed[0].url, undefined, "the secret address is never shown back");
    await refused(
      db,
      () => db.query("SELECT app.guide_add_external_calendar($1, 'http://cal.example.com/x.ics', '')", [GUIDE]),
      /secret address/,
    );
    await db.query("SELECT app.guide_add_external_calendar($1, 'https://cal.example.com/2.ics', '')", [GUIDE]);
    await db.query("SELECT app.guide_add_external_calendar($1, 'https://cal.example.com/3.ics', '')", [GUIDE]);
    await refused(
      db,
      () => db.query("SELECT app.guide_add_external_calendar($1, 'https://cal.example.com/4.ics', '')", [GUIDE]),
      /at most 3/,
    );
    const calendar = (
      await one(
        db,
        "SELECT id FROM app.guide_external_calendars WHERE url = 'https://cal.example.com/secret/basic.ics'",
      )
    ).id;

    // Only sensible, current periods are kept, and only their time.
    const periods = (
      await one(
        db,
        "SELECT jsonb_build_array(jsonb_build_object('starts_at', now() + interval '1 day', 'ends_at', now() + interval '1 day 2 hours'), jsonb_build_object('starts_at', now() - interval '3 days', 'ends_at', now() - interval '2 days'), jsonb_build_object('starts_at', now() + interval '2 days', 'ends_at', now() + interval '40 days'), jsonb_build_object('starts_at', now() + interval '3 days', 'ends_at', now() + interval '2 days')) AS p",
      )
    ).p;
    const kept = (await one(db, "SELECT app.guide_replace_external_blocks($1, $2::jsonb) AS n", [calendar, periods])).n;
    assert.equal(kept, 1, "past, over-long and backwards periods are dropped");
    const block = await one(db, "SELECT kind, note FROM app.guide_busy_blocks WHERE calendar_id = $1", [calendar]);
    assert.deepEqual(block, { kind: "external", note: "" });

    await db.query("SELECT app.guide_replace_external_blocks($1, '[]'::jsonb, 'the calendar answered 500')", [
      calendar,
    ]);
    const failed = await one(db, "SELECT last_status, last_error FROM app.guide_external_calendars WHERE id = $1", [
      calendar,
    ]);
    assert.deepEqual(failed, { last_status: "failed", last_error: "the calendar answered 500" });
    assert.equal(
      (await one(db, "SELECT count(*)::int AS n FROM app.guide_busy_blocks WHERE calendar_id = $1", [calendar])).n,
      1,
      "a failed read keeps the last known busy time",
    );
    await refused(
      db,
      () =>
        db.query("SELECT app.guide_delete_block($1, (SELECT id FROM app.guide_busy_blocks WHERE calendar_id = $2))", [
          GUIDE,
          calendar,
        ]),
      /not found/,
    );
    await db.query("SELECT app.guide_remove_external_calendar($1, $2)", [GUIDE, calendar]);
    assert.equal(
      (await one(db, "SELECT count(*)::int AS n FROM app.guide_busy_blocks WHERE guide_profile_id = $1", [profile])).n,
      0,
      "disconnecting a calendar frees its time",
    );

    // Migration 068: addresses arrive encrypted; a fingerprint keeps duplicates out, a
    // plain row moves to the encrypted form, and the plain entry point is closed to the API.
    const sealed = `v1.s0000.${"x".repeat(40)}`;
    const print = "f".repeat(64);
    const encrypted = (
      await one(db, "SELECT app.guide_add_external_calendar_secret($1, $2, $3, 'cal.example.org', 'Work') AS c", [
        GUIDE,
        sealed,
        print,
      ])
    ).c;
    assert.equal(encrypted.find((c) => c.label === "Work").host, "cal.example.org");
    const again = (
      await one(db, "SELECT app.guide_add_external_calendar_secret($1, $2, $3, 'cal.example.org', 'Twice') AS c", [
        GUIDE,
        sealed,
        print,
      ])
    ).c;
    assert.equal(again.length, encrypted.length, "the same calendar is not connected twice");
    await refused(
      db,
      () => db.query("SELECT app.guide_add_external_calendar_secret($1, 'https://plain', $2, 'x', '')", [GUIDE, print]),
      /secret address/,
    );
    const plain = (
      await one(db, "SELECT id FROM app.guide_external_calendars WHERE url = 'https://cal.example.com/2.ics'")
    ).id;
    await db.query("SELECT app.guide_store_calendar_secret($1, $2, $3, 'cal.example.com')", [
      plain,
      `v1.s0000.${"y".repeat(40)}`,
      "e".repeat(64),
    ]);
    const moved = await one(db, "SELECT url, url_ciphertext FROM app.guide_external_calendars WHERE id = $1", [plain]);
    assert.equal(moved.url, null, "the plain address is forgotten");
    assert.ok(moved.url_ciphertext.startsWith("v1."));
    const toSync = (await one(db, "SELECT app.guide_calendars_to_sync($1) AS c", [GUIDE])).c;
    assert.ok(toSync.some((c) => c.ciphertext === sealed && c.url === null));
    await refused(
      db,
      () =>
        db.query("INSERT INTO app.guide_external_calendars (guide_profile_id, label) VALUES ($1, 'Empty')", [profile]),
      /has_address/,
    );
    await db.exec("SAVEPOINT backend_role; SET LOCAL ROLE mshwar_backend");
    await assert.rejects(
      () => db.query("SELECT app.guide_add_external_calendar($1, 'https://cal.example.com/5.ics', '')", [GUIDE]),
      /permission denied/,
    );
    await db.exec("ROLLBACK TO SAVEPOINT backend_role; RESET ROLE");

    // A booked run two days out.
    const { iso, weekday } = await one(
      db,
      "SELECT to_char(d, 'YYYY-MM-DD') AS iso, extract(isodow FROM d)::int - 1 AS weekday FROM (SELECT (now() AT TIME ZONE 'Asia/Beirut')::date + 2 AS d) x",
    );
    await db.query("SELECT app.guide_set_booking_settings($1, $2, $3::jsonb)", [
      GUIDE,
      TOUR,
      { instant_booking: true },
    ]);
    await db.query("SELECT app.guide_save_schedule($1, $2, $3::jsonb)", [
      GUIDE,
      TOUR,
      { weekdays: [weekday], start_times: ["10:00"], valid_from: iso, valid_to: iso },
    ]);
    const slot = (await one(db, "SELECT id FROM app.slots WHERE experience_id = $1", [TOUR])).id;
    const booking = (
      await one(
        db,
        "SELECT app.tour_book($1, 'test-booking-tour-9', $2::jsonb, 'workspace-key-0001', 'workspace-hash-00000001') AS b",
        [TRAVELLER, { slot_id: slot, adults: 2 }],
      )
    ).b;
    assert.equal(booking.status, "confirmed");

    // The feed: only a 64-character hash is accepted, and only the right one opens it.
    await refused(db, () => db.query("SELECT app.guide_new_calendar_feed($1, 'short')", [GUIDE]), /invalid feed token/);
    const hash = "a".repeat(64);
    await db.query("SELECT app.guide_new_calendar_feed($1, $2)", [GUIDE, hash]);
    const feed = (await one(db, "SELECT app.guide_calendar_feed($1) AS f", [hash])).f;
    assert.equal(feed.runs.length, 1);
    assert.equal(Number(feed.runs[0].guests), 2);
    assert.equal((await one(db, "SELECT app.guide_calendar_feed($1) AS f", ["b".repeat(64)])).f, null);
    await db.query("SELECT app.guide_revoke_calendar_feed($1)", [GUIDE]);
    assert.equal((await one(db, "SELECT app.guide_calendar_feed($1) AS f", [hash])).f, null, "revoked");

    // The month view, check-in and payment on the day only, and an honest statement.
    const month = (await one(db, "SELECT app.guide_calendar($1, $2::date, $2::date) AS c", [GUIDE, iso])).c;
    assert.equal(month.slots[0].bookings[0].code, booking.code);
    await refused(
      db,
      () => db.query("SELECT app.guide_calendar($1, current_date, current_date + 90)", [GUIDE]),
      /two months/,
    );
    await refused(
      db,
      () => db.query("SELECT app.guide_check_in($1, $2, 'arrived')", [GUIDE, booking.id]),
      /on the day/,
    );
    await refused(
      db,
      () => db.query("SELECT app.guide_record_payment($1, $2, 5000, 'cash')", [GUIDE, booking.id]),
      /on the day/,
    );
    await refused(db, () => db.query("SELECT app.guide_check_in($1, $2, 'arrived')", [TRAVELLER, booking.id]), /./);
    const statement = (await one(db, "SELECT app.guide_earnings($1, $2::date) AS s", [GUIDE, iso])).s;
    assert.equal(Number(statement.fee_percent), 0, "no fee is invented");
    assert.equal(Number(statement.recorded_minor), 0);
    assert.equal(Number(statement.expected_minor), booking.total_minor);
  } finally {
    await db.exec("ROLLBACK");
  }
}
