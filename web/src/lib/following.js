const STORAGE_KEY = 'beebol.following.v1';

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

function normalizeSeller(x) {
  if (!x || typeof x !== 'object') return null;
  const id = Number(x.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    id,
    username: String(x.username || '').trim(),
    createdAt: String(x.createdAt || ''),
  };
}

export function listFollowing() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? safeParse(raw) : null;
  if (!Array.isArray(parsed)) return [];
  return parsed.map(normalizeSeller).filter(Boolean);
}

export function isFollowingSeller(id) {
  const n = Number(id);
  return listFollowing().some((x) => x.id === n);
}

export function followSeller({ id, username } = {}) {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return listFollowing();
  const items = listFollowing().filter((x) => x.id !== n);
  const next = [{ id: n, username: String(username || '').trim(), createdAt: nowIso() }, ...items].slice(0, 200);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function unfollowSeller(id) {
  const n = Number(id);
  const next = listFollowing().filter((x) => x.id !== n);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
