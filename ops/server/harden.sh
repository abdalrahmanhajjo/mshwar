#!/usr/bin/env bash
# Hardens the Mshwar host (security plan SEC-01 to SEC-05, SEC-08, SEC-09, SEC-42).
#
#   sudo SSH_ALLOW_FROM="203.0.113.7/32 198.51.100.0/24" bash ops/server/harden.sh
#
# Safe to run again: every step checks before it changes anything. It never closes the SSH
# session you are in. Keep that session open until you have opened a second one after the
# script finishes, so a mistake can always be undone.
#
# Settings (environment variables):
#   SSH_USERS        accounts allowed to sign in over SSH (default: every account that has an
#                    authorized_keys file, so nobody who signs in today is locked out)
#   SSH_ALLOW_FROM   space-separated addresses or ranges allowed to reach port 22. Empty keeps
#                    22 open to everyone (fail2ban still applies). Add GitHub's runner ranges or
#                    use a bastion if the deploy workflow must reach the box.
#   APP_DIR          where the app lives (default /opt/mshwar)
#   REBOOT_TIME      when automatic security updates may reboot, host time (default 01:00 UTC,
#                    04:00 in Beirut)
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/mshwar}"
REBOOT_TIME="${REBOOT_TIME:-01:00}"
SSH_ALLOW_FROM="${SSH_ALLOW_FROM:-}"

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo." >&2
  exit 1
fi

say() { printf '\n== %s\n' "$*"; }

if [[ -z "${SSH_USERS:-}" ]]; then
  SSH_USERS=""
  while IFS=: read -r name _ _ _ _ home _; do
    [[ -s "$home/.ssh/authorized_keys" ]] && SSH_USERS+="$name "
  done </etc/passwd
  SSH_USERS="${SSH_USERS% }"
fi
if [[ -z "$SSH_USERS" ]]; then
  echo "No account has an authorized_keys file; refusing to restrict SSH." >&2
  exit 1
fi

say "SEC-01: security updates"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get -y -q upgrade
apt-get -y -q install unattended-upgrades apt-listchanges fail2ban auditd ufw needrestart

say "SEC-02: automatic security updates, reboot at ${REBOOT_TIME} when needed"
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
CONF
cat >/etc/apt/apt.conf.d/52mshwar-unattended <<CONF
Unattended-Upgrade::Allowed-Origins {
  "\${distro_id}:\${distro_codename}-security";
  "\${distro_id}ESMApps:\${distro_codename}-apps-security";
  "\${distro_id}ESM:\${distro_codename}-infra-security";
};
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "${REBOOT_TIME}";
CONF
systemctl enable --now unattended-upgrades

say "SEC-03: SSH keys only, no root, only: ${SSH_USERS}"
cat >/etc/ssh/sshd_config.d/10-mshwar.conf <<CONF
# Managed by ops/server/harden.sh
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
PermitRootLogin no
PubkeyAuthentication yes
AuthenticationMethods publickey
AllowUsers ${SSH_USERS}
MaxAuthTries 3
MaxSessions 4
LoginGraceTime 20
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
PermitTunnel no
CONF
sshd -t
systemctl reload ssh || systemctl reload sshd

say "SEC-04: fail2ban for SSH"
cat >/etc/fail2ban/jail.d/mshwar.local <<'CONF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd

[sshd]
enabled = true
CONF
systemctl enable --now fail2ban
systemctl restart fail2ban

say "SEC-05: firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
if [[ -n "$SSH_ALLOW_FROM" ]]; then
  for source in $SSH_ALLOW_FROM; do
    ufw allow from "$source" to any port 22 proto tcp
  done
  # Drop the open rule only after the narrower ones exist.
  ufw delete allow 22/tcp >/dev/null 2>&1 || true
else
  ufw allow 22/tcp
  echo "SSH stays open to everyone (set SSH_ALLOW_FROM to narrow it)."
fi
ufw --force enable

say "SEC-42: containers cannot reach the cloud metadata service"
# DOCKER-USER runs before Docker's own rules, for container traffic only. A unit re-adds the
# rule after Docker starts on every boot (saving Docker's chains with iptables-persistent
# breaks Docker after a reboot, so this is not done).
cat >/usr/local/sbin/mshwar-egress-rules <<'SCRIPT'
#!/bin/sh
set -e
iptables -N DOCKER-USER 2>/dev/null || true
for target in 169.254.169.254/32 169.254.0.0/16; do
  iptables -C DOCKER-USER -d "$target" -j DROP 2>/dev/null || iptables -I DOCKER-USER -d "$target" -j DROP
done
SCRIPT
chmod 755 /usr/local/sbin/mshwar-egress-rules
cat >/etc/systemd/system/mshwar-egress.service <<'UNIT'
[Unit]
Description=Mshwar: block the cloud metadata service from containers
After=docker.service
Requires=docker.service
PartOf=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/mshwar-egress-rules
RemainAfterExit=yes

[Install]
WantedBy=docker.service
UNIT
systemctl daemon-reload
systemctl enable --now mshwar-egress.service

say "SEC-08: secrets and backups readable by the app owner only"
if [[ -d "$APP_DIR" ]]; then
  owner="$(stat -c %U "$APP_DIR")"
  [[ -f "$APP_DIR/.env" ]] && chown "$owner:$owner" "$APP_DIR/.env" && chmod 600 "$APP_DIR/.env"
  install -d -m 700 -o "$owner" -g "$owner" "$APP_DIR/ops/db-backups"
  find "$APP_DIR/ops/db-backups" -type f -exec chmod 600 {} +
fi

say "SEC-09: audit trail for secrets, SSH and sudo"
cat >/etc/audit/rules.d/mshwar.rules <<CONF
-w ${APP_DIR}/.env -p rwa -k mshwar-env
-w /etc/ssh/ -p wa -k mshwar-ssh
-w /etc/sudoers -p wa -k mshwar-sudo
-w /etc/sudoers.d/ -p wa -k mshwar-sudo
-w /usr/bin/docker -p x -k mshwar-docker
CONF
augenrules --load >/dev/null
systemctl enable --now auditd

say "Done"
echo "SSH users: ${SSH_USERS}"
ufw status | sed -n '1,20p'
fail2ban-client status sshd | tail -3
if [[ -f /var/run/reboot-required ]]; then
  echo
  echo "A reboot is needed for the kernel and library updates (SEC-01)."
  echo "Open a second SSH session first to check you can still sign in, then: sudo reboot"
fi
