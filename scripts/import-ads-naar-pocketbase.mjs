// Zet de ads uit public/ads/ in PocketBase (collecties uit pocketbase/pb_migrations/1793200000_showcase_ads.js).
//
//   node --env-file=../me-timer/.env.migratie.local scripts/import-ads-naar-pocketbase.mjs
//   node --env-file=… scripts/import-ads-naar-pocketbase.mjs uaf            alleen één klant
//   node --env-file=… scripts/import-ads-naar-pocketbase.mjs uaf/women-power
//
// Idempotent: opnieuw draaien werkt bij, maakt niets dubbel. Een beeld gaat alleen opnieuw
// omhoog als het bestand veranderd is (bron_hash). Ads die niet meer in ads.json staan,
// verdwijnen uit die campagne. Klanten en campagnes die niet meer in public/ads staan,
// blijven staan: die ruim je zelf op in het dashboard.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ADS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../public/ads');
const BASE = (process.env.PB_URL || '').replace(/\/$/, '');
if (!BASE || !process.env.PB_ADMIN_EMAIL) throw new Error('PB_URL / PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD ontbreken (gebruik --env-file)');
const [alleenKlant, alleenCampagne] = (process.argv[2] || '').split('/');

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' };

let token = '';
async function api(pad, { method = 'GET', json, form } = {}) {
  const res = await fetch(BASE + pad, {
    method,
    headers: { Authorization: token, ...(json ? { 'Content-Type': 'application/json' } : {}) },
    body: json ? JSON.stringify(json) : form,
  });
  const body = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${pad}: ${res.status} ${JSON.stringify(body)}`);
  return body;
}
const records = (c) => `/api/collections/${c}/records`;
const q = (s) => `"${String(s).replace(/"/g, '\\"')}"`;
async function zoek(c, filter) {
  const r = await api(`${records(c)}?perPage=500&skipTotal=1&filter=${encodeURIComponent(filter)}`);
  return r.items;
}
async function bewaar(c, bestaand, velden, bestanden = {}) {
  let form;
  if (Object.keys(bestanden).length) {
    form = new FormData();
    for (const [k, v] of Object.entries(velden)) {
      form.append(k, v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
    for (const [k, file] of Object.entries(bestanden)) {
      form.append(k, new Blob([fs.readFileSync(file)], { type: MIME[path.extname(file).toLowerCase()] }), path.basename(file));
    }
  }
  const opts = form ? { form } : { json: velden };
  return bestaand
    ? api(`${records(c)}/${bestaand.id}`, { method: 'PATCH', ...opts })
    : api(records(c), { method: 'POST', ...opts });
}
const leesJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

({ token } = await api('/api/collections/_superusers/auth-with-password', {
  method: 'POST',
  json: { identity: process.env.PB_ADMIN_EMAIL, password: process.env.PB_ADMIN_PASSWORD },
}));

const telling = { klanten: 0, campagnes: 0, ads: 0, beelden: 0, weg: 0 };

for (const klantSlug of fs.readdirSync(ADS_DIR).filter((n) => fs.statSync(path.join(ADS_DIR, n)).isDirectory()).sort()) {
  if (alleenKlant && klantSlug !== alleenKlant) continue;
  const dir = path.join(ADS_DIR, klantSlug);
  const lijst = leesJson(path.join(dir, 'campaigns.json'));
  const sets = [];
  if (fs.existsSync(path.join(dir, 'ads.json'))) sets.push({ slug: '', dir });
  for (const sub of fs.readdirSync(dir).sort()) {
    if (fs.existsSync(path.join(dir, sub, 'ads.json'))) sets.push({ slug: sub, dir: path.join(dir, sub) });
  }
  if (!sets.length) continue;
  const eersteData = leesJson(path.join(sets[0].dir, 'ads.json'));

  const [klantRec] = await zoek('adshowcase_klanten', `slug=${q(klantSlug)}`);
  const klant = await bewaar('adshowcase_klanten', klantRec, {
    slug: klantSlug,
    naam: lijst?.client || eersteData.client || klantSlug,
    taal: lijst?.lang || '',
  });
  telling.klanten++;
  const gelijst = new Map((lijst?.campaigns || []).map((c) => [c.slug, c]));

  for (const set of sets) {
    if (alleenCampagne !== undefined && set.slug !== alleenCampagne) continue;
    const data = leesJson(path.join(set.dir, 'ads.json'));
    const copy = data.copy || {};
    const meta = gelijst.get(set.slug);
    const [campRec] = await zoek('adshowcase_campagnes', `klant=${q(klant.id)} && slug=${q(set.slug)}`);
    const avatarBestand = copy.avatar ? path.join(set.dir, copy.avatar) : null;
    const campagne = await bewaar(
      'adshowcase_campagnes',
      campRec,
      {
        klant: klant.id,
        slug: set.slug,
        naam: meta?.name || (set.slug ? set.slug : data.client || ''),
        actief: true,
        in_lijst: gelijst.has(set.slug),
        bijgewerkt: meta?.updatedAt || '',
        taal: data.lang || '',
        pagina_naam: copy.pageName || '',
        kleur: copy.color || '',
        domein: copy.domain || '',
        cta: copy.cta || '',
        primaire_teksten: copy.primaryTexts || [],
        koppen: copy.headlines || [],
        beschrijvingen: copy.descriptions || [],
      },
      // Avatar alleen bij de eerste keer; daarna beheer je hem in het dashboard
      avatarBestand && !campRec?.avatar ? { avatar: avatarBestand } : {}
    );
    telling.campagnes++;

    const bestaand = new Map((await zoek('adshowcase_ads', `campagne=${q(campagne.id)}`)).map((r) => [r.item_id, r]));
    for (const [i, ad] of (data.ads || []).entries()) {
      const bestand = path.join(set.dir, ad.file);
      const h = hash(bestand);
      // item_id is uniek over alle campagnes: een ad die verhuisd is, nemen we mee
      const rec = bestaand.get(ad.id) || (await zoek('adshowcase_ads', `item_id=${q(ad.id)}`))[0];
      const nieuwBeeld = !rec || rec.bron_hash !== h;
      await bewaar(
        'adshowcase_ads',
        rec,
        {
          campagne: campagne.id,
          item_id: ad.id,
          volgorde: i + 1,
          naam: ad.name || '',
          formaat: ad.format || '',
          merk: ad.brand || '',
          primaire_tekst: ad.primaryText || '',
          kop: ad.headline || '',
          beschrijving: ad.description || '',
          cta: ad.cta || '',
          bron_hash: h,
        },
        nieuwBeeld ? { beeld: bestand } : {}
      );
      bestaand.delete(ad.id);
      telling.ads++;
      if (nieuwBeeld) telling.beelden++;
    }
    for (const oud of bestaand.values()) {
      await api(`${records('adshowcase_ads')}/${oud.id}`, { method: 'DELETE' });
      telling.weg++;
    }
    console.log(`${klantSlug}/${set.slug || '(losse set)'}: ${(data.ads || []).length} ads`);
  }
}

console.log(`\nKlaar: ${telling.klanten} klanten, ${telling.campagnes} campagnes, ${telling.ads} ads (${telling.beelden} beelden geüpload, ${telling.weg} verwijderd).`);
