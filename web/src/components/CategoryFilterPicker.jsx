import { useEffect, useMemo, useState } from 'react';
import { Box, Flex, Text } from '@radix-ui/themes';
import { SearchX } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { buildCategoryIndex } from '../lib/categoryTree';

export function CategoryFilterPicker({ categories, value, onChange, locale = 'ar', t }) {
  const idx = useMemo(() => buildCategoryIndex(categories || []), [categories]);

  const dbRoots = useMemo(() => idx.getChildren(''), [idx]);
  const generalRootId = useMemo(() => {
    if (dbRoots.length !== 1) return '';
    const r = dbRoots[0];
    if (String(r?.slug || '') !== 'general') return '';
    return String(r.id);
  }, [dbRoots]);

  function getPathLabelOmitGeneral(id, sep = ' › ') {
    const ids = idx.pathToRoot(id ? String(id) : '');
    const trimmed = generalRootId && ids.length && ids[0] === generalRootId ? ids.slice(1) : ids;
    return trimmed
      .map((x) => idx.getLabel(idx.byId.get(String(x)), locale))
      .filter(Boolean)
      .join(sep);
  }

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // If a value is selected and the user hasn't typed, show the current path.
    if (!value) return;
    if (query.trim()) return;
    setQuery('');
  }, [value]);

  const placeholder = typeof t === 'function' ? t('category_search_placeholder') : locale === 'ar' ? 'ابحث عن تصنيف…' : 'Search categories…';
  const noResults = typeof t === 'function' ? t('category_search_no_results') : locale === 'ar' ? 'لا توجد نتائج' : 'No matches';
  const selectedLabel = typeof t === 'function' ? t('category_selected_path') : locale === 'ar' ? 'المسار' : 'Path';

  const results = useMemo(() => {
    const q = String(query || '').trim();
    if (q.length < 2) return [];
    return idx.search(q, locale, { limit: 10, leafOnly: false });
  }, [idx, query, locale]);

  const selectedPath = value ? getPathLabelOmitGeneral(String(value)) : '';

  function clear() {
    setQuery('');
    setOpen(false);
    onChange?.('');
  }

  return (
    <Box style={{ position: 'relative' }}>
      <Flex gap="2" align="center">
        <Input
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay close so click can register.
            window.setTimeout(() => setOpen(false), 120);
          }}
        />
        {value ? (
          <Button
            size="sm"
            variant="ghost"
            className="px-2"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            title={typeof t === 'function' ? t('clear_filters') : 'Clear'}
            aria-label={typeof t === 'function' ? t('clear_filters') : 'Clear'}
          >
            <SearchX size={16} />
          </Button>
        ) : null}
      </Flex>

      {selectedPath ? (
        <Text size="1" color="gray" mt="2" as="div">
          <Text as="span" weight="bold" color="gray">
            {selectedLabel}:{' '}
          </Text>
          {selectedPath}
        </Text>
      ) : null}

      {open && query.trim().length >= 2 ? (
        <Box
          mt="2"
          className="rounded-lg border border-[var(--gray-a6)] bg-[var(--color-panel-solid)] p-1"
          style={{ maxHeight: 240, overflow: 'auto' }}
        >
          {results.length ? (
            <Flex direction="column" gap="1">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-[var(--gray-a3)]"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange?.(String(r.id));
                    setQuery('');
                    setOpen(false);
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
  );
}
