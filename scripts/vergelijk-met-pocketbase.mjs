// Controleert of PocketBase precies toont wat public/ads/ toonde: zelfde ads in dezelfde
// volgorde, dezelfde teksten en byte-voor-byte dezelfde beelden. Leest alleen via de
// openbare API (zoals een klant), dus er is geen wachtwoord nodig.
//
//   PB_URL=https://db.vdveen.online node scripts/vergelijk-met-pocketbase.mjs

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ADS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../public/ads');
const PB = (process.env.PB_URL || 'https://db.vdveen.online').replace(/\/$/, '');
const q = (s) => `"${s}"`;
const get = async (c, filter, extra = '') => {
  const res = await fetch(`${PB}/api/collections/${c}/records?perPage=500&skipTotal=1&filter=${encodeURIComponent(filter)}${extra}`);
  if (!res.ok) throw new Error(`${c}: ${res.status}`);
  return (await res.json()).items;
};
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

let fouten = 0;
const fout = (waar, wat) => { fouten++; console.log(`✕ ${waar}: ${wat}`); };

const bestanden = execSync(`find "${ADS_DIR}" -name ads.json`).toString().trim().split('\n').sort();
for (const f of bestanden) {
  const rel = path.relative(ADS_DIR, path.dirname(f));
  const [klant, campagne = ''] = rel.split(path.sep);
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  const [camp] = await get('adshowcase_campagnes', `klant.slug=${q(klant)} && slug=${q(campagne)}`, '&expand=klant');
  if (!camp) { fout(rel, 'campagne ontbreekt'); continue; }
  const copy = data.copy || {};
  const verwacht = { pagina_naam: copy.pageName || '', kleur: copy.color || '', domein: copy.domain || '', cta: copy.cta || '',
    primaire_teksten: copy.primaryTexts || [], koppen: copy.headlines || [], beschrijvingen: copy.descriptions || [] };
  for (const [k, v] of Object.entries(verwacht)) {
    if (JSON.stringify(camp[k] ?? (Array.isArray(v) ? [] : '')) !== JSON.stringify(v)) fout(rel, `campagneveld ${k} wijkt af`);
  }
  if ((data.lang || '') !== camp.taal && !(data.lang === undefined && camp.taal === '')) fout(rel, `taal ${data.lang} ≠ ${camp.taal}`);
  if (copy.avatar && !camp.avatar) fout(rel, 'avatar ontbreekt');

  const ads = await get('adshowcase_ads', `campagne=${q(camp.id)}`, '&sort=volgorde');
  if (ads.length !== data.ads.length) fout(rel, `${ads.length} ads in PocketBase, ${data.ads.length} in ads.json`);
  for (const [i, ad] of data.ads.entries()) {
    const r = ads[i];
    if (!r || r.item_id !== ad.id) { fout(rel, `positie ${i + 1}: ${r?.item_id} ≠ ${ad.id}`); continue; }
    const paren = [['naam', ad.name], ['formaat', ad.format], ['merk', ad.brand], ['primaire_tekst', ad.primaryText],
      ['kop', ad.headline], ['beschrijving', ad.description], ['cta', ad.cta]];
    for (const [k, v] of paren) if ((r[k] || '') !== (v || '')) fout(`${rel}/${ad.id}`, `${k} wijkt af`);
    const res = await fetch(`${PB}/api/files/${r.collectionId}/${r.id}/${encodeURIComponent(r.beeld)}`);
    const beeld = Buffer.from(await res.arrayBuffer());
    if (!res.ok || sha(beeld) !== sha(fs.readFileSync(path.join(path.dirname(f), ad.file)))) fout(`${rel}/${ad.id}`, 'beeld wijkt af');
  }
  console.log(`${fouten ? '·' : '✓'} ${rel || klant}: ${data.ads.length} ads`);
}
console.log(fouten ? `\n${fouten} verschil(len) gevonden.` : `\nAlles gelijk: ${bestanden.length} sets.`);
process.exit(fouten ? 1 : 0);
