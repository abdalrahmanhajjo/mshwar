# Security findings tracker

Review date: 2026-09-14. Scope: repository implementation, external services unset. Status `resolved` means code mitigation exists with regression evidence; it is not a production penetration-test sign-off. No critical/high risk is silently accepted. Unverified deployment conditions remain release blockers for the affected feature.

| ID | Severity | Finding | Resolution / evidence | Status |
| --- | --- | --- | --- | --- |
| SEC-001 | High | Legacy catalogue mutations and payment maintenance lacked consistent platform-admin gates | Central closed-by-default policy, explicit admin set, all-routes dependency test and domain tests | Resolved |
| SEC-002 | High | Payment simulation could act on a foreign booking | Shared booking ownership check runs before reading or mutating payment state; identical foreign/missing responses tested | Resolved |
| SEC-003 | High | Caller identity/organisation headers could become trusted DB context | Middleware discards them; verified session and checked organisation membership set local GUCs | Resolved |
| SEC-004 | High | Upload MIME declarations alone allowed active content; private storage path lacked complete provider implementation | Byte signatures + purpose allowlist, limits before write, traversal protection, actual private ImageKit upload and signed retrieval, attachment downloads | Resolved for declared validation scope |
| SEC-005 | High | Process-local budgets could be bypassed by workers/restarts/rolled-back requests | Production rejects memory backend; atomic shared Postgres reservations commit separately; concurrency tests | Resolved |
| SEC-006 | High | SQL exceptions/telemetry could expose input, tokens and payment identifiers | Hidden SQL parameters, safe error mapping, registry/scrubber and Sentry hook, redaction tests | Resolved |
| SEC-007 | High | Identity, consent and group actions were incompletely audited | Migration 022 extends triggers and forbids app audit mutation/truncate; values, privileges and consequential table coverage tested | Resolved |
| SEC-008 | Medium | Saved preferences were used without purpose-specific consent | Separate revocable controls, consent history for legacy updates, gated saved plan defaults, essential-only cookie storage | Resolved |
| SEC-009 | Medium | File signature checks do not detect malicious PDFs or decompression bombs | Files are size-limited, private and downloaded as attachments, never parsed server-side. Pilot staff must treat documents as untrusted and use sandboxed viewers. Add antivirus/CDR before broad unmoderated document intake | Open improvement; document intake rollout requires review |
| SEC-010 | High if misconfigured | ImageKit account settings can allow access through unsigned/named transformations | All uploads request private visibility and retrieval is signed. Account-specific unsigned/transformation denial test is a mandatory deployment gate in the checklist; keys-unset pilot uses local private storage | Mitigated in local pilot; external storage blocked until verified |
| SEC-011 | High if enabled unbounded | Paid AI adapter could exceed configured reservation | Current LLM factory is deterministic stub-only. Reserve a conservative max before every planner POST; paid adapter enablement requires a reviewed per-call token/retry price bound <= AI_REQUEST_BUDGET_MICROS | Paid adapter blocked pending review |
| SEC-012 | High if misconfigured | Database owner can bypass audit/RLS; ingress logs could retain bearer paths | Runtime role and infrastructure logging checks explicitly required. App role tests verify privileges; Docker ignores forwarded headers by default | Deployment blocked until operations verification |

## Scan evidence and exception process

`.github/workflows/security.yml` scans resolved Python dependencies, the committed pnpm lockfile, and built API/web images. CRITICAL advisories (including unfixed) fail; unavailable scanners fail the job. Artifacts are retained by Actions, including on failure. There are no vulnerability suppression files or skip flags in this change. Weekly scheduled scans address newly published advisories.

For each new critical/high finding record: advisory/CVE, affected artifact/version, exploit path, decision, concrete fix or compensating control, named accountable approver, ticket, verification evidence and expiry date. A formal acceptance requires that approver’s recorded approval; this agent cannot grant it. No critical/high dependency exception is pre-approved here. A failed critical gate must be fixed before this PR is considered green.
