# Meta Ad Showcase

Client-facing tool voor het **goedkeuren** van Meta-advertenties. Toont een galerij
van gegenereerde ads (uit [meta-ad-creator](../meta-ad-creator)) waarin de klant per
advertentie kan **goedkeuren / afwijzen** en een **opmerking** kan achterlaten. De
beslissingen zijn exporteerbaar als CSV.

## Stack
React + Vite. Beslissingen gaan via een opslag-abstractie (`src/lib/storage.js`) eerst
naar `localStorage` en daarna naar PocketBase op `db.vdveen.online` (collectie
`adshowcase_beoordelingen`). Bij het laden worden beide kanten per advertentie samengevoegd: de
nieuwste `updatedAt` wint.

## Ontwikkelen
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # productiebuild in dist/
npm run lint
```

## Waar de ads staan
Sinds november 2026 staan klanten, campagnes, teksten en beelden in **PocketBase** op
`db.vdveen.online` (collecties `adshowcase_klanten`, `adshowcase_campagnes`, `adshowcase_ads`).
Een wijziging in het dashboard is na herladen meteen live, zonder git of deploy.

| Link | Toont |
|---|---|
| `db.vdveen.online/showcase/<klant>/` | de losse set van de klant (campagne met lege slug), anders de campagnekiezer (`in_lijst` aan) |
| `db.vdveen.online/showcase/<klant>/<campagne>/` | één campagne |
| `db.vdveen.online/showcase/` | Het Gehandicapte Kind (`DEFAULT_CLIENT`) |
| `db.vdveen.online/showcase/overzicht-840415de/` | Victors overzicht van alles |

- **Concept**: zet `actief` uit, dan zien klanten de campagne niet.
- **`item_id` nooit wijzigen**: daar hangen de beoordelingen aan.
- De oude links op GitHub Pages (`…github.io/meta-ad-showcase/…`) sturen door naar hetzelfde pad
  op db.vdveen.online (`pages-redirect/`).

Nieuwe ads komen via de knop "Zet in showcase" in meta-ad-creator. De oude map `public/ads`,
het importscript en het vergelijkscript zijn op 6-11-2026 weggehaald (staan in de git-geschiedenis,
commit 7edb8c8).

## Scripts
```bash
# app, migratie en mailhook naar de server (alleen bij codewijzigingen)
./pocketbase/app-naar-server.sh
```
