import assert from "node:assert/strict";

// Guide plan step 3 (migration 062): a tour booking is priced only from what the guide
// published, a host's extras stay free, and a late cancellation is recorded as late.
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

const GUIDE = "76000000-0000-0000-0000-000000000001";
const HOST = "76000000-0000-0000-0000-000000000002";
const TRAVELLER = "76000000-0000-0000-0000-000000000003";
const ORG = "77000000-0000-0000-0000-000000000001";
const HOST_ORG = "77000000-0000-0000-0000-000000000002";
const TOUR = "78000000-0000-0000-0000-000000000001";
const HOST_TOUR = "78000000-0000-0000-0000-000000000002";

const refused = async (db, run, pattern) => {
  await db.exec("SAVEPOINT expected_refusal");
  await assert.rejects(run, pattern);
  await db.exec("ROLLBACK TO SAVEPOINT expected_refusal");
};

const guide = async (db, user, org, tier, tour, n) => {
  await db.query("INSERT INTO app.organizations (id, name, slug, verification) VALUES ($1, $2, $3, 'verified')", [
    org,
    `Test Booking Org ${n}`,
    `test-booking-org-${n}`,
  ]);
  await db.query(
    "INSERT INTO app.guide_profiles (user_id, tier, display_name, slug, status, organization_id) VALUES ($1, $2, $3, $4, 'approved', $5)",
    [user, tier, `Test Booking Guide ${n}`, `test-booking-guide-${n}`, org],
  );
  await db.query(
    "INSERT INTO app.guide_availability (guide_profile_id, min_notice_hours, max_tours_per_day, buffer_minutes, travel_aware) SELECT id, 1, 4, 0, false FROM app.guide_profiles WHERE user_id = $1",
    [user],
  );
  const venue = (
    await one(
      db,
      "INSERT INTO app.venues (organization_id, name, address, location, location_source) VALUES ($1, 'Test meeting point', 'Test address', ST_SetSRID(ST_MakePoint(35.6478, 34.1211), 4326)::geography, 'synthetic') RETURNING id",
      [org],
    )
  ).id;
  await db.query(
    "INSERT INTO app.experiences (id, organization_id, venue_id, slug, title, status, booking_mode, duration_minutes, max_party, setting) VALUES ($1, $2, $3, $4, $5, 'draft', 'request', 120, 8, 'outdoor')",
    [tour, org, venue, `test-booking-tour-${n}`, `Test booking tour ${n}`],
  );
  await db.query(
    "INSERT INTO app.price_rules (experience_id, currency, price_type, unit, amount_minor, valid_during, source) VALUES ($1, 'USD', 'fixed', 'person', $2, '(,)', 'synthetic')",
    [tour, tier === "host" ? 0 : 2500],
  );
  await db.query(
    "INSERT INTO app.policies (experience_id, version, cancellation_rules, terms_text) VALUES ($1, 1, '{}', 'Synthetic policy')",
    [tour],
  );
  await db.query("INSERT INTO app.guide_tours (experience_id, languages) VALUES ($1, ARRAY['en', 'ar'])", [tour]);
  await db.query("UPDATE app.experiences SET status = 'published' WHERE id = $1", [tour]);
};

