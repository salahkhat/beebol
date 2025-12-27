function translateOrFallback(t, key, fallback) {
  if (typeof t !== 'function') return fallback;
  const translated = t(key);
  if (!translated || translated === key) return fallback;
  return translated;
}

function safeKeyPart(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    // preserve semantic differences like A vs A+ vs A++
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function humanizeEnumValue(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  // Keep common technical tokens readable (e.g. 3g, 802.11ax)
  if (/^[0-9]+g$/i.test(s)) return s.toUpperCase();
  if (/^802\./.test(s)) return s;

  return s
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function getAttributeChoiceLabel(attrDef, value, t) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const attrKey = safeKeyPart(attrDef?.key);
  const valueKey = safeKeyPart(raw);

  // 1) Most specific: per-attribute choice translation
  if (attrKey && valueKey) {
    const k = `attr_choice_${attrKey}_${valueKey}`;
    const fallback = humanizeEnumValue(raw);
    const res = translateOrFallback(t, k, null);
    if (res) return res;
    // if missing, fall through
    if (fallback) {
      // 2) Generic choice translation
      const g = `attr_choice_${valueKey}`;
      const gen = translateOrFallback(t, g, null);
      if (gen) return gen;
      return fallback;
    }
  }

  return humanizeEnumValue(raw) || raw;
}

export function formatAttributeValue(attrDef, rawValue, t) {
  if (rawValue == null) return '';

  const type = String(attrDef?.type || '').toLowerCase();

  if (type === 'bool') {
    const v = rawValue;
    const truthy = v === true || String(v).toLowerCase() === 'true' || String(v) === '1';
    const falsy = v === false || String(v).toLowerCase() === 'false' || String(v) === '0';
    if (!truthy && !falsy) return '';
    return truthy ? translateOrFallback(t, 'yes', 'Yes') : translateOrFallback(t, 'no', 'No');
  }

  if (type === 'enum') {
    return getAttributeChoiceLabel(attrDef, rawValue, t);
  }

  return String(rawValue);
}
