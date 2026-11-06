#!/bin/bash
# Zet de showcase op db.vdveen.online/showcase/: migratie (ads-collecties), mailhook en de app.
# Alleen nodig bij codewijzigingen. Ads en teksten wijzig je in PocketBase, die zijn meteen live.
#
#   ./pocketbase/app-naar-server.sh
#
# De eerste keer richt het ook Caddy in (met backup van de Caddyfile); daarna alleen nieuwe bestanden.
set -euo pipefail
cd "$(dirname "$0")/.."

SERVER=victorvanderveen@85.10.151.75
PB=/opt/pocketbase
WEB=/var/www/showcase

npm run build >/dev/null
# public/ads zit nog in de repo zolang de oude bestanden er staan; de app haalt alles uit PocketBase
rm -rf dist/ads

PAKKET=$(cd pocketbase && COPYFILE_DISABLE=1 tar -czf - pb_hooks/showcase_melding.pb.js pb_migrations/1793200000_showcase_ads.js | base64)
APP=$(cd dist && COPYFILE_DISABLE=1 tar -czf - . | base64)

ssh "$SERVER" 'bash -s' <<EOF
set -e
echo "$PAKKET" | base64 -d | sudo tar -xzf - -C $PB
sudo chown pocketbase:pocketbase $PB/pb_hooks/showcase_melding.pb.js $PB/pb_migrations/1793200000_showcase_ads.js
sudo systemctl restart pocketbase
sleep 3
systemctl is-active pocketbase

sudo rm -rf $WEB.nieuw && sudo mkdir -p $WEB.nieuw
echo "$APP" | base64 -d | sudo tar -xzf - -C $WEB.nieuw
sudo rm -rf $WEB.oud && { [ -d $WEB ] && sudo mv $WEB $WEB.oud || true; } && sudo mv $WEB.nieuw $WEB

if ! grep -q 'handle_path /showcase' /etc/caddy/Caddyfile; then
  sudo cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak-\$(date +%Y%m%d-%H%M%S)"
  awk '
    /^db\.vdveen\.online \{/ && !gedaan {
      print
      print "    redir /showcase /showcase/"
      print "    handle_path /showcase/* {"
      print "        root * $WEB"
      print "        @pagina not path /assets/*"
      print "        header @pagina Cache-Control \"no-cache\""
      print "        try_files {path} /index.html"
      print "        file_server"
      print "    }"
      gedaan = 1
      next
    }
    { print }
  ' /etc/caddy/Caddyfile | sudo tee /etc/caddy/Caddyfile.new >/dev/null
  sudo caddy validate --config /etc/caddy/Caddyfile.new --adapter caddyfile
  sudo mv /etc/caddy/Caddyfile.new /etc/caddy/Caddyfile
  sudo systemctl reload caddy
  echo "Caddy ingericht voor /showcase"
fi
echo "Klaar: https://db.vdveen.online/showcase/"
EOF
