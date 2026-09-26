import assert from "node:assert/strict";

// Two-step sign-in for the console (migration 052). Alice is a platform admin; Bob is not.
const alice = "00000000-0000-0000-0000-000000000001";
const bob = "00000000-0000-0000-0000-000000000002";
// A fake, low-entropy key: valid base32, never mistaken for a real credential.
const secret = "ABCD".repeat(8);

const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

async function rejects(db, sql, params, pattern) {
  await db.exec("BEGIN");
  try {
    await assert.rejects(db.query(sql, params), pattern);
  } finally {
    await db.exec("ROLLBACK");
  }
}

export async function testAdminTwoStep(db) {
  const state = async (session) => (await one(db, "SELECT app.admin_mfa_state($1, $2) AS j", [alice, session])).j;
  const session = (await one(db, "SELECT gen_random_uuid() AS id")).id;
  await one(
    db,
    "INSERT INTO app.sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, now() + interval '1 day')",
    [session, alice, `two-step-${session}`],
  );
  assert.deepEqual(await state(session), { enrolled: false, verified: false, verified_until: null });
  await rejects(db, "SELECT app.admin_mfa_state($1, $2)", [bob, session], /admin role required/);

  // Set up the authenticator (the API matched the code to step 100), then verify with a later step.
  await one(db, "SELECT app.security_totp_begin($1, $2)", [alice, secret]);
  await one(db, "SELECT app.security_totp_confirm($1, 100)", [alice]);
  assert.equal((await state(session)).enrolled, true);
  await rejects(db, "SELECT app.admin_mfa_verify($1, $2, 100)", [alice, session], /already used/);
  const verified = (await one(db, "SELECT app.admin_mfa_verify($1, $2, 101) AS j", [alice, session])).j;
  assert.equal(verified.verified, true);
  const other = (await one(db, "SELECT gen_random_uuid() AS id")).id;
  assert.equal((await state(other)).verified, false, "verification belongs to the session that entered the code");
  await rejects(db, "SELECT app.admin_mfa_verify($1, NULL, 102)", [alice], /sign in again/);

  // Resetting: never your own, only by an elevated admin, with a reason; it ends the admin's sessions.
  await rejects(db, "SELECT app.admin_reset_mfa($1, $1, 'lost my phone at sea')", [alice], /another elevated admin/);
  await rejects(db, "SELECT app.admin_reset_mfa($1, $2, 'lost my phone at sea')", [bob, alice], /admin/);
}
