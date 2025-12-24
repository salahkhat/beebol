const STORAGE_KEY = 'beebol.savedSearches.v1';

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

function randomId() {
  // Not crypto-strong; sufficient for local-only IDs.
  return `ss_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function listSavedSearches() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? safeParse(raw) : null;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((x) => x && typeof x === 'object' && typeof x.id === 'string')
    .map((x) => ({
      id: String(x.id),
      name: String(x.name || '').trim() || 'Saved search',
      queryString: String(x.queryString || '').replace(/^\?/, ''),
      createdAt: String(x.createdAt || ''),
      notifyEnabled: !!x.notifyEnabled,
      lastCheckedAt: String(x.lastCheckedAt || ''),
      lastCount: typeof x.lastCount === 'number' ? x.lastCount : x.lastCount == null ? null : Number(x.lastCount),
      lastDelta: typeof x.lastDelta === 'number' ? x.lastDelta : x.lastDelta == null ? null : Number(x.lastDelta),
    }));
}

export function addSavedSearch({ name, queryString }) {
  const safeName = String(name || '').trim() || 'Saved search';
  const qs = String(queryString || '').replace(/^\?/, '');
  const next = [
    {
      id: randomId(),
      name: safeName,
      queryString: qs,
      createdAt: nowIso(),
      notifyEnabled: false,
      lastCheckedAt: '',
      lastCount: null,
      lastDelta: null,
    },
    ...listSavedSearches(),
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, 50)));
  return next[0];
}

export function updateSavedSearch(id, patch = {}) {
  const items = listSavedSearches();
  const idx = items.findIndex((s) => s.id === id);
  if (idx === -1) return items;
  const prev = items[idx];
  const nextItem = { ...prev, ...patch };
  const next = [...items.slice(0, idx), nextItem, ...items.slice(idx + 1)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, 50)));
  return next;
}

export function toggleSavedSearchNotify(id, enabled) {
  return updateSavedSearch(id, { notifyEnabled: !!enabled });
}

export function markSavedSearchChecked(id, count, prevCount) {
  const n = Number(count);
  const prev = prevCount == null ? null : Number(prevCount);
  const delta = Number.isFinite(prev) && Number.isFinite(n) ? Math.max(0, n - prev) : null;
  return updateSavedSearch(id, {
    lastCheckedAt: nowIso(),
    lastCount: Number.isFinite(n) ? n : null,
    lastDelta: delta,
  });
}

export function savedSearchParams(queryString) {
  const qs = String(queryString || '').replace(/^\?/, '');
  const sp = new URLSearchParams(qs);
  const params = {};
  for (const [k, v] of sp.entries()) {
    if (!v) continue;
    if (k === 'page') continue;
    params[k] = v;
  }
  return params;
}

export function removeSavedSearch(id) {
  const next = listSavedSearches().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function describeListingSearch({ search, category, governorate, city, neighborhood, ordering } = {}) {
  const parts = [];
  if (search) parts.push(`search: ${search}`);
  if (category) parts.push(`category: ${category}`);
  if (governorate) parts.push(`gov: ${governorate}`);
  if (city) parts.push(`city: ${city}`);
  if (neighborhood) parts.push(`neighborhood: ${neighborhood}`);
  if (ordering) parts.push(`order: ${ordering}`);
  return parts.length ? parts.join(' · ') : 'Listings';
}
