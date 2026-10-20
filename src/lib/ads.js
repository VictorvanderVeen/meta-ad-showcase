/**
 * Loads the ad manifest for the current link. Every client has its own
 * folder and its own link:
 *
 *   public/ads/<klant>/ads.json              →  …/meta-ad-showcase/<klant>/
 *   public/ads/<klant>/<campagne>/ads.json   →  …/meta-ad-showcase/<klant>/<campagne>/
 *
 *   ads.json:        { "client": "Naam", "ads": [ { "id", "file", "name", "format", "brand" }, ... ], "copy": {...} }
 *                    An ad may carry its own "primaryText": that ad then always shows it in its Facebook card.
 *   campaigns.json:  { "client": "Naam", "campaigns": [ { "slug", "name", "updatedAt" }, ... ] }
 *
 * A client is either a single campaign (ads.json directly in its folder —
 * the shape before campaigns existed) or an archive of campaigns (a
 * campaigns.json listing plus one subfolder per campaign, each with its own
 * ads.json). Which shape a client has isn't decided by a build-time list:
 * the app tries the most specific link first (`<klant>/<campagne>/ads.json`)
 * and falls back to the archive listing, so a campaign folder added by the
 * creator works immediately, with or without a rebuild.
 *
 * `copy` on ads.json is optional: the Meta copy that runs with the images.
 * With it, every ad is shown as a Facebook feed ad and the texts get their
 * own decisions.
 *
 *   { "pageName", "color", "domain", "cta",
 *     "primaryTexts": [], "headlines": [], "descriptions": [] }
 *
 * `file` is relative to the client/campaign folder. `id` must be stable —
 * decisions are keyed on it — and unique across clients and campaigns
 * (prefix it with the client slug, and the campaign slug when there is one).
 */

const SLUG_RE = /^[a-z0-9-]+$/;

// The link without a client at the end predates the per-client folders and was
// shared with Het Gehandicapte Kind, so it keeps showing their set.
const DEFAULT_CLIENT = 'gehandicaptekind';

function resolveClient() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  if (segments.at(-1) === 'index.html') segments.pop();

  // A built page (vite.config.js's clientPages()) states exactly which
  // client/campaign it is for, because a GitHub Pages project site is
  // itself served from a path segment (…/meta-ad-showcase/<klant>/…) — the
  // app can't tell that prefix apart from its own routing just by counting
  // segments at runtime, "meta-ad-showcase" is as valid a slug as "hamlin"
  // is. The dev server has no such prefix, so it keeps guessing from the URL.
  const link = window.__SHOWCASE_LINK__;
  let slug = DEFAULT_CLIENT;
  let campaign = null;
  let consumed = 0;

  if (link) {
    slug = link.slug;
    campaign = link.campaign || null;
    consumed = link.consumed;
  } else if (import.meta.env.DEV) {
    // A client/campaign link has two slug-shaped segments at the end; a
    // client-only link (single campaign, or an archive's own index) has one.
    if (segments.length >= 2 && SLUG_RE.test(segments.at(-2)) && SLUG_RE.test(segments.at(-1))) {
      campaign = segments.at(-1);
      slug = segments.at(-2);
      consumed = 2;
    } else if (SLUG_RE.test(segments.at(-1))) {
      slug = segments.at(-1);
      consumed = 1;
    }
  }

  // Absolute path of the app root, so ad files resolve the same with or
  // without the client/campaign segments (and with or without a trailing slash).
  const rootSegments = consumed ? segments.slice(0, segments.length - consumed) : segments;
  const root = rootSegments.length ? `/${rootSegments.join('/')}/` : '/';
  return { slug, campaign, root };
}

export const client = resolveClient();

// client.slug, plus client.campaign when there is one: unique per link,
// used to scope ad ids and the CSV export.
const scopeSlug = client.campaign ? `${client.slug}-${client.campaign}` : client.slug;

function scopeDir() {
  return client.campaign ? `${client.slug}/${client.campaign}/` : `${client.slug}/`;
}

/**
 * Loads the current link. Normally resolves to `{ kind: 'ads', ads, ... }`.
 * If the link names only a client and that client turns out to hold
 * campaigns rather than ads directly, resolves instead to
 * `{ kind: 'campaigns', campaigns, clientName }` so the app can show the
 * archive picker.
 */
export async function loadAds() {
  const data = await fetchJson(`${client.root}ads/${scopeDir()}ads.json`);
  if (data) {
    const ads = Array.isArray(data.ads) ? data.ads : [];
    const clientName = data.client || ads[0]?.brand || '';
    return {
      kind: 'ads',
      ads,
      clientName,
      copy: data.copy || null,
      copyGroups: copyGroups(data.copy, clientName),
    };
  }
  if (client.campaign) throw new Error('Kon ads.json niet laden');

  // No campaign in the link and no ads.json directly in the client folder:
  // this client is an archive of campaigns, so load its listing instead.
  const list = await fetchJson(`${client.root}ads/${client.slug}/campaigns.json`);
  if (!list) throw new Error('Kon ads.json niet laden');
  const campaigns = Array.isArray(list.campaigns) ? list.campaigns : [];
  return {
    kind: 'campaigns',
    clientName: list.client || '',
    campaigns: [...campaigns].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
  };
}

// A dev/preview static server falls back to index.html (status 200) for a
// path that doesn't exist, so `res.ok` alone can't tell "missing" from
// "found" — the content-type can. Treats anything that isn't real JSON as
// not found, which is what both a true 404 and that HTML fallback mean here.
async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null;
  return res.json();
}

const COPY_KINDS = [
  { kind: 'primary', field: 'primaryTexts', title: 'Primaire tekst (boven het beeld)' },
  { kind: 'headline', field: 'headlines', title: 'Kop (onder het beeld)' },
  { kind: 'description', field: 'descriptions', title: 'Beschrijving (onder de kop)' },
];

// Copy lines are shaped like ads ({ id, name, format, brand }) so decisions,
// server sync and the CSV export treat them the same. The id holds the
// position: reordering the texts in ads.json moves their decisions along.
function copyGroups(copy, clientName) {
  if (!copy) return [];
  return COPY_KINDS.map(({ kind, field, title }) => ({
    kind,
    title,
    items: (copy[field] || []).map((text, index) => ({
      id: `${scopeSlug}-copy-${kind}-${index + 1}`,
      name: text,
      format: title,
      brand: clientName,
    })),
  })).filter((group) => group.items.length > 0);
}

/** Path to an ad image of the current client/campaign. */
export function adImageUrl(file) {
  return `${client.root}ads/${scopeDir()}${file}`;
}

/** Link to one campaign of the current (archive) client. */
export function campaignUrl(campaignSlug) {
  return `${client.root}${client.slug}/${campaignSlug}/`;
}
