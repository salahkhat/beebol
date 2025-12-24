const KEY = 'beebol.favorites.v1';

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

export function getFavorites() {
  return readSet();
}

export function isFavorite(listingId) {
  const id = Number(listingId);
  if (!Number.isFinite(id)) return false;
  return readSet().has(id);
}

export function toggleFavorite(listingId) {
  const id = Number(listingId);
  if (!Number.isFinite(id)) return;
  const set = readSet();
  if (set.has(id)) set.delete(id);
  else set.add(id);
  writeSet(set);
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
