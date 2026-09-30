#!/usr/bin/env bash
# Nightly database backup (security plan SEC-06): dump, compress, encrypt, copy off the box.
#
# Run by mshwar-backup.timer as the app owner. It needs, once:
#   * age installed (apt install age) and /etc/mshwar/backup-recipient.txt holding an age
#     PUBLIC key. Keep the matching private key off this server (a password manager);
#     only a restore needs it.
#   * rclone installed and a remote named "mshwar-backups" (for example Oracle Object Storage
#     through its S3-compatible endpoint), with a lifecycle rule that deletes objects after
#     30 days. Without the remote the backup is kept on the box only and the run says so.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/mshwar}"
RECIPIENT_FILE="${RECIPIENT_FILE:-/etc/mshwar/backup-recipient.txt}"
REMOTE="${REMOTE:-mshwar-backups:mshwar-backups}"
KEEP_LOCAL_DAYS="${KEEP_LOCAL_DAYS:-7}"

cd "$APP_DIR"
compose=(docker compose -f docker-compose.yml -f docker-compose.staging.yml)
dir="$APP_DIR/ops/db-backups"
umask 077
mkdir -p "$dir"
stamp="$(date -u +%Y-%m-%dT%H%MZ)"
out="$dir/mshwar-$stamp.sql.gz.age"

if [[ ! -s "$RECIPIENT_FILE" ]]; then
  echo "missing $RECIPIENT_FILE (an age public key); refusing to write an unencrypted backup" >&2
  exit 1
fi

# shellcheck disable=SC2016  # the variables expand inside the database container
"${compose[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --format=plain' \
  | gzip -9 \
  | age -R "$RECIPIENT_FILE" -o "$out"

size="$(stat -c %s "$out")"
if (( size < 10240 )); then
  echo "backup is only ${size} bytes; something is wrong" >&2
  exit 1
fi
sha256sum "$out" >"$out.sha256"

if command -v rclone >/dev/null && rclone listremotes | grep -q "^${REMOTE%%:*}:$"; then
  rclone copy --immutable "$out" "$REMOTE/"
  rclone copy --immutable "$out.sha256" "$REMOTE/"
  echo "backup $stamp: ${size} bytes, copied off the box"
else
  echo "backup $stamp: ${size} bytes, kept on the box only (configure the rclone remote)" >&2
fi

find "$dir" -type f -mtime +"$KEEP_LOCAL_DAYS" -delete
