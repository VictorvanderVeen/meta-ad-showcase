# Plan: showcase-ads van GitHub naar PocketBase

Stand: 6-11-2026. Stap 1–5 gebouwd en lokaal getest (PocketBase 0.40.4): import 198/198 ads byte-gelijk, alle linkvormen, video, talen, conceptvlag.
Live sinds 6-11: server, import (198/198 byte-gelijk op productie), Pages verwijst door. Stap 6 (creator) gebouwd en getest 6-11 (endpoints tegen productie, testklant weer verwijderd; knop in de browser nog niet doorgeklikt). Nog te doen: stap 7 (opruimen).

**Beslissingen 6-11:** app op db.vdveen.online/showcase/ · teksten als losse velden (bewerkbaar in dashboard) · geen historie-hook, periodieke export volstaat · Levon-beelden terug op te beoordelen (gedaan, teksten blijven goedgekeurd).

## Waarom

Nu staan teksten en beelden van elke campagne als bestanden in deze repo (`public/ads/<klant>/<campagne>/ads.json` + jpg's). Elke wijziging, ook twee zinnen, kost een commit, een build en een deploy op GitHub Pages van 2 tot 8 minuten. De beoordelingen staan al in PocketBase op db.vdveen.online (collectie `adshowcase_beoordelingen`, id `pbc_3943143483`).

**Doel:** een tekst of beeld aanpassen is binnen seconden live, zonder git. Kleine tekstwijzigingen kan Victor zelf in het PocketBase-dashboard doen.

## Hoe het nu werkt (de punten die ertoe doen)

- `src/lib/ads.js` haalt `ads.json` en `campaigns.json` op met `fetch` vanaf `client.root + 'ads/…'`. Beeld-URL's komen uit `adUrl()` (r. ~170).
- `vite.config.js` → `clientPages()` maakt **tijdens de build** één `index.html` per klant en per campagne, met `window.__SHOWCASE_LINK__ = {slug, campaign, consumed}`. Daardoor vraagt ook een **nieuwe** campagne nu nog om een deploy, ook als de data in PocketBase staat.
- `overviewPage()` maakt Victors geheime overzicht (`/overzicht-840415de/`) uit de mappen.
- De "Zet in showcase"- en "Live zetten"-knoppen in de **creator** (`meta-ad-creator/vite.config.js`, `/__showcase/…`) schrijven naar deze repo en pushen die.
- Schaal: 9 klanten, 17 `ads.json`, ~75 MB beelden.

## Ontwerp

### Datamodel (PocketBase)

1. **`adshowcase_campagnes`**: `klant` (slug), `campagne` (slug, leeg = losse set), `naam`, `lang`, `copy` (json: pageName, color, domain, cta, primaryTexts, headlines, descriptions), `avatar` (file), `volgorde`, `actief` (bool).
   Uniek op (klant, campagne).
2. **`adshowcase_ads`**: `campagne` (relation), `item_id` (tekst, **exact de huidige id**, zodat beoordelingen blijven kloppen), `naam`, `format`, `brand`, `primaryText`, `headline`, `description`, `cta`, `beeld` (file: jpg/png/mp4), `volgorde`.
3. Klantniveau (`client`, `lang` uit `campaigns.json`): als velden in `adshowcase_campagnes` met lege `campagne`, of een kleine `adshowcase_klanten`. Kies de eenvoudigste die werkt.

**Rechten:** list/view **openbaar** (klanten kijken zonder inlog). Create/update/delete **alleen superuser**. Het verschil met beoordelingen: die zijn open voor schrijven, de ads niet.

**Beelden:** in het `file`-veld van PocketBase. URL `https://db.vdveen.online/api/files/<collectie>/<record>/<bestand>`. Thumbs niet nodig: de jpg's zijn al 1080 px.

### Hosting en links

Beslissing nodig (zie open vragen). Aanbevolen: **de app zelf ook op db.vdveen.online** (bv. `/showcase/`) via Caddy met SPA-fallback (`try_files {path} /showcase/index.html`). Dan:
- verdwijnt `clientPages()` en `__SHOWCASE_LINK__`: de app leest klant/campagne gewoon uit de URL, want het hostingpad is vast en bekend;
- vraagt een nieuwe klant of campagne geen deploy meer;
- deploy van de app (alleen bij codewijzigingen) via `pocketbase/naar-server.sh`-achtige rsync van `dist/`.

**Oude links blijven werken:** de GitHub Pages-versie blijft bestaan, maar met dezelfde app die uit PocketBase leest (of een redirect-pagina per oude link naar de nieuwe). Klanten hebben de Pages-links al gekregen, die mogen niet breken.

## Stappen

1. **Collecties aanmaken**: een migratie in `pocketbase/pb_migrations/` (zelfde stijl als de bestaande), uitrol via `naar-server.sh` (Victor draait die zelf; auto mode blokkeert deploy naar de server).
2. **Importscript** `scripts/import-ads-naar-pocketbase.mjs`: loopt door `public/ads/**`, maakt campagne- en ad-records, uploadt de beelden, en is **idempotent** (opnieuw draaien = bijwerken, geen dubbele records). Superuser-token uit env, niet in de repo.
3. **App ombouwen**: `src/lib/ads.js` haalt uit PocketBase in plaats van uit `public/ads`. Behoud dezelfde vorm van het object dat de rest van de app krijgt, dan hoeven `App.jsx`, `AdCard`, `FeedAd` en `CampaignList` niet of nauwelijks te veranderen. `adUrl()` geeft de PocketBase-file-URL.
4. **Overzichtspagina**: `overviewPage()` wordt een runtime-pagina die de lijst uit PocketBase haalt (blijft op het geheime pad, `noindex`).
5. **Hosting** volgens de gekozen optie (Caddy-blok + SPA-fallback, of Pages houden).
6. **Creator-knoppen** (gedaan): "Zet in showcase" schrijft via de dev-server (`meta-ad-creator/showcase-pocketbase.js`, superuser uit `.env.local`) rechtstreeks in PocketBase, upsert op `item_id`, beeld alleen opnieuw omhoog als de hash verandert. Nieuwe campagne krijgt `in_lijst = uit`: werkt via de eigen link, staat niet in de klantlijst. "Live zetten" is vervangen door "Zet in klantlijst" (`in_lijst = aan`). Een losse set naast bestaande campagnes wordt geweigerd (409).
7. **Opruimen** pas als alles live werkt en vergeleken is: `public/ads/` uit de repo (blijft in de git-geschiedenis), `apps-script/` (dood spoor) erbij.

## Controle vóór "klaar"

- Elke bestaande link (alle 17 sets plus de campagnekiezers) toont hetzelfde aantal ads, dezelfde teksten en dezelfde beelden als nu. Vergelijk automatisch: oude `ads.json` tegen API-respons.
- Beoordelingen staan nog op de juiste ad (item_id ongewijzigd). Test met een klant die er veel heeft (gehandicaptekind).
- Taal per klant (nl/en/de/sv) en de video-ads van FUS werken.
- Een tekst aanpassen in het dashboard is na een herlaadbeurt meteen zichtbaar.
- Een nieuwe testcampagne aanmaken lukt zonder deploy.

## Risico's

- **Geen versiegeschiedenis meer** zoals git die gaf. Opvangen: eenvoudige `adshowcase_historie`-hook (oude waarde bij elke update), of het importscript ook als exportscript gebruiken en periodiek een JSON-dump maken.
- **Eén server = één storingspunt.** De beoordelingen hangen al aan dezelfde server, dus dat risico bestaat al. Backups van `/opt/pocketbase/pb_data` checken.
- **CORS**: als de app op Pages blijft draaien, moet PocketBase cross-origin lezen toestaan (doet het standaard).
- **Mailmelding-hook** (`showcase_melding.pb.js`) gebruikt `klant`. Controleer dat die niet afhangt van de bestandsstructuur.

## Open vragen voor Victor

1. **Hosting:** app ook naar db.vdveen.online (aanbevolen, geen deploys meer voor nieuwe campagnes) of op GitHub Pages laten en alleen de data verhuizen (minder werk, nieuwe campagne vraagt nog een deploy)?
2. Wil je in het PocketBase-dashboard zelf teksten aanpassen, of altijd via Claude/creator? Dat bepaalt hoe leesbaar de velden moeten zijn (losse velden vs. één json-blok).
3. Versiegeschiedenis nodig, of is een periodieke export genoeg?
