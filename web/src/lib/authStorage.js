const ACCESS_KEY = 'beebol.access';
const REFRESH_KEY = 'beebol.refresh';

export function getAccessToken() {
  try {
    return localStorage.getItem(ACCESS_KEY) || '';
  } catch {
    return '';
  }
}

export function getRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_KEY) || '';
  } catch {
    return '';
  }
}

export function setTokens({ access, refresh }) {
  try {
    if (access) localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  } catch {
    // ignore
  }
}

export function clearTokens() {
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    // ignore
  }
}
