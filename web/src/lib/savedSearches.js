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
  return parsed.filter((x) => x && typeof x === 'object' && typeof x.id === 'string');
}

export function addSavedSearch({ name, queryString }) {
  const safeName = String(name || '').trim() || 'Saved search';
  const qs = String(queryString || '').replace(/^\?/, '');
  const next = [{ id: randomId(), name: safeName, queryString: qs, createdAt: nowIso() }, ...listSavedSearches()];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, 50)));
  return next[0];
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
