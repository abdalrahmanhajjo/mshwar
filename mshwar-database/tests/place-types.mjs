import assert from "node:assert/strict";

// Trip builder v2, phase 2 (migration 045): kinds of place, and trusted candidates for one step.
const alice = "00000000-0000-0000-0000-000000000001"; // becomes a platform admin here
const bob = "00000000-0000-0000-0000-000000000002"; // owner of the second synthetic organisation
const org = "10000000-0000-0000-0000-000000000002";
const dest = "71000000-0000-0000-0000-000000000001";
const farDest = "71000000-0000-0000-0000-000000000002";
const venueNear = "72000000-0000-0000-0000-000000000001";
const venueMid = "72000000-0000-0000-0000-000000000002";
const venueFar = "72000000-0000-0000-0000-000000000003";
const ids = {
  bowling: "73000000-0000-0000-0000-000000000001",
  bowlingFar: "73000000-0000-0000-0000-000000000002",
  cinema: "73000000-0000-0000-0000-000000000003",
  sweets: "73000000-0000-0000-0000-000000000004",
  sweetsUnchecked: "73000000-0000-0000-0000-000000000005",
  hotel: "73000000-0000-0000-0000-000000000006",
  castle: "73000000-0000-0000-0000-000000000007",
  pausedBowling: "73000000-0000-0000-0000-000000000008",
};

async function seed(db) {
  await db.exec(`
    INSERT INTO app.destinations (id, slug, name, status) VALUES
      ('${dest}', 'pt-batroun', 'Batroun (test)', 'published'),
      ('${farDest}', 'pt-tyre', 'Tyre (test)', 'published');
    INSERT INTO app.venues (id, organization_id, destination_id, name, address, location, location_source) VALUES
      ('${venueNear}', '${org}', '${dest}', 'Near venue', 'Batroun', ST_SetSRID(ST_MakePoint(35.6590, 34.2553), 4326)::geography, 'synthetic'),
      ('${venueMid}', '${org}', '${dest}', 'Mid venue', 'Batroun', ST_SetSRID(ST_MakePoint(35.7000, 34.2800), 4326)::geography, 'synthetic'),
      ('${venueFar}', '${org}', '${farDest}', 'Far venue', 'Tyre', ST_SetSRID(ST_MakePoint(35.1960, 33.2705), 4326)::geography, 'synthetic');
    INSERT INTO app.experiences
      (id, organization_id, venue_id, slug, title, description, status, booking_mode, duration_minutes, max_party, setting,
       listing_kind, verified_level, checked_on, review_by) VALUES
      ('${ids.bowling}', '${org}', '${venueMid}', 'pt-bowling', 'Strike Lanes', 'Ten lanes', 'published', 'inquiry', 90, 12, 'indoor', 'experience', NULL, NULL, NULL),
      ('${ids.bowlingFar}', '${org}', '${venueFar}', 'pt-bowling-far', 'Tyre Lanes', 'Lanes by the sea', 'published', 'inquiry', 90, 12, 'indoor', 'experience', NULL, NULL, NULL),
      ('${ids.cinema}', '${org}', '${venueNear}', 'pt-cinema', 'Coast Cinema', 'Two screens', 'published', 'inquiry', 150, 40, 'indoor', 'experience', NULL, NULL, NULL),
      ('${ids.sweets}', '${org}', '${venueNear}', 'pt-sweets', 'Knefeh House', 'Knefeh by the sea', 'published', 'inquiry', 40, 10, 'indoor', 'restaurant', 'checked_by_mshwar', app.beirut_today(), app.beirut_today() + 180),
      ('${ids.sweetsUnchecked}', '${org}', '${venueNear}', 'pt-sweets-unchecked', 'Unchecked Sweets', 'Not visited yet', 'published', 'inquiry', 40, 10, 'indoor', 'restaurant', NULL, NULL, NULL),
      ('${ids.hotel}', '${org}', '${venueNear}', 'pt-hotel', 'Harbour Hotel', 'Twelve rooms', 'published', 'inquiry', 600, 4, 'indoor', 'hotel', 'checked_by_mshwar', app.beirut_today(), app.beirut_today() + 180),
      ('${ids.castle}', '${org}', '${venueMid}', 'pt-castle', 'Sea Castle', 'Crusader walls', 'published', 'inquiry', 60, 30, 'outdoor', 'attraction', NULL, NULL, NULL),
      ('${ids.pausedBowling}', '${org}', '${venueNear}', 'pt-bowling-paused', 'Closed Lanes', 'Paused', 'paused', 'inquiry', 90, 12, 'indoor', 'experience', NULL, NULL, NULL);
  `);
  await db.query("SELECT app.grant_platform_admin($1)", [alice]);
  const set = (id, body) =>
    db.query("SELECT app.admin_set_place_types($1, $2, $3::jsonb)", [alice, id, JSON.stringify(body)]);
  await set(ids.bowling, { place_types: ["bowling", "arcade"] });
  await set(ids.bowlingFar, { place_types: ["bowling"] });
  await set(ids.cinema, { place_types: ["cinema"], schedule_note: "Showtimes change daily; call ahead" });
  await set(ids.sweets, { place_types: ["sweets"] });
  await set(ids.sweetsUnchecked, { place_types: ["sweets"] });
  await set(ids.hotel, { place_types: ["boutique-hotel"] });
  await set(ids.pausedBowling, { place_types: ["bowling"] });
  // The castle keeps no types on purpose: an attraction still fills a "sight" step.
}

