import { API_BASE_URL, joinUrl } from './config';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './authStorage';

export class ApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function extractErrorMessage(body, fallback) {
  if (typeof body === 'string' && body.trim()) return body;
  if (!body || typeof body !== 'object') return fallback;

  if (typeof body.detail === 'string' && body.detail.trim()) return body.detail;
  if (typeof body.message === 'string' && body.message.trim()) return body.message;

  // Django REST Framework often returns field error maps: { field: ["msg"] }
  for (const [key, value] of Object.entries(body)) {
    if (!value) continue;
    if (Array.isArray(value) && value.length > 0) {
      const first = value.find((v) => typeof v === 'string' && v.trim()) || value[0];
      if (typeof first === 'string' && first.trim()) return first;
      return `${key}: ${String(first)}`;
    }
    if (typeof value === 'string' && value.trim()) return value;
  }

  return fallback;
}

function toQuery(params) {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

let refreshInFlight = null;

async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;

  const refresh = getRefreshToken();
  if (!refresh) return null;

  refreshInFlight = (async () => {
    const url = joinUrl(API_BASE_URL, 'api/v1/auth/token/refresh/');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });

    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text || null;
    }

    if (!res.ok) {
      clearTokens();
      return null;
    }

    const access = json?.access;
    if (access) {
      setTokens({ access, refresh });
      return access;
    }

    return null;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export async function apiFetchJson(path, { method = 'GET', body, headers, auth = true, _retry = false } = {}) {
  const isAbsolute = /^https?:\/\//i.test(String(path || ''));
  const url = isAbsolute ? String(path) : joinUrl(API_BASE_URL, path);
  const h = new Headers(headers || {});

  if (auth) {
    const token = getAccessToken();
    if (token) h.set('Authorization', `Bearer ${token}`);
  }

  let payload;
  if (body !== undefined) {
    if (body instanceof FormData) {
      payload = body;
    } else {
      h.set('Content-Type', 'application/json');
      payload = JSON.stringify(body);
    }
  }

  let res;
  try {
    res = await fetch(url, { method, headers: h, body: payload });
  } catch (e) {
    throw new ApiError('Network error', { status: 0, body: e ? String(e) : null });
  }

  // If access token expired/invalid, try refresh once, then retry original request.
  if (auth && res.status === 401 && !_retry) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      return apiFetchJson(path, { method, body, headers, auth, _retry: true });
    }
  }

  // Some endpoints can legitimately return 204 No Content.
  if (res.status === 204) return null;

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text || null;
  }

  if (!res.ok) {
    const fallback = `Request failed (${res.status})`;
    const message = extractErrorMessage(json, fallback);
    throw new ApiError(String(message), { status: res.status, body: json });
  }

  return json;
}

async function apiFetchAllPages(path, { auth = false, maxPages = 50 } = {}) {
  let next = path;
  const out = [];
  let pages = 0;

  while (next && pages < maxPages) {
    const data = await apiFetchJson(next, { auth });

    // Unpaginated endpoint (array)
    if (Array.isArray(data)) return data;

    // Paginated endpoint (DRF PageNumberPagination)
    if (data && typeof data === 'object' && Array.isArray(data.results)) {
      out.push(...data.results);
      next = data.next;
      pages += 1;
      if (!next) break;
      continue;
    }

    // Fallback: unexpected shape
    return out;
  }

  return out;
}

