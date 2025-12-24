const KEY = 'beebol.recentlyViewed.v1';
const MAX = 6;

function safeParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getRecentlyViewed() {
  try {
    const parsed = safeParse(localStorage.getItem(KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushRecentlyViewed(item) {
  if (!item || !item.id) return;
  const id = Number(item.id);
  if (!Number.isFinite(id)) return;

  const current = getRecentlyViewed();
  const next = [
    {
      id,
      title: item.title || '',
      price: item.price ?? null,
      currency: item.currency || '',
      thumbnail: item.thumbnail || '',
    },
    ...current.filter((x) => Number(x?.id) !== id),
  ].slice(0, MAX);

  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }

  try {
    window.dispatchEvent(new Event('beebol:recentlyViewed'));
  } catch {
    // ignore
  }
}

export function onRecentlyViewedChange(handler) {
  const fn = () => handler?.();
  window.addEventListener('storage', fn);
  window.addEventListener('beebol:recentlyViewed', fn);
  return () => {
    window.removeEventListener('storage', fn);
    window.removeEventListener('beebol:recentlyViewed', fn);
  };
}
