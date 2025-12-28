import { useEffect, useMemo, useState } from 'react';
import { Box, Flex, Grid, Text } from '@radix-ui/themes';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { buildCategoryIndex } from '../lib/categoryTree';
import {
  Baby,
  Book,
  Briefcase,
  Building2,
  Car,
  Dumbbell,
  HeartPulse,
  Home,
  PawPrint,
  Shirt,
  Smartphone,
  Wrench,
} from 'lucide-react';

export function CategoryCascadeSelect({
  categories,
  value,
  onChange,
  locale = 'ar',
  t,
  required = false,
  leafOnly = false,
  deferChangeUntilLeaf = false,
  onBlur,
  controlClassName = '',
  showSearch = true,
  showBrowse = true,
  showQuickPicks = true,
}) {
  const idx = useMemo(() => buildCategoryIndex(categories || []), [categories]);

  const dbRoots = useMemo(() => idx.getChildren(''), [idx]);
  const generalRootId = useMemo(() => {
    if (dbRoots.length !== 1) return '';
    const r = dbRoots[0];
    if (String(r?.slug || '') !== 'general') return '';
    return String(r.id);
  }, [dbRoots]);

  function getVirtualRoots() {
    return generalRootId ? idx.getChildren(generalRootId) : dbRoots;
  }

  function pathToRootOmitGeneral(id) {
    const ids = idx.pathToRoot(id ? String(id) : '');
    if (generalRootId && ids.length && ids[0] === generalRootId) return ids.slice(1);
    return ids;
  }

  function getPathLabelOmitGeneral(id, sep = ' › ') {
    const ids = pathToRootOmitGeneral(id);
    return ids
      .map((x) => idx.getLabel(idx.byId.get(String(x)), locale))
      .filter(Boolean)
      .join(sep);
  }

  const initialPath = useMemo(() => pathToRootOmitGeneral(value ? String(value) : ''), [value, generalRootId, idx]);
  const [path, setPath] = useState(initialPath);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setPath(initialPath);
  }, [initialPath]);

  const levels = useMemo(() => {
    const out = [];

    const rootParentId = generalRootId ? generalRootId : '';

    // level 0: roots
    out.push({ parentId: rootParentId, options: idx.getChildren(rootParentId) });

    for (const id of path) {
      const children = idx.getChildren(id);
      if (!children.length) break;
      out.push({ parentId: id, options: children });
    }

    return out;
  }, [idx, path, generalRootId]);

  function setLevel(levelIndex, nextIdRaw) {
    const nextId = String(nextIdRaw || '');

    // level 0 corresponds to path[0]
    const nextPath = path.slice(0, levelIndex);
    if (nextId) nextPath.push(nextId);

    setPath(nextPath);

    const chosen = nextPath[nextPath.length - 1] || '';
    if (!chosen) {
      onChange?.('');
      return;
    }

    if (leafOnly && !idx.isLeaf(chosen)) {
      // Keep the selection in UI but don't promote it as the final value.
      if (!deferChangeUntilLeaf) onChange?.('');
      return;
    }

    onChange?.(chosen);
  }

  const showRequired = required;
  const leafOk = value ? idx.isLeaf(String(value)) : false;
  const lastPicked = path[path.length - 1] || '';
  const lastPickedLeaf = lastPicked ? idx.isLeaf(String(lastPicked)) : false;
  const placeholder = typeof t === 'function' ? t('select_placeholder') : locale === 'ar' ? 'اختر…' : 'Select…';
  const subcategoryRequired = typeof t === 'function' ? t('select_subcategory_required') : locale === 'ar' ? 'اختر تصنيفاً فرعياً.' : 'Please select a subcategory.';
  const searchPlaceholder = typeof t === 'function' ? t('category_search_placeholder') : locale === 'ar' ? 'ابحث عن تصنيف…' : 'Search categories…';
  const noResults = typeof t === 'function' ? t('category_search_no_results') : locale === 'ar' ? 'لا توجد نتائج' : 'No matches';
  const selectedLabel = typeof t === 'function' ? t('category_selected_path') : locale === 'ar' ? 'المسار' : 'Path';
  const quickPickLabel = typeof t === 'function' ? t('category_quick_picks') : locale === 'ar' ? 'فئات شائعة' : 'Popular categories';
  const level1 = typeof t === 'function' ? t('category_level_1') : locale === 'ar' ? 'اختر الفئة' : 'Choose category';
  const level2 = typeof t === 'function' ? t('category_level_2') : locale === 'ar' ? 'اختر الفئة الفرعية' : 'Choose subcategory';
  const level3 = typeof t === 'function' ? t('category_level_3') : locale === 'ar' ? 'اختر النوع' : 'Choose type';

  const smColumns = String(Math.min(3, Math.max(1, levels.length)));

  const roots = useMemo(() => getVirtualRoots(), [idx, dbRoots, generalRootId]);

  const iconBySlug = {
    vehicles: Car,
    'real-estate': Building2,
    electronics: Smartphone,
    home: Home,
    fashion: Shirt,
    kids: Baby,
    jobs: Briefcase,
    services: Wrench,
    animals: PawPrint,
    sports: Dumbbell,
    books: Book,
    'beauty-health': HeartPulse,
  };

  const searchResults = useMemo(() => {
    const q = String(searchQuery || '').trim();
    if (q.length < 2) return [];
    return idx.search(q, locale, { limit: 8, leafOnly });
  }, [idx, searchQuery, locale, leafOnly]);

  function applyPickedId(id) {
    const picked = id ? String(id) : '';
    if (!picked) {
      setPath([]);
      onChange?.('');
      return;
    }
    const nextPath = pathToRootOmitGeneral(picked);
    setPath(nextPath);
    if (leafOnly && !idx.isLeaf(picked)) {
      onChange?.('');
      return;
    }
    onChange?.(picked);
  }

  const pathIdForPreview = value ? String(value) : lastPicked ? String(lastPicked) : '';
  const pathPreview = pathIdForPreview ? getPathLabelOmitGeneral(pathIdForPreview) : '';

  return (
    <div>
      {showBrowse && showQuickPicks && path.length === 0 && roots.length ? (
        <Box mb={showSearch ? '3' : '2'}>
          <Text size="1" color="gray" mb="2" as="div">
            {quickPickLabel}
          </Text>
          <Grid columns={{ initial: '2', sm: '3', md: '4' }} gap="2">
            {roots.slice(0, 12).map((c) => {
              const IconCmp = iconBySlug[String(c.slug || '')] || null;
              const label = idx.getLabel(c, locale);
              return (
                <button
                  key={String(c.id)}
                  type="button"
                  className="rounded-lg border border-[var(--gray-a6)] bg-[var(--color-panel-solid)] px-3 py-3 text-left transition-colors hover:bg-[var(--gray-a2)]"
                  onClick={() => setLevel(0, String(c.id))}
                  title={label}
                >
                  <Flex align="center" gap="2">
                    {IconCmp ? <IconCmp size={18} className="text-[var(--gray-11)]" aria-hidden="true" /> : null}
                    <Text size="2" weight="bold" as="span">
                      {label}
                    </Text>
                  </Flex>
                </button>
              );
            })}
          </Grid>
        </Box>
      ) : null}

      {showSearch ? (
        <Box>
          <Input
            className={controlClassName}
            value={searchQuery}
            placeholder={searchPlaceholder}
            onChange={(e) => setSearchQuery(e.target.value)}
            onBlur={onBlur}
          />

          {String(searchQuery || '').trim().length >= 2 ? (
            <Box
              mt="2"
              className="rounded-lg border border-[var(--gray-a6)] bg-[var(--color-panel-solid)] p-1"
            >
              {searchResults.length ? (
                <Flex direction="column" gap="1">
                  {searchResults.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-[var(--gray-a3)]"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        applyPickedId(r.id);
                        setSearchQuery('');
                      }}
                      title={getPathLabelOmitGeneral(r.id)}
                    >
                      <Text as="div" size="2" weight="bold">
                        {r.label}
                      </Text>
                      <Text as="div" size="1" color="gray">
                        {getPathLabelOmitGeneral(r.id)}
                      </Text>
                    </button>
                  ))}
                </Flex>
              ) : (
                <Box px="3" py="2">
                  <Text size="1" color="gray">
                    {noResults}
                  </Text>
                </Box>
              )}
            </Box>
          ) : null}
        </Box>
      ) : null}

      {showBrowse ? (
        <Box mt={showSearch ? '3' : undefined}>
          <Grid gap="2" columns={{ initial: '1', sm: smColumns }}>
            {levels.map((lvl, i) => {
              const selected = path[i] || '';
              const ph = i === 0 ? level1 : i === 1 ? level2 : level3;

              return (
                <Select
                  key={`${lvl.parentId || 'root'}:${i}`}
                  className={controlClassName}
                  value={selected}
                  onChange={(e) => setLevel(i, e.target.value)}
                  onBlur={onBlur}
                >
                  <option value="">{ph || placeholder}</option>
                  {lvl.options.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {idx.getLabel(c, locale)}
                    </option>
                  ))}
                </Select>
              );
            })}
          </Grid>
        </Box>
      ) : null}

      {pathPreview ? (
        <Text size="1" color="gray" mt="2" as="div">
          <Text as="span" weight="bold" color="gray">
            {selectedLabel}:{' '}
          </Text>
          {pathPreview}
        </Text>
      ) : null}

      {showRequired && leafOnly && lastPicked && !lastPickedLeaf ? (
        <Text size="1" color="red" mt="1" as="div">
          {subcategoryRequired}
        </Text>
      ) : null}

      {showRequired && leafOnly && value && !leafOk ? (
        <Text size="1" color="red" mt="1" as="div">
          {subcategoryRequired}
        </Text>
      ) : null}
    </div>
  );
}
