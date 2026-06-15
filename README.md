# Meta Ad Showcase

Client-facing tool voor het **goedkeuren** van Meta-advertenties. Toont een galerij
van gegenereerde ads (uit [meta-ad-creator](../meta-ad-creator)) waarin de klant per
advertentie kan **goedkeuren / afwijzen** en een **opmerking** kan achterlaten. De
beslissingen zijn exporteerbaar als CSV.

## Stack
React + Vite. Beslissingen worden (voorlopig) opgeslagen in `localStorage` via een
opslag-abstractie (`src/lib/storage.js`) zodat omzetten naar een gedeelde backend
(bijv. Supabase) een wijziging van één bestand is.

## Ontwikkelen
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # productiebuild in dist/
npm run lint
```

## Advertenties toevoegen
1. Exporteer PNG's uit meta-ad-creator.
2. Zet ze in `public/ads/`.
3. Voeg ze toe aan `public/ads/ads.json`:

```json
{
  "ads": [
    { "id": "ft-001", "file": "ft-001.png", "name": "Volg de natuur", "format": "1:1", "brand": "Follow This" }
  ]
}
```

> `id` moet stabiel zijn — goedkeuringen worden erop gekoppeld.

## Beslissingen ophalen
De klant exporteert via **Exporteer CSV** (kolommen: id, name, format, brand, status,
comment, updatedAt). Bij een latere Supabase-koppeling komen beslissingen centraal binnen.
