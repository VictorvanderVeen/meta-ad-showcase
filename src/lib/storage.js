/**
 * Decision storage abstraction.
 *
 * The whole app talks to this module — never to localStorage directly. That
 * keeps the swap to a shared backend (e.g. Supabase) a single-file change:
 * reimplement these four functions against the network and the UI is untouched.
 *
 * A decision is: { status: 'pending' | 'approved' | 'rejected', comment: string, updatedAt?: string }
 */

const KEY = 'mas-decisions-v1';

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
  return all[adId];
}

/** Wipes every decision (used by the "reset" action). */
export function clearDecisions() {
  localStorage.removeItem(KEY);
}
