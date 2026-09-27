import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cart recovery.
 *
 * The server derives the cart from the session, and the backend scopes it to the
 * session id. Logging out destroys that session, so the next login lands on a
 * brand new (empty) server cart even though the user only stepped away for a
 * moment.
 *
 * To keep that from looking like data loss we snapshot the cart per customer at
 * logout and, if the server comes back empty for that same customer, re-push the
 * snapshot so the server rebuilds it. Everything here is keyed by customer, so a
 * snapshot can only ever be restored to the account it was taken from.
 */

const SNAPSHOT_PREFIX = '@ecommerce_cart_snapshot_';

// A snapshot older than this is stale data rather than a recent abandoned cart,
// so it is ignored instead of resurrecting items the user may have moved on from.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function snapshotKeyFor(userKey) {
  return SNAPSHOT_PREFIX + encodeURIComponent(String(userKey || '').trim().toLowerCase());
}

/**
 * Reduce cart lines to the minimum needed to rebuild them, merging any duplicate
 * item_code + uom pairs. Merging matters because the backend may append a line
 * per add rather than merging, so a duplicated snapshot would create duplicated
 * server lines.
 */
export function normaliseLines(items) {
  if (!Array.isArray(items)) return [];

  const merged = new Map();
  items.forEach((line) => {
    if (!line || !line.item_code) return;
    const qty = parseFloat(line.qty);
    if (!Number.isFinite(qty) || qty <= 0) return;
    const uom = line.uom || null;
    const key = `${line.item_code}::${uom || ''}`;
    const existing = merged.get(key);
    if (existing) {
      existing.qty += qty;
    } else {
      merged.set(key, { item_code: line.item_code, qty, uom });
    }
  });

  return Array.from(merged.values());
}

export async function saveCartSnapshot(userKey, items) {
  if (!userKey) return false;

  const lines = normaliseLines(items);
  if (!lines.length) {
    // Nothing worth keeping — make sure a previous snapshot cannot linger and
    // later "restore" a cart the user had already emptied.
    await clearCartSnapshot(userKey);
    return false;
  }

  try {
    await AsyncStorage.setItem(
      snapshotKeyFor(userKey),
      JSON.stringify({ savedAt: Date.now(), lines })
    );
    return true;
  } catch (err) {
    console.warn('cartRecovery: could not save snapshot:', err.message);
    return false;
  }
}

export async function readCartSnapshot(userKey, { maxAgeMs = MAX_AGE_MS, now = Date.now() } = {}) {
  if (!userKey) return null;

  let raw;
  try {
    raw = await AsyncStorage.getItem(snapshotKeyFor(userKey));
  } catch (err) {
    return null;
  }
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return null;
  }
  if (!parsed || typeof parsed.savedAt !== 'number') return null;
  if (now - parsed.savedAt > maxAgeMs) return null;

  const lines = normaliseLines(parsed.lines);
  if (!lines.length) return null;

  return { savedAt: parsed.savedAt, lines };
}

export async function clearCartSnapshot(userKey) {
  if (!userKey) return;
  try {
    await AsyncStorage.removeItem(snapshotKeyFor(userKey));
  } catch (err) {
    // Nothing useful to do; the snapshot is best-effort.
  }
}

export default {
  snapshotKeyFor,
  normaliseLines,
  saveCartSnapshot,
  readCartSnapshot,
  clearCartSnapshot,
  MAX_AGE_MS,
};
