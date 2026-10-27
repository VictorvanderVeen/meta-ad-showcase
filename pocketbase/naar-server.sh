#!/bin/bash
# Zet de beoordelingsmelding (hook + migratie) op de PocketBase-server en herstart PocketBase.
# Vereist dat de afspraak-tool er al staat (de hook leent afspraak_lib.js) en dat mail.env
# er staat (eenmalig via mailwachtwoord.sh).
set -euo pipefail
cd "$(dirname "$0")"

SERVER=victorvanderveen@85.10.151.75
PB=/opt/pocketbase

PAKKET=$(COPYFILE_DISABLE=1 tar -czf - pb_hooks/showcase_melding.pb.js pb_migrations/1793100000_showcase_updated.js | base64)

ssh "$SERVER" 'bash -s' <<EOF
set -e
echo "$PAKKET" | base64 -d | sudo tar -xzf - -C $PB
sudo chown pocketbase:pocketbase $PB/pb_hooks/showcase_melding.pb.js $PB/pb_migrations/1793100000_showcase_updated.js
sudo systemctl restart pocketbase
sleep 3
systemctl is-active pocketbase
EOF
