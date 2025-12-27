import { API_BASE_URL, joinUrl } from './config';

function getBackendBaseUrl() {
  if (API_BASE_URL) return API_BASE_URL;
  if (typeof window === 'undefined') return '';
  const origin = String(window.location?.origin || '');
  if (origin.includes(':3000')) return origin.replace(':3000', ':8000');
  return '';
}

export function normalizeMediaUrl(url) {
  if (!url) return url;
  const s = String(url);

  // Keep browser-local blob/data URLs intact.
  if (s.startsWith('blob:') || s.startsWith('data:')) return s;

  const backendBase = getBackendBaseUrl();
  if (!backendBase) return s;

  const rewriteOrigins = [
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'https://127.0.0.1:3000',
  ];

  for (const origin of rewriteOrigins) {
    if (s.startsWith(origin + '/')) {
      // Preserve path/query/hash.
      return backendBase.replace(/\/+$/, '') + s.slice(origin.length);
    }
  }

  // If backend returned a relative media path, ensure it targets the backend origin.
  if (s.startsWith('/media/')) return joinUrl(backendBase, s);
  if (s.startsWith('media/')) return joinUrl(backendBase, '/' + s);

  return s;
}
