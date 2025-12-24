export const API_BASE_URL = process.env.API_BASE_URL || '';

export function joinUrl(base, path) {
  const trimmedBase = String(base || '').replace(/\/+$/, '');
  const trimmedPath = String(path || '').replace(/^\/+/, '');
  if (!trimmedBase) return `/${trimmedPath}`;
  return `${trimmedBase}/${trimmedPath}`;
}
