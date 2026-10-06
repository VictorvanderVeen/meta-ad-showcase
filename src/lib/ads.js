/* global __CLIENT_SLUGS__ */
/**
 * Loads the ad manifest of one client. Every client has its own folder and
 * its own link:
 *
 *   public/ads/<klant>/ads.json   →   …/meta-ad-showcase/<klant>/
 *
 *   { "client": "Naam", "ads": [ { "id", "file", "name", "format", "brand" }, ... ], "copy": { ... } }
 *
 * `copy` is optional: the Meta copy that runs with the images. With it, every
 * ad is shown as a Facebook feed ad and the texts get their own decisions.
 *
 *   { "pageName", "color", "domain", "cta",
 *     "primaryTexts": [], "headlines": [], "descriptions": [] }
 *
 * `file` is relative to the client folder. `id` must be stable — decisions are
 * keyed on it — and unique across clients (prefix it with the client slug).
 */

// The link without a client at the end predates the per-client folders and was
// shared with Het Gehandicapte Kind, so it keeps showing their set.
const DEFAULT_CLIENT = 'gehandicaptekind';

// Client folders known at build time (see vite.config.js). The dev server
// accepts any last path segment, so a folder added while it runs works at once.
function isClientSlug(segment) {
  if (!segment) return false;
  return import.meta.env.DEV ? /^[a-z0-9-]+$/.test(segment) : __CLIENT_SLUGS__.includes(segment);
}

function resolveClient() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  if (segments.at(-1) === 'index.html') segments.pop();

  let slug = DEFAULT_CLIENT;
  if (isClientSlug(segments.at(-1))) slug = segments.pop();

  // Absolute path of the app root, so ad files resolve the same with or
  // without the client segment (and with or without a trailing slash).
  const root = segments.length ? `/${segments.join('/')}/` : '/';
  return { slug, root };
}

export const client = resolveClient();

export async function loadAds() {
  const res = await fetch(`${client.root}ads/${client.slug}/ads.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Kon ads.json niet laden (${res.status})`);
  const data = await res.json();
  const ads = Array.isArray(data.ads) ? data.ads : [];
  const clientName = data.client || ads[0]?.brand || '';
  return { ads, clientName, copy: data.copy || null, copyGroups: copyGroups(data.copy, clientName) };
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
      id: `${client.slug}-copy-${kind}-${index + 1}`,
      name: text,
      format: title,
      brand: clientName,
    })),
  })).filter((group) => group.items.length > 0);
}

/** Path to an ad image of the current client. */
export function adImageUrl(file) {
  return `${client.root}ads/${client.slug}/${file}`;
}