export const api = {
  health: () => apiFetchJson('api/v1/health/', { auth: false }),
  me: () => apiFetchJson('api/v1/me/'),
  register: (data) => apiFetchJson('api/v1/auth/register/', { method: 'POST', body: data, auth: false }),
  token: (data) => apiFetchJson('api/v1/auth/token/', { method: 'POST', body: data, auth: false }),

  categories: () => apiFetchJson('api/v1/categories/', { auth: false }),
  categoriesAll: () => apiFetchAllPages('api/v1/categories/?page_size=500', { auth: false }),
  categoryAttributes: (categoryId) => apiFetchJson(`api/v1/categories/${categoryId}/attributes/`, { auth: false }),
  governorates: () => apiFetchJson('api/v1/governorates/', { auth: false }),
  cities: ({ governorate } = {}) => apiFetchJson(`api/v1/cities/${toQuery({ governorate })}`, { auth: false }),
  neighborhoods: ({ city } = {}) => apiFetchJson(`api/v1/neighborhoods/${toQuery({ city })}`, { auth: false }),

  listings: (params = {}, { auth = false } = {}) => apiFetchJson(`api/v1/listings/${toQuery(params)}`, { auth }),
  listing: (id, { auth = false } = {}) => apiFetchJson(`api/v1/listings/${id}/`, { auth }),
  createListing: (data) => apiFetchJson('api/v1/listings/', { method: 'POST', body: data }),
  updateListing: (id, data) => apiFetchJson(`api/v1/listings/${id}/`, { method: 'PATCH', body: data }),
  bulkUpdateListings: ({ ids, data }) => apiFetchJson('api/v1/listings/bulk_update/', { method: 'POST', body: { ids, data } }),
  listingQuestions: (listingId, { auth = false } = {}) => apiFetchJson(`api/v1/listings/${listingId}/questions/`, { auth }),
  askListingQuestion: (listingId, { question }) =>
    apiFetchJson(`api/v1/listings/${listingId}/questions/`, { method: 'POST', body: { question } }),
  answerQuestion: (questionId, { answer }) =>
    apiFetchJson(`api/v1/questions/${questionId}/answer/`, { method: 'POST', body: { answer } }),
  uploadListingImage: (id, { file, alt_text = '', sort_order = 0 } = {}) => {
    const fd = new FormData();
    fd.set('image', file);
    if (alt_text) fd.set('alt_text', alt_text);
    fd.set('sort_order', String(sort_order));
    return apiFetchJson(`api/v1/listings/${id}/images/`, { method: 'POST', body: fd });
  },
  deleteListingImage: (listingId, imageId) =>
    apiFetchJson(`api/v1/listings/${listingId}/images/${imageId}/`, { method: 'DELETE' }),
  reorderListingImages: (id, order) => apiFetchJson(`api/v1/listings/${id}/images/reorder/`, { method: 'POST', body: { order } }),
  myListings: (params = {}) => apiFetchJson(`api/v1/listings/mine/${toQuery(params)}`),
  moderateListing: (id, moderation_status) =>
    apiFetchJson(`api/v1/listings/${id}/moderate/`, { method: 'POST', body: { moderation_status } }),

  // Profile endpoints
  userProfile: (userId) => apiFetchJson(`api/v1/users/${userId}/profile/`),
  meProfile: () => apiFetchJson('api/v1/me/profile/'),
  updateMeProfile: (data) => apiFetchJson('api/v1/me/profile/', { method: 'PATCH', body: data }),
  uploadAvatar: (file) => {
    const fd = new FormData();
    fd.set('avatar', file);
    return apiFetchJson('api/v1/me/profile/avatar/', { method: 'POST', body: fd });
  },
  uploadCover: (file) => {
    const fd = new FormData();
    fd.set('cover', file);
    return apiFetchJson('api/v1/me/profile/cover/', { method: 'POST', body: fd });
  },

  threads: () => apiFetchJson('api/v1/threads/'),
  thread: (id) => apiFetchJson(`api/v1/threads/${id}/`),
  createThread: (listing_id) => apiFetchJson('api/v1/threads/', { method: 'POST', body: { listing_id } }),
  threadMessages: (id) => apiFetchJson(`api/v1/threads/${id}/messages/`),
  sendThreadMessage: (id, body) => apiFetchJson(`api/v1/threads/${id}/messages/`, { method: 'POST', body: { body } }),

  reports: (params = {}) => apiFetchJson(`api/v1/reports/${toQuery(params)}`),
  createReport: (data) => apiFetchJson('api/v1/reports/', { method: 'POST', body: data }),
  updateReportStatus: (id, status) => apiFetchJson(`api/v1/reports/${id}/`, { method: 'PATCH', body: { status } }),
};
