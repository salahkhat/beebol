import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'beebol.appearance';

const ThemeModeCtx = createContext(null);

function readInitial() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch {
    // ignore
  }

  try {
    const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
    return prefersDark ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function ThemeModeProvider({ children }) {
  const [appearance, setAppearance] = useState(readInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, appearance);
    } catch {
      // ignore
    }
  }, [appearance]);

  const toggle = useCallback(() => {
    setAppearance((a) => (a === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(() => ({ appearance, setAppearance, toggle }), [appearance, toggle]);

  return <ThemeModeCtx.Provider value={value}>{children}</ThemeModeCtx.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeCtx);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
}
