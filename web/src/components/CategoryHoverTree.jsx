import { useEffect, useMemo, useRef, useState } from 'react';
import { Flex, Text } from '@radix-ui/themes';
import { LayoutList } from 'lucide-react';
import { Dropdown } from '../ui/Dropdown';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { buildCategoryIndex } from '../lib/categoryTree';

function TreeNode({ node, depth, idx, locale, onPick }) {
  const id = String(node?.id || '');
  const label = idx.getLabel(node, locale);
  const children = idx.getChildren(id);
  const hasChildren = children.length > 0;

  const rowClass =
    'w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[var(--gray-a3)]';

  const indentStyle = {
    paddingInlineStart: 8 + depth * 14,
  };

  if (!hasChildren) {
    return (
      <button
        type="button"
        className={rowClass}
        style={indentStyle}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onPick?.(id)}
        title={label}
      >
        <Text as="span" size="2">
          {label}
        </Text>
      </button>
    );
  }

  return (
    <details open={depth < 1} className="select-none">
      <summary
        className={rowClass}
        style={indentStyle}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          // Keep the dropdown open while expanding/collapsing.
          e.stopPropagation();
        }}
        title={label}
      >
        <Text as="span" size="2" weight="bold">
          {label}
        </Text>
      </summary>
      <div className="mt-1">
        {children.map((c) => (
          <TreeNode key={String(c.id)} node={c} depth={depth + 1} idx={idx} locale={locale} onPick={onPick} />
        ))}
      </div>
    </details>
  );
}

export function CategoryHoverTree({
  categories,
  locale = 'ar',
  t,
  label,
  onPick,
  error,
  loading,
}) {
  const idx = useMemo(() => buildCategoryIndex(categories || []), [categories]);
  const roots = useMemo(() => idx.getChildren(''), [idx]);

  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef(0);

  function openNow() {
    window.clearTimeout(closeTimerRef.current);
    setOpen(true);
  }

  function closeSoon() {
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 140);
  }

  useEffect(() => {
    return () => {
      window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const triggerLabel = label || (typeof t === 'function' ? t('all_categories') : 'All Categories');

  return (
    <div onMouseEnter={openNow} onMouseLeave={closeSoon}>
      <Dropdown
        open={open}
        onOpenChange={setOpen}
        modal={false}
        trigger={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setOpen((v) => !v);
            }}
          >
            <Flex align="center" gap="2">
              <Icon icon={LayoutList} size={16} />
              <Text as="span" size="2">
                {triggerLabel}
              </Text>
            </Flex>
          </Button>
        }
      >
        <div
          className="p-2"
          style={{
            width: 'min(92vw, 760px)',
            maxHeight: 'calc(100vh - 160px)',
            overflow: 'auto',
          }}
        >
          {error ? (
            <Text size="1" color="gray">
              {typeof t === 'function' ? t('unexpected_error') : 'Unexpected error'}
            </Text>
          ) : loading ? (
            <Text size="1" color="gray">
              {typeof t === 'function' ? t('loading') : 'Loading…'}
            </Text>
          ) : roots.length ? (
            <div className="space-y-1">
              {roots.map((r) => (
                <TreeNode
                  key={String(r.id)}
                  node={r}
                  depth={0}
                  idx={idx}
                  locale={locale}
                  onPick={(id) => {
                    setOpen(false);
                    onPick?.(id);
                  }}
                />
              ))}
            </div>
          ) : (
            <Text size="1" color="gray">
              {typeof t === 'function' ? t('category_search_no_results') : 'No matches'}
            </Text>
          )}
        </div>
      </Dropdown>
    </div>
  );
}
