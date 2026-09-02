#!/bin/bash
# Installs nginx vhost for plan.squadifyai.com (RAI-Planner) — run with sudo
set -e

CONF_SRC="/var/www/RAI-Planner/deploy/plan.squadifyai.com.conf"
CONF_DST="/etc/nginx/sites-available/hosts/plan.squadifyai.com.conf"
MASTER="/etc/nginx/sites-available/master.conf"

cp "$CONF_SRC" "$CONF_DST"
echo "[ok] copied vhost to $CONF_DST"

if ! grep -q "plan.squadifyai.com.conf;" "$MASTER"; then
  sed -i "/api.squadify.loc.conf;/a include /etc/nginx/sites-available/hosts/plan.squadifyai.com.conf;" "$MASTER"
  echo "[ok] added include to master.conf"
else
  echo "[ok] include already present in master.conf"
fi

nginx -t
systemctl reload nginx
echo "[done] nginx reloaded"

# verify
sleep 1
echo "---"
curl -s -o /dev/null -w "frontend: HTTP %{http_code}\n" http://plan.squadifyai.com/
curl -s -w "\napi: HTTP %{http_code}\n" http://plan.squadifyai.com/api/health
