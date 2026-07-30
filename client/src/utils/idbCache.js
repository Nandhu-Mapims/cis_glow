// Generic stale-while-revalidate cache for GET-style API responses, backed by either
// sessionStorage or IndexedDB depending on how "volatile" the data is expected to be:
//   - SESSION: today's / still-changing data. Cleared automatically when the tab closes.
//   - IDB: data tied to a past date. Persists across tabs/sessions until the user clears
//     site data, since legacy records for a closed day are not expected to change.
// Bump DB_VERSION when the IndexedDB store shape itself needs to change.
const DB_NAME = 'cis_cache';
const DB_VERSION = 1;
const STORE = 'responses';
const SESSION_PREFIX = 'cis_cache:';

export const STORAGE = { SESSION: 'session', IDB: 'idb' };

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbGet(key) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(entry) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // quota / private-mode failures are non-fatal, just skip caching
  }
}

async function idbDeleteKey(key) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

async function idbDeletePrefix(prefix) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        if (String(cursor.key).startsWith(prefix)) cursor.delete();
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

function sessionGet(key) {
  try {
    const raw = sessionStorage.getItem(SESSION_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function sessionSet(entry) {
  try {
    sessionStorage.setItem(SESSION_PREFIX + entry.key, JSON.stringify(entry));
  } catch {
    // quota errors are non-fatal, just skip caching
  }
}

function sessionDeleteKey(key) {
  try {
    sessionStorage.removeItem(SESSION_PREFIX + key);
  } catch {
    // ignore
  }
}

function sessionDeletePrefix(prefix) {
  try {
    const toRemove = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(SESSION_PREFIX + prefix)) toRemove.push(k);
    }
    toRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}

function backend(storage) {
  return storage === STORAGE.SESSION
    ? { get: async (k) => sessionGet(k), set: async (e) => sessionSet(e), deleteKey: async (k) => sessionDeleteKey(k), deletePrefix: async (p) => sessionDeletePrefix(p) }
    : { get: idbGet, set: idbSet, deleteKey: idbDeleteKey, deletePrefix: idbDeletePrefix };
}

// FNV-1a over the JSON body — cheap way to detect "did the response actually change".
function hash(value) {
  const str = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Stale-while-revalidate GET, backed by sessionStorage or IndexedDB (see `storage`).
 * - If a cached row exists, `onCache(data)` fires immediately (even if stale) so the UI
 *   can paint without waiting on the network.
 * - A network fetch always runs unless the cached row is still within `ttlMs`.
 * - `onFresh(data)` only fires when the fetched response's hash differs from what was
 *   cached, so unchanged data doesn't force a re-render.
 * - Resolves with the freshest known data (cached if unchanged/still-fresh, else fetched).
 */
export async function cachedGet(key, fetcher, { onCache, onFresh, ttlMs = 5 * 60_000, storage = STORAGE.IDB } = {}) {
  const store = backend(storage);
  const cached = await store.get(key);
  if (cached) onCache?.(cached.data);

  const isFresh = Boolean(cached) && Date.now() - cached.at < ttlMs;
  if (isFresh) return cached.data;

  try {
    const data = await fetcher();
    const sig = hash(data);
    if (!cached || cached.sig !== sig) {
      onFresh?.(data);
    }
    await store.set({ key, data, sig, at: Date.now() });
    return data;
  } catch (err) {
    if (cached) return cached.data;
    throw err;
  }
}

// Is `value` today's local date? Accepts 'YYYY-MM-DD', 'DD-MM-YYYY', or any Date-parseable
// string. Zero/invalid dates (legacy '0000-00-00') resolve to false — treated as volatile.
function isToday(value) {
  if (!value) return false;
  const raw = String(value).trim();
  let d;
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);
  if (dmy) {
    d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  } else {
    d = new Date(raw);
  }
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

/**
 * Picks sessionStorage for today's date (still changing) and IndexedDB for anything
 * else — a past date, or no date at all is treated as "not known to be today" and
 * still routed to session storage so we don't over-cache ambiguous data as permanent.
 */
export function pickStorageForDate(date) {
  return isToday(date) ? STORAGE.SESSION : STORAGE.IDB;
}

/**
 * cachedGet, but picks the backend from a reference date:
 *   - today            -> sessionStorage, short TTL (data may still change this session)
 *   - any other date    -> IndexedDB, long TTL (legacy/closed-day data won't change)
 * Pass `ttlMs` to override either default.
 */
export async function cachedByDate(key, date, fetcher, { onCache, onFresh, ttlMs } = {}) {
  const storage = isToday(date) ? STORAGE.SESSION : STORAGE.IDB;
  const defaultTtl = storage === STORAGE.SESSION ? 20_000 : 12 * 60 * 60_000;
  return cachedGet(key, fetcher, { onCache, onFresh, storage, ttlMs: ttlMs ?? defaultTtl });
}

// Synchronous read for a sessionStorage-backed key only — used for instant first-render
// paint (today's data) before any effect has had a chance to run. IndexedDB has no
// synchronous read, so there is no equivalent for past-dated / IDB-backed entries.
export function peekSessionCache(key) {
  return sessionGet(key)?.data ?? null;
}

export async function invalidateCache(key, storage = STORAGE.IDB) {
  await backend(storage).deleteKey(key);
}

export async function invalidateCachePrefix(prefix, storage = STORAGE.IDB) {
  await backend(storage).deletePrefix(prefix);
}
