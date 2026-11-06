/**
 * Loads the ads for the current link from PocketBase (collections
 * adshowcase_klanten, adshowcase_campagnes and adshowcase_ads, see
 * pocketbase/pb_migrations/1793200000_showcase_ads.js). Every client has its
 * own link, and every campaign its own link below it:
 *
 *   <base>/<klant>/              the client's loose set (campaign with an empty slug),
 *                                or else the list of its campaigns (in_lijst = on)
 *   <base>/<klant>/<campagne>/   one campaign
 *   <base>/                      the default client, see DEFAULT_CLIENT
 *
 * <base> is Vite's BASE_URL (vite.config.js), the fixed path the app is
 * hosted at. Since it's fixed, everything after it is the app's own routing,
 * so a new client or campaign needs no rebuild or deploy: it exists as soon
 * as its records do.
 *
 * The rest of the app gets the same shapes it got when the ads still lived in
 * public/ads/<klant>/ads.json (until November 2026):
 *
 *   ad:    { id, file, name, format, brand, primaryText?, headline?, description?, cta? }
 *          `id` is the record's item_id: decisions are keyed on it, so it never changes.
 *          `file` is the full URL of the image or video.
 *   copy:  { pageName, color, domain, cta, avatar?, primaryTexts, headlines, descriptions },
 *          or null for a campaign without pagina_naam (plain images, no Facebook card).
 *
 * The interface language is the campaign's taal, or else its client's.
 */

import { setLang, t } from './i18n';

const SLUG_RE = /^[a-z0-9-]+$/;

// The link without a client at the end predates the per-client links and was
// shared with Het Gehandicapte Kind, so it keeps showing their set.
const DEFAULT_CLIENT = 'gehandicaptekind';

// Victor's own overview of every client and campaign, for his bookmarks.
// Deliberately not at the site root: clients see that link, and must not see
// each other's campaigns. The random suffix keeps the path unguessable.
export const OVERVIEW_SLUG = 'overzicht-840415de';

const PB = (import.meta.env.VITE_POCKETBASE_URL || '').replace(/\/$/, '');
const BASE = import.meta.env.BASE_URL; // always ends in '/'

function resolveClient() {
  const path = window.location.pathname;
  const own = path.startsWith(BASE) ? path.slice(BASE.length) : '';
  const segments = own.split('/').filter((s) => s && s !== 'index.html');
  if (segments[0] === OVERVIEW_SLUG) return { overview: true, slug: '', campaign: null };
  const [slug = DEFAULT_CLIENT, campaign = null] = segments.filter((s) => SLUG_RE.test(s));
  return { overview: false, slug, campaign };
}

export const client = resolveClient();

// client.slug, plus client.campaign when there is one: unique per link,
// used to scope copy ids and the CSV export.
const scopeSlug = client.campaign ? `${client.slug}-${client.campaign}` : client.slug;

const q = (value) => `"${String(value).replace(/"/g, '\\"')}"`;

async function list(collection, params) {
  const search = new URLSearchParams({ perPage: '500', skipTotal: '1', ...params });
  const res = await fetch(`${PB}/api/collections/${collection}/records?${search}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${collection}: ${res.status}`);
  return (await res.json()).items;
}

function fileUrl(record, name) {
  return name ? `${PB}/api/files/${record.collectionId}/${record.id}/${encodeURIComponent(name)}` : '';
}

async function findCampaign(slug) {
  const [campaign] = await list('adshowcase_campagnes', {
    filter: `klant.slug=${q(client.slug)} && slug=${q(slug)}`,
    expand: 'klant',
  });
  return campaign || null;
}

/**
 * Loads the current link. Normally resolves to `{ kind: 'ads', ads, ... }`.
 * If the link names only a client that has no loose set, resolves instead to
 * `{ kind: 'campaigns', campaigns, clientName }` so the app can show the
 * campaign picker.
 */
