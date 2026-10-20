#!/usr/bin/env bash
# Installs the ExtraNet Editor on a clean Debian or Ubuntu server and serves it over HTTPS.
#
# Run it on the server, as root or with sudo:
#   curl -fsSL https://raw.githubusercontent.com/Ignies/ExtraNet-Editor/main/install.sh | sudo bash
# or over ssh from your own machine:
#   ssh root@your-server 'bash -s' < install.sh
#
# Settings, all optional, passed as environment variables:
#   DOMAIN   the site's address              (default extraneteditor.ignies.net)
#   EMAIL    for Let's Encrypt expiry notices (default: none)
#   REPO     the git repository to serve      (default https://github.com/Ignies/ExtraNet-Editor.git)
#   BRANCH   the branch to serve              (default main)
#   NO_TLS=1 skip the certificate and serve plain HTTP only
# e.g.  ssh root@your-server 'DOMAIN=editor.example.org EMAIL=me@example.org bash -s' < install.sh
#
# Running it again updates the site to the latest commit and keeps the existing certificate.
# Before running, point the domain's DNS A (and AAAA) record at this server, or the certificate step fails.
# It only adds a server block for its own domain: other sites on the same nginx keep working, and running it
# again with another DOMAIN installs a second copy next to the first.
set -euo pipefail

DOMAIN="${DOMAIN:-extraneteditor.ignies.net}"
EMAIL="${EMAIL:-}"
REPO="${REPO:-https://github.com/Ignies/ExtraNet-Editor.git}"
BRANCH="${BRANCH:-main}"
NO_TLS="${NO_TLS:-0}"
# Named after the domain, so other sites on this server keep their own folders and configs.
WEBROOT="/var/www/$DOMAIN"
SITE="/etc/nginx/sites-available/$DOMAIN"

say() { printf '\n==> %s\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
    echo "Run this as root, or with sudo." >&2
    exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
    echo "This installer supports Debian and Ubuntu (apt) only." >&2
    exit 1
fi

say "Installing nginx, git and certbot"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx git ca-certificates
if [ "$NO_TLS" != "1" ]; then
    apt-get install -y certbot python3-certbot-nginx
fi

say "Fetching the editor into $WEBROOT"
if [ -d "$WEBROOT/.git" ]; then
    git -C "$WEBROOT" fetch --depth 1 origin "$BRANCH"
    git -C "$WEBROOT" reset --hard "origin/$BRANCH"
else
    rm -rf "$WEBROOT"
    git clone --depth 1 --branch "$BRANCH" "$REPO" "$WEBROOT"
fi
chown -R www-data:www-data "$WEBROOT"

say "Configuring nginx for $DOMAIN"
cat > "$SITE" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    root $WEBROOT;
    index index.html;

    # The editor is static files; nothing in the repository's own folder is served.
    location ~ /\.git { deny all; return 404; }
    location = /install.sh { return 404; }

    location / {
        try_files \$uri \$uri/ =404;
    }

    # Scripts and art change with each update; let browsers check back instead of caching for days.
    location ~* \.(js|css|json|html)$ {
        add_header Cache-Control "no-cache";
        try_files \$uri =404;
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
NGINX
ln -sf "$SITE" "/etc/nginx/sites-enabled/$DOMAIN"
# The first version of this script used fixed names; drop that copy so the domain is not served twice.
if [ -e /etc/nginx/sites-available/extraneteditor ]; then
    rm -f /etc/nginx/sites-enabled/extraneteditor /etc/nginx/sites-available/extraneteditor
    rm -rf /var/www/extraneteditor
fi
nginx -t
systemctl enable nginx
systemctl reload nginx || systemctl restart nginx

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
    say "Opening the web ports in the firewall"
    ufw allow 'Nginx Full'
fi

if [ "$NO_TLS" != "1" ]; then
    say "Getting an HTTPS certificate for $DOMAIN"
    if [ -n "$EMAIL" ]; then
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect --keep-until-expiring
    else
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect --keep-until-expiring
    fi
    systemctl enable --now certbot.timer 2>/dev/null || true
    say "Done: https://$DOMAIN"
else
    say "Done: http://$DOMAIN"
fi
