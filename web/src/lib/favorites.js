import { api } from './api';
import { getAccessToken } from './authStorage';

const KEY = 'beebol.favorites.v1';
const MAP_KEY = 'beebol.favorites.map.v1';

function safeParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readSet() {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
  const parsed = safeParse(raw);
  if (!Array.isArray(parsed)) return new Set();
  return new Set(parsed.map((x) => Number(x)).filter((n) => Number.isFinite(n)));
}

function writeSet(set) {
  try {
    localStorage.setItem(KEY, JSON.stringify(Array.from(set.values())));
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new Event('beebol:favorites'));
  } catch {
    // ignore
  }
}

function readMap() {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(MAP_KEY) : null;
  const parsed = safeParse(raw);
  if (!parsed || typeof parsed !== 'object') return {};
  return parsed;
}

function writeMap(map) {
  try {
    localStorage.setItem(MAP_KEY, JSON.stringify(map || {}));
  } catch {
    // ignore
  }
}

let serverLoadPromise = null;

function isAuthenticated() {
  return !!getAccessToken();
}

async function ensureLoadedFromServer() {
  if (!isAuthenticated()) return;
  if (serverLoadPromise) return serverLoadPromise;

  serverLoadPromise = (async () => {
    try {
      const res = await api.favorites();
      const arr = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];

      const set = readSet();
      const map = readMap();

      for (const x of arr) {
        const listingId = Number(x?.listing);
        const favId = x?.id;
        if (Number.isFinite(listingId)) set.add(listingId);
        if (Number.isFinite(listingId) && typeof favId === 'number') map[String(listingId)] = favId;
      }

      writeMap(map);
      writeSet(set);
    } catch {
      // ignore
    }
  })();

  return serverLoadPromise;
}

export function getFavorites() {
  // Fire-and-forget server sync.
  void ensureLoadedFromServer();
  return readSet();
}

export function isFavorite(listingId) {
  void ensureLoadedFromServer();
  const id = Number(listingId);
  if (!Number.isFinite(id)) return false;
  return readSet().has(id);
}

export function toggleFavorite(listingId) {
  const id = Number(listingId);
  if (!Number.isFinite(id)) return;

  void ensureLoadedFromServer();

  const set = readSet();
  const willFavorite = !set.has(id);
  if (willFavorite) set.add(id);
  else set.delete(id);
  writeSet(set);

  if (!isAuthenticated()) return;

  // Best-effort server sync.
  void (async () => {
    try {
      const map = readMap();
      if (willFavorite) {
        const created = await api.addFavorite(id);
        const favId = created?.id;
        if (typeof favId === 'number') {
          map[String(id)] = favId;
          writeMap(map);
        }
        return;
      }

      // Unfavorite
      let favId = map[String(id)];
      if (typeof favId !== 'number') {
        // Refresh mapping if missing.
        await ensureLoadedFromServer();
        const m2 = readMap();
        favId = m2[String(id)];
      }
      if (typeof favId === 'number') {
        await api.removeFavorite(favId);
        const next = readMap();
        delete next[String(id)];
        writeMap(next);
      }
    } catch {
      // ignore
    }
  })();
}

export function onFavoritesChange(handler) {
  const fn = () => handler?.();
  window.addEventListener('storage', fn);
  window.addEventListener('beebol:favorites', fn);
  return () => {
    window.removeEventListener('storage', fn);
    window.removeEventListener('beebol:favorites', fn);
  };
}