const step = async (db, body) =>
  (await db.query("SELECT app.planner_retrieve_step($1::jsonb) AS r", [JSON.stringify(body)])).rows[0].r;
const slugs = (items) => items.map((item) => item.slug);

async function rejects(db, sql, params, pattern) {
  await db.exec("BEGIN");
  try {
    await assert.rejects(db.query(sql, params), pattern);
  } finally {
    await db.exec("ROLLBACK");
  }
}

export async function testPlaceTypes(db) {
  const catalogue = (await db.query("SELECT app.place_types_json() AS j")).rows[0].j;
  assert.ok(catalogue.length >= 120, "a rich catalogue of kinds of place");
  for (const type of catalogue) {
    assert.ok(type.names.en && type.names.ar && type.names.fr, `${type.slug} is named in every language`);
    assert.ok(["meal", "sight", "activity", "stay", "service"].includes(type.role));
    if (type.role !== "meal") assert.deepEqual(type.meal_services, []);
  }
  for (const needed of ["sweets", "mountain", "bowling", "cinema", "hotel", "pharmacy", "via-ferrata", "winery"]) {
    assert.ok(
      catalogue.some((type) => type.slug === needed),
      `${needed} can be asked for`,
    );
  }
  assert.equal(catalogue.find((type) => type.slug === "cinema").needs_schedule, true);

  await seed(db);

  // A step asks for a kind of place and gets only that kind.
  assert.deepEqual(slugs(await step(db, { role: "activity", tags: ["bowling"], destination_slugs: ["pt-batroun"] })), [
    "pt-bowling",
  ]);
  // Paused listings never appear; nothing is invented when nothing fits.
  assert.deepEqual(slugs(await step(db, { role: "activity", tags: ["escape-room"] })), []);
  assert.ok(!slugs(await step(db, { role: "activity", tags: ["bowling"] })).includes("pt-bowling-paused"));

  // Meals come from checked venues only, and must serve the meal asked for.
  const breakfast = await step(db, { role: "meal", meal: "breakfast", tags: ["sweets"] });
  assert.deepEqual(slugs(breakfast), ["pt-sweets"]);
  assert.equal(breakfast[0].trust.level, "checked_by_mshwar");
  assert.deepEqual(breakfast[0].meal_services, ["breakfast"]);
  assert.deepEqual(slugs(await step(db, { role: "meal", meal: "dinner", tags: ["sweets"] })), []);
  await db.query("SELECT app.admin_set_place_types($1, $2, $3::jsonb)", [
    alice,
    ids.sweets,
    JSON.stringify({ place_types: ["sweets", "cafe"], meal_services: ["breakfast", "dinner"] }),
  ]);
  const dinner = await step(db, { role: "meal", meal: "dinner", tags: ["sweets"] });
  assert.deepEqual(slugs(dinner), ["pt-sweets"]);
  assert.equal(dinner[0].meal_unconfirmed, false);

  // Soft tags (a view, a sunset) rank but never exclude.
  assert.deepEqual(slugs(await step(db, { role: "meal", tags: ["sweets", "sea-view"] })), ["pt-sweets"]);

  // A listing without types still fills the role its listing kind implies.
  assert.deepEqual(slugs(await step(db, { role: "sight", destination_slugs: ["pt-batroun"] })), ["pt-castle"]);

  // Near a point: inside the radius only, nearest first.
  const near = { lat: 34.2553, lng: 35.659, radius_m: 20000 };
  assert.deepEqual(slugs(await step(db, { role: "activity", tags: ["bowling"], near })), ["pt-bowling"]);
  const wide = await step(db, { role: "activity", tags: ["bowling"], near: { ...near, radius_m: 150000 } });
  assert.deepEqual(slugs(wide), ["pt-bowling", "pt-bowling-far"]);
  assert.ok(wide[0].distance_m < wide[1].distance_m);
  assert.deepEqual(
    slugs(
      await step(db, {
        role: "activity",
        tags: ["bowling"],
        near: { ...near, radius_m: 150000 },
        exclude_ids: [ids.bowling],
      }),
    ),
    ["pt-bowling-far"],
  );

  // Films carry the schedule caveat; stays come back with their check.
  const films = await step(db, { role: "activity", tags: ["cinema"] });
  assert.equal(films[0].needs_schedule, true);
  assert.match(films[0].schedule_note, /call ahead/);
  const nights = await step(db, { role: "stay", tags: ["hotel", "boutique-hotel"] });
  assert.deepEqual(slugs(nights), ["pt-hotel"]);

  // Bad steps are refused with a clear reason.
  await rejects(
    db,
    "SELECT app.planner_retrieve_step($1::jsonb)",
    [JSON.stringify({ role: "booking" })],
    /unknown step role/,
  );
  await rejects(
    db,
    "SELECT app.planner_retrieve_step($1::jsonb)",
    [JSON.stringify({ role: "meal", meal: "feast" })],
    /unknown meal/,
  );
  await rejects(
    db,
    "SELECT app.planner_retrieve_step($1::jsonb)",
    [JSON.stringify({ role: "sight", near: { lat: 34 } })],
    /lat and lng/,
  );
  await rejects(
    db,
    "SELECT app.planner_retrieve_step($1::jsonb)",
    [JSON.stringify({ role: "sight", exclude_ids: ["x"] })],
    /listing ids/,
  );

  // Setting types: a meal or a night is always a checked venue; types are known; 1-6; first is primary.
  const setAs = (user, id, body) =>
    db.query("SELECT app.admin_set_place_types($1, $2, $3::jsonb)", [user, id, JSON.stringify(body)]);
  await rejects(
    db,
    "SELECT app.admin_set_place_types($1, $2, $3::jsonb)",
    [alice, ids.sweets, JSON.stringify({ place_types: ["bowling"] })],
    /does not fit/,
  );
  await rejects(
    db,
    "SELECT app.admin_set_place_types($1, $2, $3::jsonb)",
    [alice, ids.castle, JSON.stringify({ place_types: ["sweets"] })],
    /does not fit/,
  );
  await rejects(
    db,
    "SELECT app.admin_set_place_types($1, $2, $3::jsonb)",
    [alice, ids.castle, JSON.stringify({ place_types: ["space-station"] })],
    /unknown kind of place/,
  );
  await rejects(
    db,
    "SELECT app.admin_set_place_types($1, $2, $3::jsonb)",
    [alice, ids.castle, JSON.stringify({ place_types: [] })],
    /between one and six/,
  );
  await rejects(
    db,
    "SELECT app.admin_set_place_types($1, $2, $3::jsonb)",
    [alice, ids.castle, JSON.stringify({ place_types: ["castle"], meal_services: ["dinner"] })],
    /only a restaurant/,
  );
  const castle = (await setAs(alice, ids.castle, { place_types: ["castle", "viewpoint", "castle"] })).rows[0]
    .admin_set_place_types;
  assert.deepEqual(castle.place_types, ["castle", "viewpoint"]);
  assert.deepEqual(castle.roles, ["sight"]);
  const swapped = (await setAs(alice, ids.castle, { place_types: ["viewpoint"] })).rows[0].admin_set_place_types;
  assert.deepEqual(swapped.place_types, ["viewpoint"]);

  // Every change is audited.
  const audited = (
    await db.query("SELECT count(*)::int AS n FROM app.audit_log WHERE table_name = 'experience_place_types'")
  ).rows[0].n;
  assert.ok(audited >= 10);

  // Only admins and the listing's own organisation may set types.
  await rejects(
    db,
    "SELECT app.admin_set_place_types($1, $2, $3::jsonb)",
    [bob, ids.castle, JSON.stringify({ place_types: ["castle"] })],
    /admin role required/,
  );
  const owned = (
    await db.query("SELECT app.portal_set_place_types($1, $2, $3, $4::jsonb) AS j", [
      bob,
      org,
      ids.castle,
      JSON.stringify({ place_types: ["castle"] }),
    ])
  ).rows[0].j;
  assert.deepEqual(owned.place_types, ["castle"]);
  await rejects(
    db,
    "SELECT app.portal_set_place_types($1, $2, $3, $4::jsonb)",
    [alice, org, ids.castle, JSON.stringify({ place_types: ["castle"] })],
    /capability denied/,
  );
  await rejects(
    db,
    "SELECT app.portal_set_place_types($1, $2, $3, $4::jsonb)",
    [bob, "10000000-0000-0000-0000-000000000001", ids.castle, JSON.stringify({ place_types: ["castle"] })],
    /capability denied|listing not found/,
  );

  // Coverage counts only places the planner may use.
  const coverage = (await db.query("SELECT app.admin_place_type_coverage($1) AS j", [alice])).rows[0].j;
  const batroun = coverage.destinations.find((d) => d.slug === "pt-batroun");
  assert.equal(batroun.types.bowling, 1);
  assert.equal(batroun.types.sweets, 1, "the unchecked sweets shop does not count");

  // The API role can plan but cannot read or write the tables, or skip the checks.
  await db.exec("BEGIN; SET LOCAL ROLE mshwar_backend");
  try {
    assert.ok((await step(db, { role: "activity", tags: ["bowling"] })).length >= 1);
    for (const [sql, params] of [
      ["SELECT * FROM app.experience_place_types", []],
      ["SELECT app.set_place_types_unchecked($1, '{}'::jsonb)", [ids.castle]],
    ]) {
      await db.exec("SAVEPOINT denied");
      await assert.rejects(db.query(sql, params), /permission denied/);
      await db.exec("ROLLBACK TO SAVEPOINT denied");
    }
  } finally {
    await db.exec("ROLLBACK");
  }
}