export async function testTourBooking(db) {
  await db.exec("BEGIN");
  try {
    await db.query(
      "INSERT INTO app.users (id, auth_issuer, auth_subject, display_name) VALUES ($1, 'test', 'booking-guide', 'Test Guide'), ($2, 'test', 'booking-host', 'Test Host'), ($3, 'test', 'booking-traveller', 'Test Traveller')",
      [GUIDE, HOST, TRAVELLER],
    );
    await guide(db, GUIDE, ORG, "licensed", TOUR, 1);
    await guide(db, HOST, HOST_ORG, "host", HOST_TOUR, 2);

    // A host's extras and child price stay free, from the function and from a direct write.
    await refused(
      db,
      () =>
        db.query("SELECT app.guide_set_booking_settings($1, $2, $3::jsonb)", [
          HOST,
          HOST_TOUR,
          { addons: [{ name: "Lunch", price_minor: 800 }] },
        ]),
      /cannot charge/,
    );
    await refused(
      db,
      () =>
        db.query("INSERT INTO app.tour_addons (experience_id, name, price_minor) VALUES ($1, 'Lunch', 800)", [
          HOST_TOUR,
        ]),
      /cannot charge/,
    );
    await refused(
      db,
      () => db.query("UPDATE app.guide_tours SET child_price_minor = 500 WHERE experience_id = $1", [HOST_TOUR]),
      /cannot charge/,
    );

    const terms = (
      await one(db, "SELECT app.guide_set_booking_settings($1, $2, $3::jsonb) AS t", [
        GUIDE,
        TOUR,
        {
          instant_booking: true,
          policy: "moderate",
          child_price_minor: 1500,
          addons: [
            { name: "Pickup", price_minor: 1000, unit: "booking" },
            { name: "Tasting", price_minor: 500, unit: "person" },
          ],
        },
      ])
    ).t;
    assert.equal(terms.free_cancel_hours, 72);
    const [pickup, tasting] = terms.addons;

    // A start two days out: a moderate policy's free window (3 days) has already closed.
    const { iso, weekday } = await one(
      db,
      "SELECT to_char(d, 'YYYY-MM-DD') AS iso, extract(isodow FROM d)::int - 1 AS weekday FROM (SELECT (now() AT TIME ZONE 'Asia/Beirut')::date + 2 AS d) x",
    );
    await db.query("SELECT app.guide_save_schedule($1, $2, $3::jsonb)", [
      GUIDE,
      TOUR,
      { weekdays: [weekday], start_times: ["10:00"], valid_from: iso, valid_to: iso },
    ]);
    const slot = (await one(db, "SELECT id FROM app.slots WHERE experience_id = $1", [TOUR])).id;

    await db.query("SELECT set_config('app.user_id', $1, true)", [TRAVELLER]);
    const booking = (
      await one(
        db,
        "SELECT app.tour_book($1, 'test-booking-tour-1', $2::jsonb, 'booking-key-0001', 'booking-hash-000000001') AS b",
        [TRAVELLER, { slot_id: slot, adults: 2, children: 1, addons: [pickup.id, tasting.id], language: "en" }],
      )
    ).b;
    assert.equal(booking.status, "confirmed", "instant");
    assert.equal(booking.total_minor, 2 * 2500 + 1500 + 1000 + 3 * 500, "only published prices");
    assert.match(booking.code, /^MSH-[A-HJ-NP-Z2-9]{6}$/);
    const counted = await one(db, "SELECT reserved FROM app.slots WHERE id = $1", [slot]);
    assert.equal(counted.reserved, 3, "the seats are counted");

    await refused(
      db,
      () =>
        db.query(
          "SELECT app.tour_book($1, 'test-booking-tour-1', $2::jsonb, 'booking-key-0002', 'booking-hash-000000002')",
          [TRAVELLER, { slot_id: slot, adults: 1, language: "de" }],
        ),
      /language/,
    );

    const cancelled = (
      await one(db, "SELECT app.tour_cancel($1, $2, 'Our flight moved') AS c", [TRAVELLER, booking.id])
    ).c;
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.cancelled_by, "traveller");
    assert.equal(cancelled.late_cancellation, true, "inside the moderate policy's three days");
    assert.equal((await one(db, "SELECT reserved FROM app.slots WHERE id = $1", [slot])).reserved, 0);

    // Step 4 (063): the marketplace lists the tour with real data only.
    await db.query("SELECT app.guide_set_tour_content($1, $2, $3::jsonb)", [
      GUIDE,
      TOUR,
      { highlights: ["The old port", "x"], faq: [{ question: "Is it steep?", answer: "No." }], accessibility: "Flat" },
    ]);
    const search = (await one(db, "SELECT app.public_tours_search($1::jsonb) AS s", [{ q: "Test booking tour 1" }])).s;
    assert.deepEqual(
      search.tours.map((card) => card.slug),
      ["test-booking-tour-1"],
    );
    assert.deepEqual(search.tours[0].rating, { count: 0, average: null }, "no reviews, no rating");
    assert.equal(search.tours[0].photo, null, "no approved photo, none shown");
    const page = (await one(db, "SELECT app.public_tour('test-booking-tour-1') AS p")).p;
    assert.deepEqual(page.highlights, ["The old port"], "a one-letter highlight is dropped");
    assert.equal(page.faq[0].answer, "No.");
    await db.query("UPDATE app.experiences SET status = 'draft' WHERE id = $1", [TOUR]);
    const hidden = (await one(db, "SELECT app.public_tours_search($1::jsonb) AS s", [{ q: "Test booking tour 1" }])).s;
    assert.equal(hidden.total, 0, "a draft is never listed");
  } finally {
    await db.exec("ROLLBACK");
  }
}
