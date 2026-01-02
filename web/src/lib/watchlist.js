import { api } from './api';
import { getAccessToken } from './authStorage';

const STORAGE_KEY = 'beebol.watchlist.v1';
const MAP_KEY = 'beebol.watchlist.map.v1';

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return '';
  }
}

export function listWatchlist() {
  // Fire-and-forget server sync for authenticated users.
  void ensureLoadedFromServer();
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? safeParse(raw) : null;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((x) => x && typeof x === 'object')
    .map((x) => ({
      id: Number(x.id),
      createdAt: String(x.createdAt || ''),
      lastPrice: x.lastPrice == null ? null : Number(x.lastPrice),
      lastCurrency: x.lastCurrency == null ? null : String(x.lastCurrency),
      lastSeenAt: String(x.lastSeenAt || ''),
    }))
    .filter((x) => Number.isFinite(x.id) && x.id > 0);
}

function readMap() {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(MAP_KEY) : null;
  const parsed = raw ? safeParse(raw) : null;
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

function dispatchWatchlistEvent() {
  try {
    window.dispatchEvent(new Event('beebol:watchlist'));
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
      const res = await api.watchlist();
      const arr = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];

      const items = listWatchlist();
      const byId = new Map(items.map((x) => [x.id, x]));
      const map = readMap();

      for (const x of arr) {
        const listingId = Number(x?.listing);
        const watchId = x?.id;
        if (!Number.isFinite(listingId)) continue;

        const lastSeenAt = x?.last_seen_at ? String(x.last_seen_at) : byId.get(listingId)?.lastSeenAt || '';
        const lastPrice = x?.last_seen_price == null ? byId.get(listingId)?.lastPrice ?? null : Number(x.last_seen_price);
        const lastCurrency = x?.last_seen_currency == null ? byId.get(listingId)?.lastCurrency ?? null : String(x.last_seen_currency);

        byId.set(listingId, {
          id: listingId,
          createdAt: byId.get(listingId)?.createdAt || nowIso(),
          lastPrice: lastPrice == null ? null : Number(lastPrice),
          lastCurrency: lastCurrency == null ? null : String(lastCurrency),
          lastSeenAt,
        });

        if (typeof watchId === 'number') map[String(listingId)] = watchId;
      }

      const next = Array.from(byId.values())
        .filter((x) => Number.isFinite(x.id) && x.id > 0)
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        .slice(0, 100);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      writeMap(map);
      dispatchWatchlistEvent();
    } catch {
      // ignore
    }
  })();

  return serverLoadPromise;
}

export function isWatched(id) {
  const n = Number(id);
  void ensureLoadedFromServer();
  return listWatchlist().some((x) => x.id === n);
}

export function addWatch(id, snapshot = {}) {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return listWatchlist();

  void ensureLoadedFromServer();

  const items = listWatchlist().filter((x) => x.id !== n);
  const next = [
    {
      id: n,
      createdAt: nowIso(),
      lastPrice: snapshot.lastPrice == null ? null : Number(snapshot.lastPrice),
      lastCurrency: snapshot.lastCurrency == null ? null : String(snapshot.lastCurrency),
      lastSeenAt: nowIso(),
    },
    ...items,
  ].slice(0, 100);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  dispatchWatchlistEvent();

  if (isAuthenticated()) {
    void (async () => {
      try {
        const created = await api.addWatch(n);
        const watchId = created?.id;
        if (typeof watchId === 'number') {
          const map = readMap();
          map[String(n)] = watchId;
          writeMap(map);
        }
      } catch {
        // ignore
      }
    })();
  }
  return next;
}

export function removeWatch(id) {
  const n = Number(id);
  void ensureLoadedFromServer();
  const next = listWatchlist().filter((x) => x.id !== n);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  dispatchWatchlistEvent();

  if (isAuthenticated()) {
    void (async () => {
      try {
        const map = readMap();
        let watchId = map[String(n)];
        if (typeof watchId !== 'number') {
          await ensureLoadedFromServer();
          watchId = readMap()[String(n)];
        }
        if (typeof watchId === 'number') {
          await api.removeWatch(watchId);
          const m2 = readMap();
          delete m2[String(n)];
          writeMap(m2);
        }
      } catch {
        // ignore
      }
    })();
  }
  return next;
}

export function updateWatch(id, patch = {}) {
  const n = Number(id);
  const items = listWatchlist();
  const idx = items.findIndex((x) => x.id === n);
  if (idx === -1) return items;
  const prev = items[idx];
  const nextItem = { ...prev, ...patch };
  const next = [...items.slice(0, idx), nextItem, ...items.slice(idx + 1)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  dispatchWatchlistEvent();
  return next;
}

export function updateWatchSnapshotFromListing(listing) {
  const id = listing?.id;
  if (!id) return listWatchlist();
  const next = updateWatch(id, {
    lastPrice: listing.price == null ? null : Number(listing.price),
    lastCurrency: listing.currency == null ? null : String(listing.currency),
    lastSeenAt: nowIso(),
  });

  if (isAuthenticated()) {
    void (async () => {
      try {
        const map = readMap();
        let watchId = map[String(Number(id))];
        if (typeof watchId !== 'number') {
          await ensureLoadedFromServer();
          watchId = readMap()[String(Number(id))];
        }
        if (typeof watchId === 'number') {
          await api.markWatchSeen(watchId);
        }
      } catch {
        // ignore
      }
    })();
  }

  return next;
}

export function onWatchlistChange(handler) {
  const fn = () => handler?.();
  window.addEventListener('storage', fn);
  window.addEventListener('beebol:watchlist', fn);
  return () => {
    window.removeEventListener('storage', fn);
    window.removeEventListener('beebol:watchlist', fn);
  };
}
