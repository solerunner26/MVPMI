#!/usr/bin/env bash
# MVPMI server installer for a fresh Ubuntu 22.04/24.04 VM (Oracle Cloud
# Always Free, or any similar Linux server). Safe to run again.
#
#   sudo APP_DOMAIN=samaj.example.com bash install.sh
#
# Expects /etc/mvpmi.env (settings and secrets, see mvpmi.env.example).
# Installs: Node.js 22, Caddy (automatic HTTPS), the app as a systemd
# service, nightly backups and hourly automatic updates to the newest
# GitHub release (a release exists only after all tests have passed).
set -euo pipefail
APP_DOMAIN="${APP_DOMAIN:?set APP_DOMAIN}"
REPO="${REPO:-https://github.com/solerunner26/MVPMI.git}"
BRANCH="${BRANCH:-main}"
APP=/opt/mvpmi/app
DATA=/var/lib/mvpmi
export DEBIAN_FRONTEND=noninteractive

log() { echo "[mvpmi-install] $*"; }
[ -f /etc/mvpmi.env ] || { echo "/etc/mvpmi.env is missing"; exit 1; }

# 1 GB machines need swap for npm.
if ! swapon --show | grep -q /swapfile; then
  log "adding 2 GB swap"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "system packages"
apt-get update -y
apt-get install -y ca-certificates curl gnupg git sqlite3 unattended-upgrades debian-keyring debian-archive-keyring apt-transport-https jq

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  log "Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if ! command -v caddy >/dev/null; then
  log "Caddy web server"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

log "firewall: allow web traffic (Oracle images block everything but SSH)"
for port in 80 443; do
  iptables -C INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT 2>/dev/null ||
    iptables -I INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT
done
command -v netfilter-persistent >/dev/null && netfilter-persistent save || true

log "service user and folders"
id mvpmi >/dev/null 2>&1 || useradd --system --home-dir /opt/mvpmi --create-home --shell /usr/sbin/nologin mvpmi
mkdir -p "$DATA/downloads" "$DATA/backups" /opt/mvpmi
chown -R mvpmi:mvpmi /opt/mvpmi "$DATA"
chmod 750 "$DATA"
chown root:mvpmi /etc/mvpmi.env && chmod 640 /etc/mvpmi.env

if [ ! -d "$APP/.git" ]; then
  log "downloading the app from GitHub"
  sudo -u mvpmi git clone --branch "$BRANCH" "$REPO" "$APP"
fi
LATEST=$(curl -fsS https://api.github.com/repos/solerunner26/MVPMI/releases/latest 2>/dev/null | jq -r '.tag_name // empty' || true)
if [ -n "$LATEST" ]; then
  sudo -u mvpmi git -C "$APP" fetch --tags --force origin
  sudo -u mvpmi git -C "$APP" checkout -f "$LATEST"
fi

log "installing and building"
cd "$APP"
sudo -u mvpmi -H npm ci --omit=dev --no-audit --no-fund
sudo -u mvpmi -H npm run build

install -m 755 deploy/oracle/mvpmi-update /usr/local/sbin/mvpmi-update

cat > /etc/systemd/system/mvpmi.service <<EOF
[Unit]
Description=MVPMI community directory
After=network-online.target
Wants=network-online.target

[Service]
User=mvpmi
Group=mvpmi
WorkingDirectory=$APP
EnvironmentFile=/etc/mvpmi.env
ExecStart=/usr/bin/node server/index.mjs
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA
MemoryMax=600M

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/mvpmi-backup.service <<EOF
[Unit]
Description=MVPMI nightly backups (local copy + encrypted Google Drive copy)
After=mvpmi.service

[Service]
Type=oneshot
User=mvpmi
Group=mvpmi
WorkingDirectory=$APP
EnvironmentFile=/etc/mvpmi.env
ExecStart=/usr/bin/node scripts/backup-db.mjs \${DB_PATH} $DATA/backups 14
ExecStart=-/usr/bin/node scripts/backup-drive-now.mjs
EOF
cat > /etc/systemd/system/mvpmi-backup.timer <<EOF
[Unit]
Description=MVPMI nightly backups at 02:30 India time

[Timer]
OnCalendar=*-*-* 21:00:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
EOF
cat > /etc/systemd/system/mvpmi-update.service <<EOF
[Unit]
Description=MVPMI automatic update to the newest tested GitHub release

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/mvpmi-update latest
EOF
cat > /etc/systemd/system/mvpmi-update.timer <<EOF
[Unit]
Description=Check hourly for a new MVPMI release

[Timer]
OnBootSec=10min
OnUnitActiveSec=1h
RandomizedDelaySec=5min

[Install]
WantedBy=timers.target
EOF

cat > /etc/caddy/Caddyfile <<EOF
$APP_DOMAIN {
	encode zstd gzip
	header Strict-Transport-Security "max-age=31536000"
	reverse_proxy 127.0.0.1:3000
}
EOF

systemctl daemon-reload
systemctl enable --now mvpmi.service
systemctl enable --now mvpmi-backup.timer mvpmi-update.timer
systemctl reload caddy || systemctl restart caddy
# The release APK (if a release exists) becomes available at /download.
/usr/local/sbin/mvpmi-update apk-only || true
sleep 3
curl -fsS http://127.0.0.1:3000/api/health && echo
log "done: https://$APP_DOMAIN (HTTPS starts once DNS points here)"
