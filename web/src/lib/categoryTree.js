export function buildCategoryIndex(categories) {
  const byId = new Map();
  const childrenByParent = new Map();

  for (const c of categories || []) {
    const id = String(c.id);
    byId.set(id, { ...c, id });
  }

  for (const c of byId.values()) {
    const parentId = c.parent == null ? '' : String(c.parent);
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push(c);
  }

  for (const [k, list] of childrenByParent.entries()) {
    list.sort((a, b) => String(a.slug || '').localeCompare(String(b.slug || '')));
    childrenByParent.set(k, list);
  }

  function getChildren(parentId) {
    const k = parentId == null || parentId === '' ? '' : String(parentId);
    return childrenByParent.get(k) || [];
  }

  function isLeaf(id) {
    if (!id) return false;
    return getChildren(String(id)).length === 0;
  }

  function pathToRoot(id) {
    const out = [];
    let cur = id ? String(id) : '';
    const seen = new Set();

    while (cur) {
      if (seen.has(cur)) break;
      seen.add(cur);
      const node = byId.get(cur);
      if (!node) break;
      out.push(cur);
      cur = node.parent == null ? '' : String(node.parent);
    }

    return out.reverse();
  }

  function getLabel(c, locale) {
    if (!c) return '';
    if (locale === 'ar') return c.name_ar || c.name_en || '';
    return c.name_en || c.name_ar || '';
  }

  function getPathLabel(id, locale, sep = ' › ') {
    const ids = pathToRoot(id);
    return ids
      .map((x) => getLabel(byId.get(String(x)), locale))
      .filter(Boolean)
      .join(sep);
  }

  function search(query, locale, { limit = 8, leafOnly = false, includeParents = true } = {}) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];

    const results = [];
    for (const node of byId.values()) {
      const id = String(node.id);
      const leaf = isLeaf(id);
      if (leafOnly && !leaf) continue;
      if (!includeParents && !leaf) continue;

      const label = String(getLabel(node, locale) || '');
      const labelLc = label.toLowerCase();
      const pathLabel = String(getPathLabel(id, locale) || '');
      const pathLc = pathLabel.toLowerCase();

      let score = 0;
      if (labelLc.startsWith(q)) score += 100;
      if (labelLc.includes(q)) score += 50;
      if (pathLc.includes(q)) score += 10;
      if (!score) continue;

      results.push({ id, label, pathLabel, isLeaf: leaf, score });
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.pathLabel).localeCompare(String(b.pathLabel));
    });

    return results.slice(0, Math.max(1, Number(limit) || 8));
  }

  return {
    byId,
    childrenByParent,
    getChildren,
    isLeaf,
    pathToRoot,
    getLabel,
    getPathLabel,
    search,
  };
}

export function flattenCategoriesForSelect(categories, { locale = 'ar', includeParents = true } = {}) {
  const idx = buildCategoryIndex(categories);
  const roots = idx.getChildren('');

  const out = [];

  function walk(node, depth) {
    const id = String(node.id);
    const label = idx.getLabel(node, locale) || '';
    const prefix = depth > 0 ? `${'— '.repeat(depth)}` : '';

    if (includeParents || idx.isLeaf(id)) {
      out.push({ id, label: `${prefix}${label}`, depth, isLeaf: idx.isLeaf(id) });
    }

    for (const child of idx.getChildren(id)) {
      walk(child, depth + 1);
    }
  }

  for (const r of roots) walk(r, 0);

  return out;
}
