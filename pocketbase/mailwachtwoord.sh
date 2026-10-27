#!/bin/bash
# Zet de inloggegevens van de TransIP-mailrelay in /opt/pocketbase/mail.env op de server.
# Het wachtwoord typ/plak je zelf; het komt niet in een bestand op deze Mac of in git.
set -euo pipefail

SERVER=victorvanderveen@85.10.151.75
PB=/opt/pocketbase

read -rsp "Plak het TransIP-mailwachtwoord en druk op Enter: " WACHTWOORD; echo

ssh "$SERVER" "sudo tee $PB/mail.env > /dev/null && sudo chown pocketbase:pocketbase $PB/mail.env && sudo chmod 600 $PB/mail.env && echo 'mail.env staat op de server'" <<EOF
MAIL_HOST=vps.transip.email
MAIL_PORT=587
MAIL_USER=victorvanderveen@vps.transip.email
MAIL_PASS=$WACHTWOORD
MAIL_FROM=showcase@vdveen.online
EOF
