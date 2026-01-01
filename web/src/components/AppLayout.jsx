import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Container, Flex, Link as RTLink, SegmentedControl, Text } from '@radix-ui/themes';
import {
  LayoutList,
  LayoutDashboard,
  MessageSquare,
  PlusCircle,
  ShieldCheck,
  User,
  LogIn,
  UserPlus,
  Menu,
  LogOut,
  X,
  Bookmark,
  FileText,
  Eye,
  Users,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui/Button';
import { Dropdown, DropdownItem, DropdownSeparator } from '../ui/Dropdown';
import { LanguageSwitch } from './LanguageSwitch';
import { useI18n } from '../i18n/i18n';
import { Icon } from '../ui/Icon';
import { useThemeMode } from '../ui/ThemeMode';
import { Moon, Sun } from 'lucide-react';
import { api } from '../lib/api';
import { buildCategoryIndex } from '../lib/categoryTree';
import { CategoryMegaMenu } from './CategoryMegaMenu';

export function AppLayout() {
  const { user, isAuthenticated, isStaff, logout } = useAuth();
  const { t, locale, dir } = useI18n();
  const { appearance, toggle } = useThemeMode();
  const location = useLocation();
  const navigate = useNavigate();

  const showCategoryNav = (location.pathname || '').startsWith('/listings');

  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.categoriesAll();
        if (!alive) return;
        setCategories(Array.isArray(data) ? data : []);
        setCategoriesError('');
      } catch (e) {
        if (!alive) return;
        setCategories([]);
        setCategoriesError(e ? String(e.message || e) : '');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const categoryIndex = useMemo(() => buildCategoryIndex(categories || []), [categories]);

  const categoriesBySlug = useMemo(() => {
    const map = new Map();
    for (const c of categories || []) {
      const slug = String(c?.slug || '').trim();
      if (!slug) continue;
      map.set(slug, c);
    }
    return map;
  }, [categories]);

  function goToCategory(categoryId) {
    const id = String(categoryId || '').trim();
    if (!id) {
      navigate('/listings');
      return;
    }
    navigate(`/listings?category=${encodeURIComponent(id)}`);
  }

  const popularSlugs = useMemo(
    () => ['mobile-phones', 'cars', 'apartment', 'womens-clothing', 'motorcycles', 'kids'],
    [],
  );

  const popularCategories = useMemo(() => {
    const out = [];
    for (const slug of popularSlugs) {
      const c = categoriesBySlug.get(slug);
      if (!c) continue;
      out.push({
        slug,
        id: String(c.id),
        label: categoryIndex.getLabel(c, locale),
      });
    }
    return out;
  }, [popularSlugs, categoriesBySlug, categoryIndex, locale]);

  useEffect(() => {
    // Keep navigation between routes feeling crisp and predictable.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search]);

  const navSlotRef = useRef(null);
  const linksSizerRef = useRef(null);
  const [navCollapsed, setNavCollapsed] = useState(false);

  const currentTab = useMemo(() => {
    const p = location.pathname || '';
    if (p.startsWith('/admin/dashboard')) return 'dashboard';
    if (p.startsWith('/admin/moderation')) return 'moderation';
    if (p.startsWith('/threads')) return 'threads';
    if (p.startsWith('/my')) return 'my';
    if (p.startsWith('/create')) return 'create';
    return 'listings';
  }, [location.pathname]);

  const navItems = useMemo(
    () =>
      [
        { value: 'listings', to: '/listings', label: t('nav_listings'), icon: LayoutList, show: true },
        { value: 'create', to: '/create', label: t('nav_create'), icon: PlusCircle, show: isAuthenticated },
        { value: 'my', to: '/my', label: t('nav_my'), icon: User, show: isAuthenticated },
        { value: 'threads', to: '/threads', label: t('nav_messages'), icon: MessageSquare, show: isAuthenticated },
        { value: 'dashboard', to: '/admin/dashboard', label: t('nav_dashboard'), icon: LayoutDashboard, show: isStaff },
        { value: 'moderation', to: '/admin/moderation', label: t('nav_moderation'), icon: ShieldCheck, show: isStaff },
      ].filter((x) => x.show),
    [isAuthenticated, isStaff, t],
  );

  const renderNavItem = (item) => (
    <Flex align="center" gap="2">
      <Icon icon={item.icon} size={16} />
      <Text as="span" size="2">
        {item.label}
      </Text>
    </Flex>
  );

  const navByValue = useMemo(() => {
    const map = new Map();
    for (const item of navItems) map.set(item.value, item);
    return map;
  }, [navItems]);

  const navControl = (
    <SegmentedControl.Root
      value={currentTab}
      variant='classic'
      radius='full'
      onValueChange={(next) => {
        const item = navByValue.get(next);
        if (item) navigate(item.to);
      }}
    >
      {navItems.map((item) => (
        <SegmentedControl.Item key={item.value} value={item.value}>
          {renderNavItem(item)}
        </SegmentedControl.Item>
      ))}
    </SegmentedControl.Root>
  );

  useEffect(() => {
    const slot = navSlotRef.current;
    const sizer = linksSizerRef.current;
    if (!slot || !sizer) return;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const available = slot.clientWidth || 0;
        const needed = sizer.scrollWidth || 0;
        // Small epsilon avoids flicker on fractional widths
        setNavCollapsed(needed > available + 1);
      });
    };

    update();

    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(slot);
      ro.observe(sizer);
    }
    window.addEventListener('resize', update);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      if (ro) ro.disconnect();
    };
  }, [navItems]);

  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    // prevent background scroll when drawer is open
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--gray-1)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 rounded-lg border border-[var(--gray-a5)] bg-[var(--color-panel-solid)] px-3 py-2 text-sm"
      >
        {t('skip_to_content')}
      </a>
      <header className="sticky top-0 z-40 border-b border-[var(--gray-a5)] bg-[var(--color-panel-solid)]/90 backdrop-blur">
        <Container size="4">
          <Flex align="center" justify="between" gap="3" py="2" wrap="wrap">
            <Flex align="center" gap="3" minWidth="0" style={{ flex: 1 }}>
              <RTLink asChild highContrast underline="none">
                <Link to="/listings">
                  <Text weight="bold">{t('appName')}</Text>
                </Link>
              </RTLink>

              {/* Mobile categories + hamburger - visible only below sm */}
              <div className="sm:hidden flex items-center gap-2">
                {showCategoryNav ? (
                  <CategoryMegaMenu
                    categories={categories}
                    locale={locale}
                    dir={dir}
                    t={t}
                    label={t('all_categories')}
                    loading={!categoriesError && (!categories || categories.length === 0)}
                    error={categoriesError}
                    onPick={(id) => {
                      goToCategory(id);
                    }}
                  />
                ) : null}

                <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(true)} aria-label={t('menu')}> 
                  <Icon icon={Menu} size={16} />
                </Button>
              </div>

              <div ref={navSlotRef} className="min-w-0 flex-1">
                {/* Show the segmented nav only when there's room AND on sm+ screens */}
                <div className={navCollapsed ? 'hidden' : 'hidden sm:block'}>{navControl}</div>

                {/* When collapsed on wider screens, show the dropdown; on small screens prefer the hamburger + drawer */}
                <div className={navCollapsed ? 'hidden sm:block' : 'hidden'}>
                  <Dropdown
                    trigger={
                      <Button size="sm" variant="secondary">
                        <Flex align="center" gap="2">
                          <Icon icon={Menu} size={16} />
                          <Text as="span" size="2">
                            {t('menu')}
                          </Text>
                        </Flex>
                      </Button>
                    }
                  >
                    <DropdownItem asChild>
                      <Link to="/listings">{t('nav_listings')}</Link>
                    </DropdownItem>
                    {isAuthenticated ? (
                      <DropdownItem asChild>
                        <Link to="/create">{t('nav_create')}</Link>
                      </DropdownItem>
                    ) : null}
                    {isAuthenticated ? (
                      <DropdownItem asChild>
                        <Link to="/my">{t('nav_my')}</Link>
                      </DropdownItem>
                    ) : null}
                    {isAuthenticated ? (
                      <DropdownItem asChild>
                        <Link to="/threads">{t('nav_messages')}</Link>
                      </DropdownItem>
                    ) : null}
                    {isStaff ? (
                      <DropdownItem asChild>
                        <Link to="/admin/dashboard">{t('nav_dashboard')}</Link>
                      </DropdownItem>
                    ) : null}
                    {isStaff ? (
                      <DropdownItem asChild>
                        <Link to="/admin/moderation">{t('nav_moderation')}</Link>
                      </DropdownItem>
                    ) : null}
                  </Dropdown>
                </div>
              </div>
              <div
                style={{
                  position: 'relative',
                  width: 0,
                  height: 0,
                  overflow: 'hidden',
                }}
                aria-hidden="true"
              >
                <div
                  ref={linksSizerRef}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    visibility: 'hidden',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <SegmentedControl.Root value={currentTab} style={{ borderRadius: 'var(--radius-thumb)' }}>
                    {navItems.map((item) => (
                      <SegmentedControl.Item key={item.value} value={item.value}>
                        {renderNavItem(item)}
                      </SegmentedControl.Item>
                    ))}
                  </SegmentedControl.Root>
                </div>
              </div>
            </Flex>

            <div className="hidden sm:block">
              <Flex align="center" gap="2">
                <LanguageSwitch />
                <Button
                  variant="secondary"
                  onClick={toggle}
                  title={appearance === 'dark' ? t('theme_light') : t('theme_dark')}
                  aria-label={appearance === 'dark' ? t('theme_light') : t('theme_dark')}
                  className="px-2"
                >
                  <Icon icon={appearance === 'dark' ? Sun : Moon} size={16} />
                </Button>
                {isAuthenticated ? (
                  <Dropdown
                    trigger={
                      <Button variant="secondary">
                        <Flex align="center" gap="2">
                          <Icon icon={User} size={16} />
                          <Text as="span" size="2">
                            {user?.username || t('account')}
                          </Text>
                        </Flex>
                      </Button>
                    }
                  >
                  {user?.id ? (
                    <DropdownItem asChild>
                      <Link to={`/profile/${user.id}`}>
                        <Flex align="center" gap="2">
                          <Icon icon={User} size={16} />
                          <Text as="span" size="2">
                            {t('nav_profile')}
                          </Text>
                        </Flex>
                      </Link>
                    </DropdownItem>
                  ) : null}
                  <DropdownItem asChild>
                    <Link to="/saved-searches">
                      <Flex align="center" gap="2">
                        <Icon icon={Bookmark} size={16} />
                        <Text as="span" size="2">
                          {t('nav_saved_searches')}
                        </Text>
                      </Flex>
                    </Link>
                  </DropdownItem>
                  <DropdownItem asChild>
                    <Link to="/reports">
                      <Flex align="center" gap="2">
                        <Icon icon={FileText} size={16} />
                        <Text as="span" size="2">
                          {t('nav_reports')}
                        </Text>
                      </Flex>
                    </Link>
                  </DropdownItem>
                  <DropdownItem asChild>
                    <Link to="/watchlist">
                      <Flex align="center" gap="2">
                        <Icon icon={Eye} size={16} />
                        <Text as="span" size="2">
                          {t('nav_watchlist')}
                        </Text>
                      </Flex>
                    </Link>
                  </DropdownItem>
                  <DropdownItem asChild>
                    <Link to="/following">
                      <Flex align="center" gap="2">
                        <Icon icon={Users} size={16} />
                        <Text as="span" size="2">
                          {t('nav_following')}
                        </Text>
                      </Flex>
                    </Link>
                  </DropdownItem>
                  {isStaff ? (
                    <DropdownItem asChild>
                      <Link to="/admin/dashboard">
                        <Flex align="center" gap="2">
                          <Icon icon={LayoutDashboard} size={16} />
                          <Text as="span" size="2">
                            {t('nav_dashboard')}
                          </Text>
                        </Flex>
                      </Link>
                    </DropdownItem>
                  ) : null}
                  {isStaff ? (
                    <DropdownItem asChild>
                      <Link to="/admin/moderation">
                        <Flex align="center" gap="2">
                          <Icon icon={ShieldCheck} size={16} />
                          <Text as="span" size="2">
                            {t('nav_moderation')}
                          </Text>
                        </Flex>
                      </Link>
                    </DropdownItem>
                  ) : null}
                  <DropdownSeparator />
                  <DropdownItem
                    onSelect={(e) => {
                      e.preventDefault();
                      logout();
                    }}
                  >
                    <Flex align="center" gap="2">
                      <Icon icon={LogOut} size={16} />
                      <Text as="span" size="2">
                        {t('logout')}
                      </Text>
                    </Flex>
                  </DropdownItem>
                </Dropdown>
              ) : (
                <>
                  <RTLink asChild underline="none">
                    <Link to="/login">
                      <Button variant="secondary">
                        <Flex align="center" gap="2">
                          <Icon icon={LogIn} size={16} />
                          <Text as="span" size="2">
                            {t('login')}
                          </Text>
                        </Flex>
                      </Button>
                    </Link>
                  </RTLink>
                  <RTLink asChild underline="none">
                    <Link to="/register">
                      <Button>
                        <Flex align="center" gap="2">
                          <Icon icon={UserPlus} size={16} />
                          <Text as="span" size="2">
                            {t('register')}
                          </Text>
                        </Flex>
                      </Button>
                    </Link>
                  </RTLink>
                </>
              )}
            </Flex>
          </div>
        </Flex>
        </Container>

        {showCategoryNav ? (
          <div className="border-t border-[var(--gray-a5)]">
            <Container size="4">
              <div className="flex items-center gap-2 py-2">
                <div className="hidden sm:block">
                  <CategoryMegaMenu
                    categories={categories}
                    locale={locale}
                    dir={dir}
                    t={t}
                    label={t('all_categories')}
                    loading={!categoriesError && (!categories || categories.length === 0)}
                    error={categoriesError}
                    onPick={(id) => goToCategory(id)}
                  />
                </div>

                <div className="hidden sm:flex-1">
                  <div className="flex justify-around items-center gap-1 whitespace-nowrap">
                    {popularCategories.map((c) => (
                      <div key={c.slug} className='flex'>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            goToCategory(c.id);
                          }}
                          >
                          {c.label}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Container>
          </div>
        ) : null}
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="relative bg-[var(--color-panel-solid)] w-80 max-w-[80%] h-full p-4 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Text weight="bold">{t('appName')}</Text>
              </div>

              <div className="flex items-center gap-2">
                <LanguageSwitch />
                <Button
                  variant="secondary"
                  onClick={toggle}
                  title={appearance === 'dark' ? t('theme_light') : t('theme_dark')}
                  aria-label={appearance === 'dark' ? t('theme_light') : t('theme_dark')}
                  className="px-2"
                >
                  <Icon icon={appearance === 'dark' ? Sun : Moon} size={16} />
                </Button>

                <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(false)} aria-label={t('menu')}> 
                  <Icon icon={X} size={16} />
                </Button>
              </div>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => (
                <Link key={item.value} to={item.to} onClick={() => setDrawerOpen(false)} className="block">
                  <Button variant="ghost" className="w-full text-left">
                    <Flex align="center" gap="2">
                      <Icon icon={item.icon} size={16} />
                      <Text as="span" size="2">
                        {item.label}
                      </Text>
                    </Flex>
                  </Button>
                </Link>
              ))}
            </nav>

            <div className="mt-4 border-t border-[var(--gray-a5)] pt-4">
              {isAuthenticated ? (
                <div className="space-y-1">
                  {user?.id ? (
                    <Link to={`/profile/${user.id}`} onClick={() => setDrawerOpen(false)} className="block">
                      <button className="w-full flex items-center gap-3 p-3 rounded hover:bg-[var(--gray-a3)]">
                        <Icon icon={User} size={18} />
                        <span className="text-sm">{t('nav_profile')}</span>
                      </button>
                    </Link>
                  ) : null}
                  <Link to="/saved-searches" onClick={() => setDrawerOpen(false)} className="block">
                    <button className="w-full flex items-center gap-3 p-3 rounded hover:bg-[var(--gray-a3)]">
                      <Icon icon={Bookmark} size={18} />
                      <span className="text-sm">{t('nav_saved_searches')}</span>
                    </button>
                  </Link>

                  <Link to="/reports" onClick={() => setDrawerOpen(false)} className="block">
                    <button className="w-full flex items-center gap-3 p-3 rounded hover:bg-[var(--gray-a3)]">
                      <Icon icon={FileText} size={18} />
                      <span className="text-sm">{t('nav_reports')}</span>
                    </button>
                  </Link>

                  <Link to="/watchlist" onClick={() => setDrawerOpen(false)} className="block">
                    <button className="w-full flex items-center gap-3 p-3 rounded hover:bg-[var(--gray-a3)]">
                      <Icon icon={Eye} size={18} />
                      <span className="text-sm">{t('nav_watchlist')}</span>
                    </button>
                  </Link>

                  <Link to="/following" onClick={() => setDrawerOpen(false)} className="block">
                    <button className="w-full flex items-center gap-3 p-3 rounded hover:bg-[var(--gray-a3)]">
                      <Icon icon={Users} size={18} />
                      <span className="text-sm">{t('nav_following')}</span>
                    </button>
                  </Link>

                  <button className="w-full flex items-center gap-3 p-3 rounded hover:bg-[var(--gray-a3)]" onClick={(e) => { e.preventDefault(); logout(); setDrawerOpen(false); }}>
                    <Icon icon={LogOut} size={18} />
                    <span className="text-sm">{t('logout')}</span>
                  </button>
                </div>
              ) : (
                <>
                  <Link to="/login" onClick={() => setDrawerOpen(false)}>
                    <Button variant="secondary" className="w-full">{t('login')}</Button>
                  </Link>
                  <Link to="/register" onClick={() => setDrawerOpen(false)}>
                    <Button className="w-full">{t('register')}</Button>
                  </Link>
                </>
              )}
            </div>


          </div>
        </div>
      ) : null}

      <main id="main" tabIndex={-1} className="focus:outline-none flex-1">
        <Container
          size="4"
          py={{ initial: '4', sm: '5' }}
          style={location.pathname.startsWith('/map') ? { maxWidth: '100%' } : undefined}
        >
          <div key={`${location.pathname}${location.search}`} className="bb-animate-enter">
            <Outlet />
          </div>
        </Container>
      </main>

      <footer className="border-t border-[var(--gray-a5)] bg-[var(--color-panel-solid)]">
        <Container size="4">
          <Flex py="3" justify="between" align="center">
            <Text size="1" color="gray">
              {t('appName')}
            </Text>
          </Flex>
        </Container>
      </footer>
    </div>
  );
}
