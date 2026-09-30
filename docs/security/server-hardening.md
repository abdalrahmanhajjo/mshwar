# Server hardening runbook

Security plan items: SEC-01 to SEC-09, SEC-12, SEC-19, SEC-42, SEC-44, SEC-88, SEC-96 · See [security-plan.md](security-plan.md)

Everything here runs on the box over SSH. The scripts live in `ops/server/`, are checked by
`shellcheck` in CI, and are safe to run again.

**Before you start:** keep one SSH session open the whole time. After each step, open a
**second** session to check you can still sign in. Only close the first when the second works.

## 1. Update the code on the box

```bash
cd /opt/mshwar
git pull --ff-only origin main
```

## 2. Harden the host (SEC-01 to SEC-05, SEC-08, SEC-09, SEC-42)

The script needs `sudo`. If `deploy` has no sudo rights, sign in as the admin account Oracle
created (usually `ubuntu`).

```bash
sudo bash /opt/mshwar/ops/server/harden.sh
```

It:

- **Updates:** installs every pending update and turns on automatic security updates, with a reboot at
  04:00 Beirut time when one is needed.
- **SSH:** allows keys only, no root, and only the accounts that already have a key (`SSH_USERS` to
  override). It also turns off forwarding, and runs `sshd -t` before reloading, so a typo cannot lock
  you out.
- **fail2ban:** bans an address for 1 hour after 5 failed tries in 10 minutes.
- **Firewall:** `ufw` allows only 22, 80 and 443.
- **Containers:** a systemd unit stops containers reaching the cloud metadata service (169.254.169.254),
  which holds the instance's credentials.
- **File modes:** `.env` and backups become readable by the app owner only.
- **Audit:** `auditd` records every read of `.env` and every change to SSH and sudo settings.

**Narrowing SSH to your addresses (SEC-05).** The GitHub deploy job signs in from GitHub's
changing addresses, so port 22 stays open by default: keys only, plus fail2ban. To narrow
it, use a fixed path in, for example Tailscale on the box and on your laptop, then:

```bash
sudo SSH_ALLOW_FROM="100.64.0.0/10" bash /opt/mshwar/ops/server/harden.sh
```

Also close 22 in the Oracle console (VCN → Security List) to match.

Then reboot if the script says so (the banner said "System restart required"):

```bash
sudo reboot
# sign back in, then:
cd /opt/mshwar && docker compose -f docker-compose.yml -f docker-compose.staging.yml ps
```

**Check (from your laptop):**

```bash
ssh -o PubkeyAuthentication=no deploy@84.13.143.44   # must say "Permission denied (publickey)"
```

## 3. Encrypted backups off the box (SEC-06)

On your laptop, make a key pair. The private key never goes on the server.

```bash
brew install age            # or apt install age
age-keygen -o mshwar-backup-key.txt
# Save mshwar-backup-key.txt in your password manager, then delete the file.
# The line starting "age1..." is the public key.
```

On the box:

```bash
sudo bash /opt/mshwar/ops/server/install-backups.sh "age1...your public key..."
```

This installs `age` and `rclone`, stores the public key, and turns on a nightly timer at
03:30 Beirut time. It also runs one backup straight away. Backups are kept on the box for 7 days.

**Copy them off the box.** Create a bucket `mshwar-backups` in Oracle Object Storage (same
region). Add a lifecycle rule to delete objects after 30 days and turn on retention rules.
Make a Customer Secret Key for S3 access, then run as `deploy`:

```bash
rclone config create mshwar-backups s3 provider Other \
  access_key_id <key id> secret_access_key <secret> \
  endpoint https://<namespace>.compat.objectstorage.<region>.oraclecloud.com
sudo systemctl start mshwar-backup.service && journalctl -u mshwar-backup.service -n 3
# expect: "copied off the box"
```

## 4. Restore drill, every month (SEC-96)

```bash
cd /opt/mshwar
AGE_KEY=~/mshwar-backup-key.txt bash ops/server/restore-check.sh
rm ~/mshwar-backup-key.txt
```

It restores the newest backup into a scratch database, prints row counts next to the live
database's, and drops the scratch copy. Write the result in [restore-drills.md](restore-drills.md).

## 5. Rotate secrets that ever left the box (SEC-44)

A Brevo SMTP key was once pasted into a chat. If it has not been replaced:

1. Brevo → SMTP & API → SMTP → **Generate a new SMTP key**.
2. On the box: `nano /opt/mshwar/.env`, replace `SMTP_PASSWORD` with the new key, save.
3. `docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d api scheduler`
4. Send yourself a password-reset email to check mail still works.
5. Brevo → delete the old key.

Do the same for any other key that has been in a chat, a screenshot or an email. Record each
rotation in `docs/KEY_ROTATION.md`.

## 6. Know when something breaks (SEC-88)

**Errors.** Create a free Sentry project for the API and one for the web app. In `.env`:

```bash
SENTRY_DSN=https://...        # API
NEXT_PUBLIC_SENTRY_DSN=https://...   # web
```

Restart `api` and `web`. The scrubber (`app/core/scrubber.py`) removes personal data before
anything is sent.

**Uptime.** In UptimeRobot or Better Stack (free plans), add HTTPS checks every 5 minutes:

- `https://mshwarlb.com/health` (expects `healthy`)
- `https://mshwarlb.com/` (expects 200)
- `https://mshwarlb.com/api/v1/health` (expects 200, checks the database)

Alert by push to your phone and by email.

## 7. Optional: Cloudflare in front (SEC-19)

Cloudflare's free plan absorbs floods and blocks known bad bots:

1. Add the domain to Cloudflare and move the nameservers at the registrar.
2. Set the DNS records to proxied (orange cloud), SSL mode **Full (strict)**, and turn on **Bot Fight Mode**.
3. On the box, allow 80/443 only from Cloudflare:

   ```bash
   for net in $(curl -s https://www.cloudflare.com/ips-v4) $(curl -s https://www.cloudflare.com/ips-v6); do
     sudo ufw allow from "$net" to any port 80,443 proto tcp
   done
   sudo ufw delete allow 80/tcp && sudo ufw delete allow 443/tcp
   ```

## 8. Accounts and access, every quarter (SEC-12)

Check who can reach each of these, remove anyone who no longer needs it, and turn on 2FA
(a security key where the service allows it) for every account:

- Oracle Cloud
- GitHub
- the domain registrar
- Brevo
- ImageKit
- Sentry
- Google Cloud (Maps)
- Cloudflare

Also list the keys in `~/.ssh/authorized_keys` for `deploy` and the admin account.

Write the date and what changed in [access-reviews.md](access-reviews.md).
