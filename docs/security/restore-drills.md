# Restore drills

Security plan SEC-06 and SEC-96. Once a month, run `ops/server/restore-check.sh` (see
[server-hardening.md](server-hardening.md#4-restore-drill-every-month-sec-96)) and add a row. An untested backup
is not a backup.

| Date | Backup file | Restore time | Backup counts | Live counts | Who |
| ---- | ----------- | ------------ | ------------- | ----------- | --- |
