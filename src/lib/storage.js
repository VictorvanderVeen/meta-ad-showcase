/**
 * Decision storage abstraction.
 *
 * The whole app talks to this module — never to localStorage or the network
 * directly. Storage is local-first: every change lands in localStorage at once
 * and is then pushed to PocketBase (collection adshowcase_beoordelingen, see
 * scripts/pocketbase-setup.mjs). On load both sides are merged per ad, newest
 * updatedAt wins.
 *
 * A decision is: { status: 'pending' | 'approved' | 'rejected', comment: string, updatedAt?: string }
 */

import { client } from './ads';

const KEY = 'mas-decisions-v1';

// PocketBase server. Empty = local-only, nothing leaves the browser.
const BASE = (import.meta.env.VITE_POCKETBASE_URL || '').replace(/\/$/, '');
// The collection id rather than its name, so renaming it in the admin breaks nothing.
const ENDPOINT = BASE ? `${BASE}/api/collections/pbc_3943143483/records` : '';

const PUSH_DELAY_MS = 800;

export const EMPTY_DECISION = { status: 'pending', comment: '' };

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function writeAll(map) {
  localStorage.setItem(KEY, JSON.stringify(map));
}

/** Returns a map of adId -> decision for all ads that have one. */
export function getAllDecisions() {
  return readAll();
}

/** Returns the decision for one ad, or a pending default. */
export function getDecision(adId) {
  return readAll()[adId] || { ...EMPTY_DECISION };
}

/** Merges a partial decision (status and/or comment) and stamps the time. */
export function setDecision(adId, partial) {
  const all = readAll();
  all[adId] = {
    ...EMPTY_DECISION,
    ...all[adId],
    ...partial,
    updatedAt: new Date().toISOString(),
  };
  writeAll(all);
  schedulePush(adId);
  return all[adId];
}

/**
 * Resets every decision to pending (used by the "reset" action). Written as
 * new, stamped decisions rather than a delete, so the reset also wins on the
 * server. Returns the resulting map.
 */
export function clearDecisions() {
  const all = readAll();
  const updatedAt = new Date().toISOString();
  for (const adId of Object.keys(all)) {
    all[adId] = { ...EMPTY_DECISION, updatedAt };
    dirty.add(adId);
  }
  writeAll(all);
  flush();
  return all;
}

/* ── Sync with PocketBase ── */

const dirty = new Set(); // adIds changed locally and not yet confirmed by the server
let adMeta = {}; // adId -> ad, for the readable columns in the database
let pushTimer;
let syncStatus = ENDPOINT ? 'saved' : 'local'; // local | saving | saved | offline
const listeners = new Set();

function setSyncStatus(next) {
  syncStatus = next;
  listeners.forEach((listener) => listener(next));
}

/** Subscribes to sync status changes; returns an unsubscribe function. */
export function onSyncStatus(listener) {
  listeners.add(listener);
  listener(syncStatus);
  return () => listeners.delete(listener);
}

function schedulePush(adId) {
  dirty.add(adId);
  if (!ENDPOINT) return;
  setSyncStatus('saving');
  clearTimeout(pushTimer);
  pushTimer = setTimeout(flush, PUSH_DELAY_MS);
}

// PocketBase record ids are 15 characters of a-z0-9. Deriving the id from the
// ad id makes a save a plain "update, or create when it is not there yet".
function recordId(adId) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (const char of adId) {
    h1 = Math.imul(h1 ^ char.charCodeAt(0), 2654435761);
    h2 = Math.imul(h2 ^ char.charCodeAt(0), 1597334677);
  }
  const part = (n) => (n >>> 0).toString(36).padStart(7, '0');
  return `r${part(h1)}${part(h2)}`;
}

async function save(adId, decision) {
  const record = {
    klant: client.slug,
    item_id: adId,
    soort: adMeta[adId]?.format || '',
    naam: adMeta[adId]?.name || '',
    status: decision.status,
    opmerking: decision.comment,
    bijgewerkt: decision.updatedAt,
  };
  const options = (method, body) => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  });
  let res = await fetch(`${ENDPOINT}/${recordId(adId)}`, options('PATCH', record));
  if (res.status === 404) res = await fetch(ENDPOINT, options('POST', { id: recordId(adId), ...record }));
  if (!res.ok) throw new Error(`save failed (${res.status})`);
}

/** Pushes all unconfirmed decisions. Failures stay queued for the next attempt. */
async function flush() {
  clearTimeout(pushTimer);
  if (!ENDPOINT || dirty.size === 0) return;

  const all = readAll();
  const sending = [...dirty].filter((id) => all[id]).map((id) => ({ id, decision: all[id] }));

  setSyncStatus('saving');
  try {
    await Promise.all(sending.map(({ id, decision }) => save(id, decision)));
    // Only confirm what was sent unchanged; edits made meanwhile stay queued.
    const now = readAll();
    for (const { id, decision } of sending) {
      if (now[id]?.updatedAt === decision.updatedAt) dirty.delete(id);
    }
    if (dirty.size === 0) setSyncStatus('saved');
    else pushTimer = setTimeout(flush, PUSH_DELAY_MS);
  } catch {
    setSyncStatus('offline');
  }
}

/**
 * Merges local and server decisions (newest wins per ad), pushes whatever the
 * server is missing, and returns the merged map. Local decisions for ads that
 * are no longer in the manifest are left alone and not uploaded.
 */
export async function syncWithRemote(ads) {
  adMeta = Object.fromEntries(ads.map((ad) => [ad.id, ad]));
  if (!ENDPOINT) return readAll();

  const remote = {};
  try {
    const filter = encodeURIComponent(`klant="${client.slug}"`);
    const res = await fetch(`${ENDPOINT}?perPage=500&skipTotal=1&filter=${filter}`);
    if (!res.ok) throw new Error(`load failed (${res.status})`);
    for (const record of (await res.json()).items) {
      remote[record.item_id] = {
        status: record.status,
        comment: record.opmerking,
        updatedAt: record.bijgewerkt,
      };
    }
  } catch {
    setSyncStatus('offline');
    return readAll();
  }

  // Read local only now, so edits made while the request was in flight are kept.
  const merged = readAll();
  for (const adId of Object.keys(adMeta)) {
    const local = merged[adId];
    const theirs = remote[adId];
    if (local && (!theirs || (local.updatedAt || '') > (theirs.updatedAt || ''))) {
      dirty.add(adId);
    } else if (theirs) {
      merged[adId] = theirs;
    }
  }
  writeAll(merged);
  await flush();
  return merged;
}

// Last chance to send a comment that is still inside the debounce window.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('online', flush);
}
