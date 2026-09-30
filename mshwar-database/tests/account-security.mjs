import assert from "node:assert/strict";

// Security plan SEC-22, SEC-24, SEC-25, SEC-63 (migration 067): a password change signs out
// every other session and voids reset links; an email change needs a fresh, unused link and
// never takes another account's address; the nightly purge deletes old sessions.
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

const ANA = "7b000000-0000-0000-0000-000000000001";
const BOB = "7b000000-0000-0000-0000-000000000002";
const HASH = "$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHQ$aGFzaGhhc2hoYXNoaGFzaA";

const refused = async (db, run, pattern) => {
  await db.exec("SAVEPOINT expected_refusal");
  await assert.rejects(run, pattern);
  await db.exec("ROLLBACK TO SAVEPOINT expected_refusal");
};

export async function testAccountSecurity(db) {
  await db.exec("BEGIN");
  try {
    await db.query(
      "INSERT INTO app.users (id, auth_issuer, auth_subject, display_name, status) VALUES ($1, 'local', 'ana', 'Ana', 'active'), ($2, 'local', 'bob', 'Bob', 'active')",
      [ANA, BOB],
    );
    await db.query(
      "INSERT INTO app.user_private (user_id, email) VALUES ($1, 'ana@example.com'), ($2, 'bob@example.com') ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email",
      [ANA, BOB],
    );
    await db.query("INSERT INTO app.credentials (user_id, password_hash) VALUES ($1, $2)", [ANA, HASH]);
    await db.query(
      "INSERT INTO app.sessions (user_id, token_hash, expires_at, created_at) VALUES ($1, 'here', now() + interval '7 days', now()), ($1, 'phone', now() + interval '7 days', now()), ($1, 'old', now() - interval '1 day', now() - interval '50 days')",
      [ANA],
    );
    await db.query(
      "INSERT INTO app.password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, 'reset-1', now() + interval '30 minutes')",
      [ANA],
    );

    const listed = (await one(db, "SELECT app.list_my_sessions($1, 'here') AS s", [ANA])).s;
    assert.deepEqual(
      listed.map((s) => s.current),
      [true, false],
      "live sessions only, this one first",
    );

    await refused(db, () => db.query("SELECT app.change_my_password($1, 'plain-text', 'here')", [ANA]), /hash/);
    const changed = (await one(db, "SELECT app.change_my_password($1, $2, 'here') AS c", [ANA, HASH])).c;
    assert.equal(changed.sessions_revoked, 1, "the phone is signed out, this device is not");
    assert.equal(
      (
        await one(
          db,
          "SELECT count(*)::int AS n FROM app.password_reset_tokens WHERE user_id = $1 AND used_at IS NULL",
          [ANA],
        )
      ).n,
      0,
      "an older reset link stops working",
    );

    await refused(
      db,
      () => db.query("SELECT app.request_email_change($1, 'ANA@example.com', 'x1', now() + interval '1 day')", [ANA]),
      /already your email/,
    );
    await db.query("SELECT app.request_email_change($1, 'bob@example.com', 'take-bob', now() + interval '1 day')", [
      ANA,
    ]);
    await refused(db, () => db.query("SELECT app.confirm_email_change('take-bob')"), /invalid or has expired/);
    await db.query("SELECT app.request_email_change($1, 'ana.new@example.com', 'first', now() + interval '1 day')", [
      ANA,
    ]);
    await db.query("SELECT app.request_email_change($1, 'ana.newer@example.com', 'second', now() + interval '1 day')", [
      ANA,
    ]);
    await refused(db, () => db.query("SELECT app.confirm_email_change('first')"), /invalid or has expired/);
    const moved = (await one(db, "SELECT app.confirm_email_change('second') AS m")).m;
    assert.deepEqual([moved.old_email, moved.new_email], ["ana@example.com", "ana.newer@example.com"]);
    await refused(db, () => db.query("SELECT app.confirm_email_change('second')"), /invalid or has expired/);

    await db.query("UPDATE app.sessions SET revoked_at = now() - interval '40 days' WHERE token_hash = 'phone'");
    await db.query("UPDATE app.sessions SET expires_at = now() - interval '40 days' WHERE token_hash = 'old'");
    const purged = (await one(db, "SELECT app.purge_expired_data() AS p")).p;
    assert.ok(purged.sessions >= 2);
    assert.equal(
      (await one(db, "SELECT count(*)::int AS n FROM app.sessions WHERE user_id = $1", [ANA])).n,
      1,
      "only the live session is left",
    );
  } finally {
    await db.exec("ROLLBACK");
  }
}
