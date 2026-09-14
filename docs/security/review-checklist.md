# Security review checklist and story evidence

Status: implementation review; deployment checks below are release gates. No human approval or risk acceptance is asserted by this document.

| Story | Acceptance evidence | Check |
| --- | --- | --- |
| MSHWAR-108 | `core/permissions.py` denies new API endpoints by default; `test_every_api_route_has_default_deny_guard_and_exceptions_exist` inventories routes; SQL functions enforce object/role checks; IDOR tests cover trips, guests, planner sessions, bookings/payments, organisations, staff, listings and private docs | Implemented |
| MSHWAR-109 | Migration 022 extends audited tables, immutable audit triggers/privileges, no app mutation endpoint; `/admin/audit` filters actor/action/target/date/query with pagination; integration tests assert event values and consequential table trigger coverage | Implemented |
| MSHWAR-110 | `security_limits.py`, `security_reserve`, per-endpoint/auth-state/IP/user budgets, Retry-After, durable conservative AI daily reservation, org upload quotas; `/admin/security-metrics` provides allowed/denied counters; quota/concurrency tests | Implemented |
| MSHWAR-111 | `log_scrubbing.py`, registry, log filter, Sentry `before_send` and breadcrumbs, SQL parameter hiding, generic DB/validation errors; `securityFetch`, request ID middleware and telemetry helper; scrubber tests | Implemented |
| MSHWAR-112 | `uploads.py`, private storage + ImageKit adapter, type/signature/size/purpose checks before write, short signed URLs, per-org count/byte quotas; upload and token unit/integration tests | Implemented; no antivirus claim |
| MSHWAR-113 | `/privacy`, `/terms`, `/cancellation`, `/community-guidelines` in EN/AR/FR; consent API + account controls; essential-only cookie choices; revocation disables saved-preference defaults; history triggers include legacy preference paths; web/backend tests | Implemented; deployment legal sign-off remains required |
| MSHWAR-114 | Threat model, this checklist, findings tracker, critical dependency and runtime image CI gates, weekly scan | Implemented; scan evidence is the PR workflow artifacts |

## Consequential action catalogue

The database is the authoritative audit boundary: successful INSERT/UPDATE/DELETE operations on audited domain tables produce events in the same transaction. Rolled-back attempts do not claim successful actions. Endpoint name supplies a fallback reason; admin/business workflows retain their explicit reason. Anonymous/worker actions have no authenticated actor; associated user IDs are recorded where available.

Coverage includes identity/session lifecycle, consent/preferences, organisations/members/staff invitations/documents, listing/price/policy/media/publication changes, slots/blackouts, bookings/booking events/payment/refund/outbox transitions, planner sessions/versions, group membership/shares/suggestions/votes, reviews/moderation, admin roles/config/support actions. `test_all_consequential_tables_have_audit_triggers` asserts the trigger contract; the existing domain integration suites exercise these action paths. Audit payloads retain operational state only, never full row snapshots, hashes or payment references.

## Required deployment verification

- [ ] Operations owner verifies runtime role `mshwar_backend`, no superuser/migration credentials, private database network and backup access.
- [ ] Operations owner sets a fresh SECRET_KEY, HTTPS/cookie/CORS settings, shared quota backend and persistent private storage or reviewed ImageKit account.
- [ ] Ingress operator sets upload/request body caps and timeouts, trusted proxy IP resolution, and token/path scrubbing for infrastructure access logs.
- [ ] Storage owner verifies an unsigned ImageKit private-file URL and transformed URL are denied; disable unsigned transformations / named transformation bypasses. Run a canary upload/download/expiry check with the actual account.
- [ ] Product/legal owner reviews EN/AR/FR policies, operator identity, contact channel, retention schedule, actual cancellation contract and region-specific obligations before accepting real customers. Draft product policies do not constitute a legal compliance certification.
- [ ] Payment owner completes the existing Lebanon acquirer release gate before real payments. AI owner reviews token/retry cost bound before any paid adapter replaces the stub.
- [ ] Security reviewer attaches dependency and both container scan artifacts from the exact PR commit; all criticals must be fixed or an explicit reviewed exception recorded with owner, expiry and compensating controls.
- [ ] Independent reviewer runs the traveller/business/admin flows with separate accounts and checks audit records, consent withdrawal and revoked capabilities in staging.

## Reproducible validation

Use a disposable database; existing integration fixtures intentionally commit and must start with a clean migrated database. Apply migrations with `python mshwar-database/scripts/migrate.py`, then from `services/api` run `PYTHONPATH=. python -m pytest tests/` to use that directory’s coverage exclusions and threshold. Run `ruff check services/api/`, `ruff format services/api/ --check`, `mypy services/api/app/`, plus repository format/lint/typecheck/i18n/tokens/web tests. The CI configuration supplies Python 3.11 and Node 22. Local Node 26 requires `NODE_OPTIONS=--no-experimental-webstorage` with jsdom 25; this is not needed in CI.

Homepage verification: the supplied `prototype/1.png` defines the visual layout. Local licensed Lebanon photographs, responsive hero/search/categories/itinerary/cards/footer preserve the existing navigation, trip builder and save flows. Cookie choices remain accessible below the footer and default to essential only.
