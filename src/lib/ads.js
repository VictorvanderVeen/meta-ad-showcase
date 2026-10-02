/* global __CLIENT_SLUGS__ */
/**
 * Loads the ad manifest of one client. Every client has its own folder and
 * its own link:
 *
 *   public/ads/<klant>/ads.json   →   …/meta-ad-showcase/<klant>/
 *
 *   { "client": "Naam", "ads": [ { "id", "file", "name", "format", "brand" }, ... ] }
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
  return { ads, clientName: data.client || ads[0]?.brand || '' };
}

/** Path to an ad image of the current client. */
export function adImageUrl(file) {
  return `${client.root}ads/${client.slug}/${file}`;
}
