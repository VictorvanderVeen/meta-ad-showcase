/**
 * Decision storage abstraction.
 *
 * The whole app talks to this module — never to localStorage or the network
 * directly. Storage is local-first: every change lands in localStorage at once
 * and is then pushed to a Google Sheet (Apps Script web app, see apps-script/).
 * On load both sides are merged per ad, newest updatedAt wins.
 *
 * A decision is: { status: 'pending' | 'approved' | 'rejected', comment: string, updatedAt?: string }
 */

const KEY = 'mas-decisions-v1';

// Apps Script web app URL (…/exec). Empty = local-only, nothing leaves the browser.
const ENDPOINT = import.meta.env.VITE_SHEET_ENDPOINT || '';

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
 * new, stamped decisions rather than a delete, so the reset also wins in the
 * sheet. Returns the resulting map.
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

/* ── Sync with the sheet ── */

const dirty = new Set(); // adIds changed locally and not yet confirmed by the sheet
let adMeta = {}; // adId -> ad, for the readable columns in the sheet
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

/** Pushes all unconfirmed decisions. Failures stay queued for the next attempt. */
async function flush() {
  clearTimeout(pushTimer);
  if (!ENDPOINT || dirty.size === 0) return;

  const ids = [...dirty];
  const all = readAll();
  const decisions = ids
    .filter((id) => all[id])
    .map((id) => ({ id, name: adMeta[id]?.name, brand: adMeta[id]?.brand, ...all[id] }));

  setSyncStatus('saving');
  try {
    // text/plain keeps this a "simple" request: Apps Script can't answer a CORS preflight.
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ decisions }),
      keepalive: true,
    });
    const body = await res.json();
    if (!body.ok) throw new Error(body.error || 'push rejected');
    // Only confirm what was sent unchanged; edits made meanwhile stay queued.
    const now = readAll();
    for (const sent of decisions) {
      if (now[sent.id]?.updatedAt === sent.updatedAt) dirty.delete(sent.id);
    }
    if (dirty.size === 0) setSyncStatus('saved');
    else pushTimer = setTimeout(flush, PUSH_DELAY_MS);
  } catch {
    setSyncStatus('offline');
  }
}

/**
 * Merges local and sheet decisions (newest wins per ad), pushes whatever the
 * sheet is missing, and returns the merged map. Local decisions for ads that
 * are no longer in the manifest are left alone and not uploaded.
 */
export async function syncWithRemote(ads) {
  adMeta = Object.fromEntries(ads.map((ad) => [ad.id, ad]));
  if (!ENDPOINT) return readAll();

  let remote;
  try {
    const res = await fetch(ENDPOINT);
    remote = (await res.json()).decisions || {};
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