export async function loadAds() {
  const campaign = await findCampaign(client.campaign || '');
  if (campaign) {
    const klant = campaign.expand?.klant;
    setLang(campaign.taal || klant?.taal);
    const records = await list('adshowcase_ads', { filter: `campagne=${q(campaign.id)}`, sort: 'volgorde' });
    const clientName = klant?.naam || '';
    const ads = records.map((r) => ({
      id: r.item_id,
      file: fileUrl(r, r.beeld),
      name: r.naam,
      format: r.formaat,
      brand: r.merk || clientName,
      ...(r.primaire_tekst && { primaryText: r.primaire_tekst }),
      ...(r.kop && { headline: r.kop }),
      ...(r.beschrijving && { description: r.beschrijving }),
      ...(r.cta && { cta: r.cta }),
    }));
    const copy = campaign.pagina_naam
      ? {
          pageName: campaign.pagina_naam,
          color: campaign.kleur,
          domain: campaign.domein,
          cta: campaign.cta,
          avatar: fileUrl(campaign, campaign.avatar),
          primaryTexts: campaign.primaire_teksten || [],
          headlines: campaign.koppen || [],
          descriptions: campaign.beschrijvingen || [],
        }
      : null;
    return { kind: 'ads', ads, clientName, copy, copyGroups: copyGroups(copy, clientName) };
  }
  if (client.campaign) throw new Error(t('notFound'));

  // No campaign in the link and no loose set for this client: show its campaigns.
  const [klant] = await list('adshowcase_klanten', { filter: `slug=${q(client.slug)}` });
  if (!klant) throw new Error(t('notFound'));
  setLang(klant.taal);
  const campaigns = await list('adshowcase_campagnes', {
    filter: `klant=${q(klant.id)} && in_lijst=true && slug!=""`,
    sort: '-bijgewerkt',
  });
  return {
    kind: 'campaigns',
    clientName: klant.naam,
    campaigns: campaigns.map((c) => ({ slug: c.slug, name: c.naam, updatedAt: c.bijgewerkt })),
  };
}

/** Every client with all its campaigns, for Victor's overview page. */
export async function loadOverview() {
  const [klanten, campagnes, ads] = await Promise.all([
    list('adshowcase_klanten', { sort: 'naam' }),
    list('adshowcase_campagnes', { sort: '-bijgewerkt' }),
    list('adshowcase_ads', { fields: 'campagne', perPage: '1000' }),
  ]);
  const count = {};
  for (const ad of ads) count[ad.campagne] = (count[ad.campagne] || 0) + 1;
  return klanten
    .map((k) => ({
      slug: k.slug,
      name: k.naam,
      href: `${BASE}${k.slug}/`,
      campaigns: campagnes
        .filter((c) => c.klant === k.id)
        .map((c) => ({
          name: c.slug ? c.naam || c.slug : 'Losse set',
          href: c.slug ? `${BASE}${k.slug}/${c.slug}/` : `${BASE}${k.slug}/`,
          ads: count[c.id] || 0,
          updatedAt: c.bijgewerkt,
        })),
    }))
    .filter((k) => k.campaigns.length > 0);
}

const COPY_KINDS = [
  { kind: 'primary', field: 'primaryTexts', title: 'kindPrimary' },
  { kind: 'headline', field: 'headlines', title: 'kindHeadline' },
  { kind: 'description', field: 'descriptions', title: 'kindDescription' },
];

// Copy lines are shaped like ads ({ id, name, format, brand }) so decisions,
// server sync and the CSV export treat them the same. The id holds the
// position: reordering the texts moves their decisions along.
function copyGroups(copy, clientName) {
  if (!copy) return [];
  return COPY_KINDS.map(({ kind, field, title: titleKey }) => {
    const title = t(titleKey);
    return {
      kind,
      title,
      items: (copy[field] || []).map((text, index) => ({
        id: `${scopeSlug}-copy-${kind}-${index + 1}`,
        name: text,
        format: title,
        brand: clientName,
      })),
    };
  }).filter((group) => group.items.length > 0);
}

/** URL of an ad image or avatar (already a full URL since the ads live in PocketBase). */
export function adImageUrl(file) {
  return file;
}

/** Link to one campaign of the current client. */
export function campaignUrl(campaignSlug) {
  return `${BASE}${client.slug}/${campaignSlug}/`;
}
