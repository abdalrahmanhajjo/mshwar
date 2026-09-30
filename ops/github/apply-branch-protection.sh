#!/usr/bin/env bash
# Applies .github/branch-protection.json to main (security plan SEC-78).
# Needs the GitHub CLI signed in as a repository admin: `gh auth login`.
# Safe to run again; GitHub replaces the rule each time.
set -euo pipefail
repo="${1:-abdalrahmanhajjo/mshwar}"
cd "$(git rev-parse --show-toplevel)"
node .github/scripts/check-branch-protection.mjs
gh api --method PUT "repos/${repo}/branches/main/protection" \
  -H "Accept: application/vnd.github+json" \
  --input .github/branch-protection.json >/dev/null
# Signed commits are a separate switch; turn it on once every committer signs.
gh api "repos/${repo}/branches/main/protection" \
  --jq '{checks: .required_status_checks.contexts | length, strict: .required_status_checks.strict, admins: .enforce_admins.enabled, force_push: .allow_force_pushes.enabled}'
echo "main is protected."
