import { useEffect, useMemo, useState } from 'react';
import { api } from './api';

export function useListingFilters({ sp, setSp, locale } = {}) {
  const params = useMemo(() => {
    const get = (k) => {
      const v = sp?.get?.(k);
      return v == null ? '' : String(v);
    };

    return {
      search: get('search'),
      category: get('category'),
      governorate: get('governorate'),
      city: get('city'),
      neighborhood: get('neighborhood'),
      price_min: get('price_min'),
      price_max: get('price_max'),
      ordering: get('ordering'),
      page: get('page') || '1',
    };
  }, [sp]);

  const hasAttrFilters = useMemo(() => {
    if (!sp) return false;
    for (const k of sp.keys()) {
      if (String(k).startsWith('attr_')) return true;
    }
    return false;
  }, [sp]);

  const [cats, setCats] = useState([]);
  const [govs, setGovs] = useState([]);
  const [cities, setCities] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [attrDefs, setAttrDefs] = useState([]);

  const uniqueAttrDefs = useMemo(() => {
    if (!Array.isArray(attrDefs) || attrDefs.length === 0) return [];
    const out = [];
    const seen = new Set();
    for (let i = attrDefs.length - 1; i >= 0; i -= 1) {
      const d = attrDefs[i];
      const key = String(d?.key || '');
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(d);
    }
    return out.reverse();
  }, [attrDefs]);

  const [searchDraft, setSearchDraft] = useState(params.search);

  useEffect(() => {
    setSearchDraft(params.search);
  }, [params.search]);

  useEffect(() => {
    if (!sp || !setSp) return;
    if (searchDraft === params.search) return;
    const handle = setTimeout(() => {
      if (searchDraft === params.search) return;
      const next = new URLSearchParams(sp);
      if (!searchDraft) next.delete('search');
      else next.set('search', searchDraft);
      next.set('page', '1');
      setSp(next);
    }, 1000);
    return () => clearTimeout(handle);
  }, [searchDraft, params.search, sp, setSp]);

  useEffect(() => {
    let cancelled = false;
    async function loadLookups() {
      const [c, g] = await Promise.all([api.categoriesAll(), api.governorates()]);
      if (cancelled) return;
      setCats(Array.isArray(c) ? c : []);
      setGovs(g.results || []);
    }
    loadLookups().catch(() => {
      // ignore
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCities() {
      if (!params.governorate) {
        setCities([]);
        return;
      }
      const c = await api.cities({ governorate: params.governorate });
      if (cancelled) return;
      setCities(c.results || []);
    }
    loadCities().catch(() => setCities([]));
    return () => {
      cancelled = true;
    };
  }, [params.governorate]);

  useEffect(() => {
    let cancelled = false;
    async function loadNeighborhoods() {
      if (!params.city) {
        setNeighborhoods([]);
        return;
      }
      const n = await api.neighborhoods({ city: params.city });
      if (cancelled) return;
      setNeighborhoods(n.results || []);
    }
    loadNeighborhoods().catch(() => setNeighborhoods([]));
    return () => {
      cancelled = true;
    };
  }, [params.city]);

  useEffect(() => {
    let cancelled = false;
    async function loadAttrDefs() {
      if (!params.category) {
        setAttrDefs([]);
        return;
      }
      const defs = await api.categoryAttributes(params.category);
      if (cancelled) return;
      setAttrDefs(Array.isArray(defs) ? defs : []);
    }
    loadAttrDefs().catch(() => setAttrDefs([]));
    return () => {
      cancelled = true;
    };
  }, [params.category]);

  function setParam(key, value) {
    if (!sp || !setSp) return;
    const next = new URLSearchParams(sp);

    if (key === 'category') {
      const prev = next.get('category') || '';
      const nextVal = value ? String(value) : '';
      if (prev !== nextVal) {
        for (const k of Array.from(next.keys())) {
          if (String(k).startsWith('attr_')) next.delete(k);
        }
      }
    }

    if (!value) next.delete(key);
    else next.set(key, String(value));
    if (key !== 'page') next.set('page', '1');
    setSp(next);
  }

  function clearFilters() {
    if (!sp || !setSp) return;
    const next = new URLSearchParams(sp);
    next.delete('search');
    next.delete('category');
    next.delete('governorate');
    next.delete('city');
    next.delete('neighborhood');
    next.delete('price_min');
    next.delete('price_max');
    next.delete('ordering');

    for (const k of Array.from(next.keys())) {
      if (String(k).startsWith('attr_')) next.delete(k);
    }

    next.set('page', '1');
    setSp(next);
  }

  function attrLabel(d) {
    if (!d) return '';
    const ar = String(d.label_ar || '').trim();
    const en = String(d.label_en || '').trim();
    const key = String(d.key || '').trim();
    if (String(locale || '').startsWith('ar')) return ar || en || key;
    return en || ar || key;
  }

  return {
    params,
    hasAttrFilters,
    cats,
    govs,
    cities,
    neighborhoods,
    uniqueAttrDefs,
    searchDraft,
    setSearchDraft,
    setParam,
    clearFilters,
    attrLabel,
  };
}
