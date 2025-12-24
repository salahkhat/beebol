const STORAGE_KEY = 'beebol.watchlist.v1';

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

export function isWatched(id) {
  const n = Number(id);
  return listWatchlist().some((x) => x.id === n);
}

export function addWatch(id, snapshot = {}) {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return listWatchlist();

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
  return next;
}

export function removeWatch(id) {
  const n = Number(id);
  const next = listWatchlist().filter((x) => x.id !== n);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
  return next;
}

export function updateWatchSnapshotFromListing(listing) {
  const id = listing?.id;
  if (!id) return listWatchlist();
  return updateWatch(id, {
    lastPrice: listing.price == null ? null : Number(listing.price),
    lastCurrency: listing.currency == null ? null : String(listing.currency),
    lastSeenAt: nowIso(),
  });
}
