import assert from "node:assert/strict";

// Candidate phrases, batch review and releases (migration 050). Alice is a platform admin.
const alice = "00000000-0000-0000-0000-000000000001";
const bob = "00000000-0000-0000-0000-000000000002";

const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

async function rejects(db, sql, params, pattern) {
  await db.exec("BEGIN");
  try {
    await assert.rejects(db.query(sql, params), pattern);
  } finally {
    await db.exec("ROLLBACK");
  }
}

const importing = () => "SELECT app.admin_import_phrase_candidates($1, $2::jsonb) AS j";

export async function testPhraseCandidates(db) {
  const live = async () => (await one(db, "SELECT app.planner_intent_phrases() AS j")).j.map((p) => p.phrase);
  const before = await live();

  // Import: invalid rows counted, duplicates inside the file collapsed, nothing goes live.
  const items = [
    { phrase: "7elwayet", concept: "sweets", locale: "arabizi", batch: "seed-v1" },
    { phrase: "7ELWAYET", concept: "sweets", locale: "arabizi", batch: "seed-v1" },
    {
      phrase: "7elwiyet",
      concept: "sweets",
      locale: "arabizi",
      source: "generated_variant",
      batch: "seed-v1",
      variant_of: "7elwayet",
      note: "vowel",
    },
    { phrase: "cine", concept: "cinema", locale: "fr", batch: "seed-v1" },
    { phrase: "bad", concept: "Not A Slug", locale: "en", batch: "seed-v1" },
    { phrase: "bad", concept: "cinema", locale: "klingon", batch: "seed-v1" },
    { phrase: "sneaky", concept: "cinema", locale: "en", source: "staff", batch: "seed-v1" },
  ];
  const first = (await one(db, importing(), [alice, JSON.stringify(items)])).j;
  assert.deepEqual(first, { created: 3, known: 0, invalid: 4 });
  assert.deepEqual(await live(), before, "a candidate is never read by the planner");
  const again = (await one(db, importing(), [alice, JSON.stringify(items.slice(0, 4))])).j;
  assert.deepEqual(again, { created: 0, known: 3, invalid: 1 }, "a known phrase is never imported twice");
  await rejects(db, importing(), [bob, JSON.stringify(items)], /admin role required/);

  const batches = (await one(db, "SELECT app.admin_phrase_batches($1) AS j", [alice])).j;
  const seed = batches.find((b) => b.batch === "seed-v1");
  assert.deepEqual([seed.candidate, seed.approved, seed.rejected], [3, 0, 0]);
  assert.deepEqual(Object.keys(seed.locales).sort(), ["arabizi", "fr"]);

  const page = (
    await one(db, "SELECT app.admin_list_phrase_candidates($1, $2::jsonb) AS j", [
      alice,
      JSON.stringify({ batch: "seed-v1", concept: "sweets", limit: 1 }),
    ])
  ).j;
  assert.equal(page.total, 2);
  assert.equal(page.items.length, 1);
  const all = (
    await one(db, "SELECT app.admin_list_phrase_candidates($1, $2::jsonb) AS j", [
      alice,
      JSON.stringify({ batch: "seed-v1" }),
    ])
  ).j.items;
  const id = (phrase) => all.find((p) => p.phrase === phrase).id;
  assert.equal(all.find((p) => p.phrase === "7elwiyet").variant_of, "7elwayet");

  // Review: approve two (they go live), reject one (never imported again).
  const approved = (
    await one(db, "SELECT app.admin_review_phrase_candidates($1, $2::jsonb) AS j", [
      alice,
      JSON.stringify({ decision: "approve", ids: [id("7elwayet"), id("7elwiyet")] }),
    ])
  ).j;
  assert.deepEqual(approved, { approved: 2, rejected: 0, duplicates: 0 });
  assert.ok((await live()).includes("7elwayet"));
  await one(db, "SELECT app.admin_review_phrase_candidates($1, $2::jsonb) AS j", [
    alice,
    JSON.stringify({ decision: "reject", ids: [id("cine")] }),
  ]);
  const third = (await one(db, importing(), [alice, JSON.stringify([items[3]])])).j;
  assert.equal(third.created, 0, "a rejected phrase stays rejected");
  await rejects(
    db,
    "SELECT app.admin_review_phrase_candidates($1, $2::jsonb)",
    [alice, JSON.stringify({ decision: "maybe", ids: [id("cine")] })],
    /approve or reject/,
  );
  await rejects(
    db,
    "SELECT app.admin_review_phrase_candidates($1, $2::jsonb)",
    [alice, JSON.stringify({ decision: "approve", ids: [] })],
    /between 1 and 1,000/,
  );

  // Releases: numbered, with the eval results and a checksum of exactly what is live.
  await rejects(db, "SELECT app.admin_release_intent_data($1, $2::jsonb)", [alice, "{}"], /eval results/);
  const v1 = (
    await one(db, "SELECT app.admin_release_intent_data($1, $2::jsonb) AS j", [
      alice,
      JSON.stringify({ note: "first seed", metrics: { case_accuracy: 1 } }),
    ])
  ).j;
  assert.equal(v1.name, `intent-data-v${v1.version}`);
  const releases = (await one(db, "SELECT app.admin_intent_data_releases($1) AS j", [alice])).j;
  assert.equal(releases.current_checksum, v1.checksum, "nothing changed since the release");
  assert.equal(releases.releases[0].version, v1.version);
  await rejects(db, "SELECT app.admin_intent_data_releases($1)", [bob], /admin role required/);
}
