#!/usr/bin/env bash
# Installs the nightly backup timer (security plan SEC-06).
#   sudo bash ops/server/install-backups.sh "age1...your public key..."
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Run with sudo." >&2; exit 1; }
recipient="${1:?give the age PUBLIC key (starts with age1)}"
[[ "$recipient" == age1* ]] || { echo "that is not an age public key" >&2; exit 1; }
here="$(cd "$(dirname "$0")" && pwd)"
apt-get install -y -q age rclone
install -d -m 755 /etc/mshwar
printf '%s\n' "$recipient" >/etc/mshwar/backup-recipient.txt
chmod 644 /etc/mshwar/backup-recipient.txt
install -m 644 "$here/mshwar-backup.service" /etc/systemd/system/mshwar-backup.service
install -m 644 "$here/mshwar-backup.timer" /etc/systemd/system/mshwar-backup.timer
systemctl daemon-reload
systemctl enable --now mshwar-backup.timer
systemctl start mshwar-backup.service
journalctl -u mshwar-backup.service -n 5 --no-pager
systemctl list-timers mshwar-backup.timer --no-pager
