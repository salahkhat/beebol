const STORAGE_KEY = 'beebol.compareIds.v1';

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getCompareIds() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? safeParse(raw) : null;
  if (!Array.isArray(parsed)) return [];
  return parsed.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
}

export function setCompareIds(ids) {
  const next = Array.from(new Set((ids || []).map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))).slice(0, 6);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function addCompareId(id) {
  return setCompareIds([id, ...getCompareIds()]);
}

export function removeCompareId(id) {
  const n = Number(id);
  return setCompareIds(getCompareIds().filter((x) => x !== n));
}

export function parseIdsParam(value) {
  return String(value || '')
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function formatIdsParam(ids) {
  return Array.from(new Set((ids || []).map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))).join(',');
}
