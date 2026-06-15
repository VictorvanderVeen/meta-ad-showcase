/**
 * Loads the ad manifest. Drop exported PNGs from meta-ad-creator into
 * public/ads/ and list them in public/ads/ads.json:
 *
 *   { "ads": [ { "id", "file", "name", "format", "brand" }, ... ] }
 *
 * `file` is relative to public/ads/. `id` must be stable — decisions are keyed on it.
 */
export async function loadAds() {
  const res = await fetch('ads/ads.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Kon ads.json niet laden (${res.status})`);
  const data = await res.json();
  return Array.isArray(data.ads) ? data.ads : [];
}

/** Path to an ad image, relative to the app base. */
export function adImageUrl(file) {
  return `ads/${file}`;
}
