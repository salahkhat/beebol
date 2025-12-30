import { useEffect, useMemo, useRef, useState } from 'react';
import { Flex, Text } from '@radix-ui/themes';
import {
  Baby,
  Book,
  Briefcase,
  Building2,
  Car,
  Dumbbell,
  HeartPulse,
  Home,
  LayoutGrid,
  PawPrint,
  Shirt,
  Smartphone,
  Wrench,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { buildCategoryIndex } from '../lib/categoryTree';

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

function useHoverOpen({ initialOpen = false } = {}) {
  const [open, setOpen] = useState(initialOpen);
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

  return { open, setOpen, openNow, closeSoon };
}

function MenuItemButton({ active, onClick, onMouseEnter, children, title }) {
  return (
    <button
      type="button"
      className={
        'w-full rounded-lg px-3 py-2 text-left transition-colors ' +
        (active ? 'bg-[var(--gray-a3)]' : 'hover:bg-[var(--gray-a2)]')
      }
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      title={title}
    >
      {children}
    </button>
  );
}

export function CategoryMegaMenu({ categories, locale = 'ar', dir = 'ltr', t, label, onPick, error, loading }) {
  const idx = useMemo(() => buildCategoryIndex(categories || []), [categories]);
  const roots = useMemo(() => {
    const top = idx.getChildren('');
    if (top.length !== 1) return top;
    const only = top[0];
    const onlySlug = String(only?.slug || '');
    if (onlySlug !== 'general') return top;
    const kids = idx.getChildren(String(only.id));
    return kids.length ? kids : top;
  }, [idx]);

  const { open, setOpen, openNow, closeSoon } = useHoverOpen();

  const [activeRootId, setActiveRootId] = useState('');
  const [activeChildId, setActiveChildId] = useState('');

  // Mobile navigation state
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState('root'); // 'root' | 'children' | 'grandchildren'
  const [mobileActiveRootId, setMobileActiveRootId] = useState('');
  const [mobileActiveChildId, setMobileActiveChildId] = useState('');

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobile(!!mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (!open) {
      setMobileView('root');
      setMobileActiveRootId('');
      setMobileActiveChildId('');
    }
  }, [open]);

  useEffect(() => {
    if (!roots.length) return;
    const first = String(roots[0].id);
    setActiveRootId((cur) => cur || first);
  }, [roots]);

  const activeRoot = activeRootId ? idx.byId.get(String(activeRootId)) : null;
  const level2 = useMemo(() => idx.getChildren(activeRootId || ''), [idx, activeRootId]);

  useEffect(() => {
    if (!level2.length) {
      setActiveChildId('');
      return;
    }
    const stillExists = activeChildId && level2.some((c) => String(c.id) === String(activeChildId));
    if (!stillExists) setActiveChildId(String(level2[0].id));
  }, [level2, activeChildId]);

  const level3 = useMemo(() => idx.getChildren(activeChildId || ''), [idx, activeChildId]);

  const triggerLabel = label || (typeof t === 'function' ? t('all_categories') : 'All Categories');
  const rtl = String(dir) === 'rtl';

  return (
    <div
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Flex align="center" gap="2">
          <Icon icon={LayoutGrid} size={16} />
          <Text as="span" size="2">
            {triggerLabel}
          </Text>
        </Flex>
      </Button>

      {open ? (
        <div
          className={
            'bb-popover absolute mt-2 rounded-xl border border-[var(--gray-a6)] bg-[var(--color-panel-solid)] shadow-sm ' +
            (rtl ? 'right-0' : 'left-0')
          }
          style={{
            width: isMobile ? '100vw' : 'min(96vw, 920px)',
            left: isMobile ? 0 : undefined,
            maxHeight: 'calc(100vh - 160px)',
            overflow: 'auto',
            zIndex: 60,
            direction: rtl ? 'rtl' : 'ltr',
          }}
          role="menu"
        >
          {!isMobile ? (
            <div className="grid gap-0" style={{ gridTemplateColumns: '280px 1fr 1fr' }}>
              <div className={(rtl ? 'border-l' : 'border-r') + ' border-[var(--gray-a5)] p-2'}>
                <Text size="1" color="gray" className="px-2 py-2" as="div">
                  {activeRoot ? idx.getLabel(activeRoot, locale) : ''}
                </Text>

                {error ? (
                  <Text size="1" color="gray" className="px-2 py-2" as="div">
                    {typeof t === 'function' ? t('unexpected_error') : 'Unexpected error'}
                  </Text>
                ) : loading ? (
                  <Text size="1" color="gray" className="px-2 py-2" as="div">
                    {typeof t === 'function' ? t('loading') : 'Loading…'}
                  </Text>
                ) : (
                  <div className="space-y-1">
                    {roots.map((r) => {
                      const rid = String(r.id);
                      const IconCmp = iconBySlug[String(r.slug || '')] || null;
                      const rLabel = idx.getLabel(r, locale);
                      return (
                        <MenuItemButton
                          key={rid}
                          active={rid === String(activeRootId)}
                          title={rLabel}
                          onMouseEnter={() => {
                            setActiveRootId(rid);
                            setActiveChildId('');
                          }}
                          onClick={() => {
                            // Touch-friendly: first click selects, second click navigates.
                            if (rid !== String(activeRootId)) {
                              setActiveRootId(rid);
                              setActiveChildId('');
                              return;
                            }
                            setOpen(false);
                            onPick?.(rid);
                          }}
                        >
                          <Flex align="center" gap="2">
                            {IconCmp ? <IconCmp size={16} className="text-[var(--gray-11)]" aria-hidden="true" /> : null}
                            <Text as="span" size="2" weight={rid === String(activeRootId) ? 'bold' : undefined}>
                              {rLabel}
                            </Text>
                          </Flex>
                        </MenuItemButton>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className={(rtl ? 'border-l' : 'border-r') + ' border-[var(--gray-a5)] p-2'}>
                <Text size="1" color="gray" className="px-2 py-2" as="div">
                  {typeof t === 'function' ? t('category_level_2') : locale === 'ar' ? 'اختر الفئة الفرعية' : 'Choose subcategory'}
                </Text>
                <div className="space-y-1">
                  {level2.length ? (
                    level2.map((c) => {
                      const cid = String(c.id);
                      const cLabel = idx.getLabel(c, locale);
                      const hasKids = idx.getChildren(cid).length > 0;
                      return (
                        <MenuItemButton
                          key={cid}
                          active={cid === String(activeChildId)}
                          title={cLabel}
                          onMouseEnter={() => {
                            if (hasKids) setActiveChildId(cid);
                          }}
                          onClick={() => {
                            // Touch-friendly: first click selects (if it has children), second click navigates.
                            if (hasKids && cid !== String(activeChildId)) {
                              setActiveChildId(cid);
                              return;
                            }
                            setOpen(false);
                            onPick?.(cid);
                          }}
                        >
                          <Flex align="center" justify="between" gap="2">
                            <Text as="span" size="2" weight={cid === String(activeChildId) ? 'bold' : undefined}>
                              {cLabel}
                            </Text>
                            {hasKids ? (
                              <Text as="span" size="1" color="gray">
                                {rtl ? '‹' : '›'}
                              </Text>
                            ) : null}
                          </Flex>
                        </MenuItemButton>
                      );
                    })
                  ) : (
                    <Text size="1" color="gray" className="px-2 py-2" as="div">
                      {typeof t === 'function' ? t('category_search_no_results') : 'No matches'}
                    </Text>
                  )}
                </div>
              </div>

              <div className="p-2">
                <Text size="1" color="gray" className="px-2 py-2" as="div">
                  {typeof t === 'function' ? t('category_level_3') : locale === 'ar' ? 'اختر النوع' : 'Choose type'}
                </Text>
                <div className="grid grid-cols-2 gap-1 p-1">
                  {level3.length ? (
                    level3.map((c) => {
                      const cid = String(c.id);
                      const cLabel = idx.getLabel(c, locale);
                      return (
                        <button
                          key={cid}
                          type="button"
                          className="rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--gray-a2)]"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setOpen(false);
                            onPick?.(cid);
                          }}
                          title={cLabel}
                        >
                          <Text as="span" size="2">
                            {cLabel}
                          </Text>
                        </button>
                      );
                    })
                  ) : (
                    <Text size="1" color="gray" className="px-2 py-2" as="div">
                      {typeof t === 'function' ? t('category_search_no_results') : 'No matches'}
                    </Text>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Mobile single-column progressive navigation
            <div className="p-2">
              <div className="flex items-center justify-between mb-2">
                {mobileView !== 'root' ? (
                  <button className="px-2 py-1" onClick={() => {
                    if (mobileView === 'grandchildren') setMobileView('children');
                    else setMobileView('root');
                  }}>{rtl ? '›' : '‹'}</button>
                ) : <div />}
                <Text size="1" color="gray">{mobileView === 'root' ? triggerLabel : mobileView === 'children' ? (idx.getLabel(idx.byId.get(mobileActiveRootId), locale) || '') : (idx.getLabel(idx.byId.get(mobileActiveChildId), locale) || '')}</Text>
                <button className="px-2 py-1" onClick={() => setOpen(false)}>✕</button>
              </div>

              {mobileView === 'root' && (
                <div className="space-y-1">
                  {roots.map((r) => {
                    const rid = String(r.id);
                    const IconCmp = iconBySlug[String(r.slug || '')] || null;
                    const rLabel = idx.getLabel(r, locale);
                    const hasKids = idx.getChildren(rid).length > 0;
                    return (
                      <button key={rid} className="w-full flex items-center gap-3 p-3 rounded hover:bg-[var(--gray-a3)]" onClick={() => {
                        if (hasKids) {
                          setMobileActiveRootId(rid);
                          setMobileView('children');
                        } else {
                          setOpen(false); onPick?.(rid);
                        }
                      }}>
                        {IconCmp ? <IconCmp size={18} className="text-[var(--gray-11)]"/> : null}
                        <span className="text-sm">{rLabel}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {mobileView === 'children' && (
                <div className="space-y-1">
                  {idx.getChildren(mobileActiveRootId).map((c) => {
                    const cid = String(c.id);
                    const cLabel = idx.getLabel(c, locale);
                    const hasKids = idx.getChildren(cid).length > 0;
                    return (
                      <button key={cid} className="w-full flex items-center gap-3 p-3 rounded hover:bg-[var(--gray-a3)]" onClick={() => {
                        if (hasKids) {
                          setMobileActiveChildId(cid);
                          setMobileView('grandchildren');
                        } else {
                          setOpen(false); onPick?.(cid);
                        }
                      }}>
                        <span className="text-sm">{cLabel}</span>
                        {hasKids ? <span className="ml-auto">{rtl ? '‹' : '›'}</span> : null}
                      </button>
                    );
                  })}
                </div>
              )}

              {mobileView === 'grandchildren' && (
                <div className="space-y-1">
                  {idx.getChildren(mobileActiveChildId).map((c) => {
                    const cid = String(c.id);
                    const cLabel = idx.getLabel(c, locale);
                    return (
                      <button key={cid} className="w-full flex items-center gap-3 p-3 rounded hover:bg-[var(--gray-a3)]" onClick={() => { setOpen(false); onPick?.(cid); }}>
                        <span className="text-sm">{cLabel}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
