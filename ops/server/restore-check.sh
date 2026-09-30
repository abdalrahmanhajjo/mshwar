#!/usr/bin/env bash
# Monthly restore drill (security plan SEC-06, SEC-96): restore a backup into a scratch
# database next to the real one, compare row counts, then drop it. Nothing touches the live
# database.
#
#   AGE_KEY=~/backup-key.txt bash ops/server/restore-check.sh [backup-file.sql.gz.age]
#
# AGE_KEY is the private key; bring it for the drill and remove it afterwards.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/mshwar}"
: "${AGE_KEY:?set AGE_KEY to the age private key file}"
cd "$APP_DIR"
compose=(docker compose -f docker-compose.yml -f docker-compose.staging.yml)
# shellcheck disable=SC2012  # backup names are ours: mshwar-<timestamp>.sql.gz.age
file="${1:-$(ls -1t ops/db-backups/*.sql.gz.age | head -1)}"
sha256sum -c "$file.sha256"

scratch="restore_check_$(date +%s)"
"${compose[@]}" exec -T db sh -c "createdb -U \"\$POSTGRES_USER\" $scratch"
trap '"${compose[@]}" exec -T db sh -c "dropdb -U \"\$POSTGRES_USER\" --if-exists $scratch"' EXIT

started=$(date +%s)
age -d -i "$AGE_KEY" "$file" | gunzip | "${compose[@]}" exec -T db sh -c "psql -q -U \"\$POSTGRES_USER\" -d $scratch -v ON_ERROR_STOP=1" >/dev/null
seconds=$(( $(date +%s) - started ))

count() {
  "${compose[@]}" exec -T db sh -c "psql -U \"\$POSTGRES_USER\" -d $1 -tAc \"SELECT
    (SELECT count(*) FROM app.users) || ' users, ' ||
    (SELECT count(*) FROM app.bookings) || ' bookings, ' ||
    (SELECT count(*) FROM app.guide_profiles) || ' guides'\""
}
echo "restored $(basename "$file") in ${seconds}s"
echo "backup: $(count "$scratch")"
# shellcheck disable=SC2016  # expands inside the database container
echo "live:   $(count '"$POSTGRES_DB"')"
echo "Write the date, time taken and both lines in docs/security/restore-drills.md."
