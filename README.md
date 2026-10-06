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

## Eén map en één link per klant
Elke klant heeft een eigen map in `public/ads/` en daarmee een eigen link:

| Map | Link |
|---|---|
| `public/ads/gehandicaptekind/` | `…/meta-ad-showcase/gehandicaptekind/` |
| `public/ads/hamlin/` | `…/meta-ad-showcase/hamlin/` |

De link zonder klant erachter (`…/meta-ad-showcase/`) toont de set van Het
Gehandicapte Kind: die link was al gedeeld voordat de klantmappen er waren
(`DEFAULT_CLIENT` in `src/lib/ads.js`).

De repo is openbaar: wie de repo vindt, kan de mappen van alle klanten zien.

## Advertenties toevoegen
**Vanuit meta-ad-creator (aanbevolen):** maak een batch en klik op **Zet in
showcase**. De advertenties (verkleind tot JPEG, enkele honderden KB per stuk) en `ads.json` komen dan in `public/ads/<klant>/` te staan. De
knop werkt alleen in de lokale creator (`npm run dev` / `start.command`). Bestaande
advertenties met hetzelfde `id` worden vervangen, de rest blijft staan.

**Met de hand:** zet de afbeeldingen (liefst JPEG van 1080 px breed) in `public/ads/<klant>/` en vul
`public/ads/<klant>/ads.json`:

```json
{
  "client": "Follow This",
  "ads": [
    { "id": "follow-this-001", "file": "ft-001.png", "name": "Volg de natuur", "format": "1:1", "brand": "Follow This" }
  ]
}
```

> `id` moet stabiel zijn — goedkeuringen worden erop gekoppeld — en uniek over alle
> klanten heen. Begin het daarom met de klantmap-naam.

Live gaat het pas na een push naar `main` (GitHub Pages bouwt dan opnieuw). Bij de
build krijgt elke klantmap een eigen `index.html`; een nieuwe klantmap werkt in
`npm run dev` meteen.

## Beslissingen ophalen
Beslissingen komen binnen in PocketBase, collectie **adshowcase_beoordelingen** op
`db.vdveen.online`: één regel per advertentie of tekst, altijd de laatste stand. De
kolom `klant` is de klantmap-naam.

Iedereen met de link ziet en wijzigt dezelfde beoordelingen. De knop **Exporteer CSV**
blijft werken als reservekopie (kolommen: id, name, format, brand, status, comment,
updatedAt).

### Nieuwe ronde
De database koppelt op `id`. Gebruik voor een nieuwe ronde nieuwe id's in `ads.json`;
oude regels blijven dan staan zonder de nieuwe ronde te beïnvloeden.

### Collectie opnieuw aanmaken
```bash
node --env-file=../me-timer/.env.migratie.local scripts/pocketbase-setup.mjs
```
Het serveradres staat in `.env` (`VITE_POCKETBASE_URL`). Dat is niet geheim; leeg laten
betekent alleen lokaal opslaan. De map `apps-script/` is de oude Google Sheet-koppeling
en wordt niet meer gebruikt.
