import assert from "node:assert/strict";

// Demand gaps and the language dataset (migration 048). Alice is a platform admin (place-types.mjs).
const alice = "00000000-0000-0000-0000-000000000001";
const bob = "00000000-0000-0000-0000-000000000002";
// A traveller of this test's own, so consent changes here never touch other suites' users.
const carol = "00000000-0000-0000-0000-0000000000c3";

const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

async function rejects(db, sql, params, pattern) {
  await db.exec("BEGIN");
  try {
    await assert.rejects(db.query(sql, params), pattern);
  } finally {
    await db.exec("ROLLBACK");
  }
}

export async function testPlannerData(db) {
  // Gaps: counted per kind, where and why; bad entries skipped, never an error.
  const gaps = [
    { destination_slug: "bsharri", role: "activity", tags: ["bowling"], meal: null, reason: "no_trusted_match" },
    { destination_slug: "bsharri", role: "activity", tags: ["bowling"], meal: null, reason: "no_trusted_match" },
    { destination_slug: "batroun", role: "meal", tags: [], meal: "dinner", reason: "closed_that_day" },
    { destination_slug: "x", role: "spaceship", tags: [], reason: "no_trusted_match" },
    { destination_slug: "x", role: "sight", tags: ["Not A Slug"], reason: "no_trusted_match" },
  ];
  assert.equal((await one(db, "SELECT app.planner_record_step_gaps($1::jsonb) AS n", [JSON.stringify(gaps)])).n, 3);
  const report = (await one(db, "SELECT app.admin_step_gaps($1, 30) AS j", [alice])).j;
  assert.deepEqual(report[0], {
    destination_slug: "bsharri",
    role: "activity",
    tag: "bowling",
    meal: "",
    reason: "no_trusted_match",
    count: 2,
  });
  await rejects(db, "SELECT app.admin_step_gaps($1, 30)", [bob], /admin role required/);

  // Misses: nothing without consent; redacted text only; no user kept.
  const fragments = JSON.stringify(["something fun", "call me on 03123456", "mail me@x.com", "something fun"]);
  await db.query(
    "INSERT INTO app.users (id, auth_issuer, auth_subject, display_name) VALUES ($1, 'test', 'carol', 'Test Carol')",
    [carol],
  );
  await db.query(
    "INSERT INTO app.user_private (user_id, personalization_consent) VALUES ($1, false) ON CONFLICT (user_id) DO UPDATE SET personalization_consent = false",
    [carol],
  );
  assert.equal(
    (await one(db, "SELECT app.planner_record_intent_misses($1, $2::jsonb, 'en') AS n", [carol, fragments])).n,
    0,
  );
  await db.query("UPDATE app.user_private SET personalization_consent = true WHERE user_id = $1", [carol]);
  assert.equal(
    (await one(db, "SELECT app.planner_record_intent_misses($1, $2::jsonb, 'en') AS n", [carol, fragments])).n,
    2,
  );
  const misses = (await one(db, "SELECT app.admin_intent_misses($1, 'open') AS j", [alice])).j;
  assert.deepEqual(
    misses.map((miss) => [miss.fragment, miss.count]),
    [["something fun", 2]],
  );
  const columns = (
    await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'intent_misses'")
  ).rows.map((row) => row.column_name);
  assert.ok(!columns.includes("user_id"), "misses never say who wrote them");

  // Review: a miss becomes an approved phrase the planner reads with; or it is dismissed.
  const reviewed = (
    await one(db, "SELECT app.admin_review_intent_miss($1, $2, $3::jsonb) AS j", [
      alice,
      misses[0].id,
      JSON.stringify({ decision: "phrase", phrase: "something fun", concept: "amusement-park", locale: "en" }),
    ])
  ).j;
  assert.equal(reviewed.status, "resolved");
  const phrases = (await one(db, "SELECT app.planner_intent_phrases() AS j")).j;
  assert.deepEqual(phrases, [{ phrase: "something fun", concept: "amusement-park", locale: "en" }]);
  await rejects(
    db,
    "SELECT app.admin_add_intent_phrase($1, $2::jsonb)",
    [alice, JSON.stringify({ phrase: "Something Fun", concept: "amusement-park", locale: "en" })],
    /already means this/,
  );
  await rejects(
    db,
    "SELECT app.admin_add_intent_phrase($1, $2::jsonb)",
    [bob, JSON.stringify({ phrase: "x", concept: "cinema", locale: "en" })],
    /admin role required/,
  );
  await db.query("SELECT app.admin_retire_intent_phrase($1, $2)", [alice, reviewed.phrase.id]);
  assert.deepEqual((await one(db, "SELECT app.planner_intent_phrases() AS j")).j, []);

  // Retention: stale misses and year-old gaps go.
  await db.query(
    "INSERT INTO app.intent_misses (fragment, last_seen) VALUES ('an old wish', now() - interval '100 days')",
  );
  await db.query(
    "INSERT INTO app.planner_step_gaps (day, role, reason) VALUES (app.beirut_today() - 400, 'sight', 'no_trusted_match')",
  );
  const swept = (await one(db, "SELECT app.planner_data_sweep() AS j")).j;
  assert.deepEqual(swept, { intent_misses_deleted: 1, step_gaps_deleted: 1 });

  // The API role reads approved phrases and records, but cannot read the tables.
  await db.exec("BEGIN; SET LOCAL ROLE mshwar_backend");
  try {
    await db.query("SELECT app.planner_intent_phrases()");
    await assert.rejects(db.query("SELECT * FROM app.intent_misses"), /permission denied/);
  } finally {
    await db.exec("ROLLBACK");
  }
}
