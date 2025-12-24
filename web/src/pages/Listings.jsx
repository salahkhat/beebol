import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Box, Flex, Grid, Heading, Link as RTLink, Text } from '@radix-ui/themes';
import { ChevronLeft, ChevronRight, Clock, MapPin, PlusCircle, SearchX } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { InlineError } from '../ui/InlineError';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { FavoriteButton } from '../ui/FavoriteButton';
import { formatMoney } from '../lib/format';
import { getRecentlyViewed, onRecentlyViewedChange } from '../lib/recentlyViewed';
import { formatDate } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/i18n';
import { useToast } from '../ui/Toast';
import { addSavedSearch, describeListingSearch } from '../lib/savedSearches';

function moderationBadgeVariant(m) {
  if (m === 'approved') return 'ok';
  if (m === 'pending') return 'warn';
  if (m === 'rejected') return 'danger';
  return 'default';
}

export function ListingsPage() {
  const { isAuthenticated } = useAuth();
  const { t, dir } = useI18n();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();

  function moderationLabel(code) {
    if (!code) return '';
    const key = `moderation_status_${code}`;
    const translated = t(key);
    return translated === key ? String(code) : translated;
  }

  const [cats, setCats] = useState([]);
  const [govs, setGovs] = useState([]);
  const [cities, setCities] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [recentlyViewed, setRecentlyViewed] = useState(() => getRecentlyViewed());

  useEffect(() => {
    setRecentlyViewed(getRecentlyViewed());
    return onRecentlyViewedChange(() => setRecentlyViewed(getRecentlyViewed()));
  }, []);

  const params = useMemo(() => {
    const get = (k) => sp.get(k) || '';
    return {
      search: get('search'),
      category: get('category'),
      governorate: get('governorate'),
      city: get('city'),
      neighborhood: get('neighborhood'),
      ordering: get('ordering'),
      page: get('page') || '1',
    };
  }, [sp]);

  const [searchDraft, setSearchDraft] = useState(params.search);

  useEffect(() => {
    setSearchDraft(params.search);
  }, [params.search]);

  useEffect(() => {
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
      const [c, g] = await Promise.all([api.categories(), api.governorates()]);
      if (cancelled) return;
      setCats(c.results || []);
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
    async function loadListings() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.listings(
          {
            search: params.search,
            category: params.category,
            governorate: params.governorate,
            city: params.city,
            neighborhood: params.neighborhood,
            ordering: params.ordering,
            page: params.page,
          },
          { auth: isAuthenticated },
        );
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadListings();
    return () => {
      cancelled = true;
    };
  }, [params, isAuthenticated, reloadNonce]);

  const results = data?.results || [];
  const count = data?.count ?? 0;

  const hasActiveFilters = !!(
    params.search ||
    params.category ||
    params.governorate ||
    params.city ||
    params.neighborhood ||
    params.ordering
  );

  function clearFilters() {
    const next = new URLSearchParams(sp);
    next.delete('search');
    next.delete('category');
    next.delete('governorate');
    next.delete('city');
    next.delete('neighborhood');
    next.delete('ordering');
    next.set('page', '1');
    setSp(next);
  }

  function setParam(key, value) {
    const next = new URLSearchParams(sp);
    if (!value) next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.set('page', '1');
    setSp(next);
  }

  function goPage(p) {
    const next = new URLSearchParams(sp);
    next.set('page', String(p));
    setSp(next);
  }

  function saveCurrentSearch() {
    const next = new URLSearchParams(sp);
    next.delete('page');
    const queryString = next.toString();
    const name = describeListingSearch({
      search: params.search,
      category: params.category,
      governorate: params.governorate,
      city: params.city,
      neighborhood: params.neighborhood,
      ordering: params.ordering,
    });
    addSavedSearch({ name, queryString });
    toast.push({ title: t('saved_searches_title'), description: t('saved_search_saved') });
  }

  return (
    <Flex direction="column" gap="5">
      {!loading && recentlyViewed.length ? (
        <Card>
          <CardHeader>
            <Heading size="3">{t('recently_viewed')}</Heading>
          </CardHeader>
          <CardBody>
            <Grid gap="3" columns={{ initial: '1', sm: '2', md: '3' }}>
              {recentlyViewed.map((rv) => (
                <RTLink key={rv.id} asChild underline="none" highContrast>
                  <Link to={`/listings/${rv.id}`}>
                    <Card className="transition-colors hover:bg-[var(--gray-a2)]">
                      <Box p="4">
                        <Flex justify="between" gap="3" align="start">
                          <Flex gap="3" align="start" style={{ minWidth: 0, flex: 1 }}>
                            {rv.thumbnail ? (
                              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-[var(--gray-a5)] bg-[var(--color-panel-solid)]">
                                <img src={rv.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                              </div>
                            ) : null}
                            <Flex direction="column" gap="1" style={{ minWidth: 0 }}>
                              <Text weight="bold" size="2" style={{ wordBreak: 'break-word' }}>
                                {rv.title || t('listing_number', { id: rv.id })}
                              </Text>
                              {rv.price != null ? (
                                <Text size="1" color="gray">
                                  {formatMoney(rv.price, rv.currency)}
                                </Text>
                              ) : null}
                            </Flex>
                          </Flex>
                          <FavoriteButton listingId={rv.id} />
                        </Flex>
                      </Box>
                    </Card>
                  </Link>
                </RTLink>
              ))}
            </Grid>
          </CardBody>
        </Card>
      ) : null}

      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading size="5">{t('listings_title')}</Heading>
        <Flex align="center" gap="3" wrap="wrap">
          <Text size="2" color="gray">{count} {t('listings_total')}</Text>
          {hasActiveFilters ? (
            <Button size="sm" variant="secondary" onClick={clearFilters}>
              {t('clear_filters')}
            </Button>
          ) : null}
          {hasActiveFilters ? (
            <Button size="sm" variant="secondary" onClick={saveCurrentSearch}>
              {t('save_search')}
            </Button>
          ) : null}
          {isAuthenticated ? (
            <RTLink asChild underline="none">
              <Link to="/create">
                <Button>
                  <Flex align="center" gap="2">
                    <Icon icon={PlusCircle} size={16} />
                    <Text as="span" size="2">
                      {t('nav_create')}
                    </Text>
                  </Flex>
                </Button>
              </Link>
            </RTLink>
          ) : null}
        </Flex>
      </Flex>

      <Card>
        <CardHeader>
          <Grid gap="4" columns={{ initial: '1', md: '5' }}>
            <Box style={{ gridColumn: 'span 2 / span 2' }}>
              <Input
                value={searchDraft}
                placeholder={t('listings_search_placeholder')}
                onChange={(e) => setSearchDraft(e.target.value)}
              />
            </Box>

            <Select value={params.ordering} onChange={(e) => setParam('ordering', e.target.value)}>
              <option value="">{t('listings_sort')}</option>
              <option value="-created_at">{t('sort_newest')}</option>
              <option value="created_at">{t('sort_oldest')}</option>
              <option value="price">{t('sort_price_low')}</option>
              <option value="-price">{t('sort_price_high')}</option>
            </Select>

            <Select
              value={params.category}
              onChange={(e) => setParam('category', e.target.value)}
            >
              <option value="">{t('listings_category')}</option>
              {cats.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name_ar || c.name_en}
                </option>
              ))}
            </Select>

            <Select
              value={params.governorate}
              onChange={(e) => {
                setParam('governorate', e.target.value);
                setParam('city', '');
                setParam('neighborhood', '');
              }}
            >
              <option value="">{t('listings_governorate')}</option>
              {govs.map((g) => (
                <option key={g.id} value={String(g.id)}>
                  {g.name_ar || g.name_en}
                </option>
              ))}
            </Select>

            <Select
              value={params.city}
              onChange={(e) => {
                setParam('city', e.target.value);
                setParam('neighborhood', '');
              }}
              disabled={!params.governorate}
            >
              <option value="">{t('listings_city')}</option>
              {cities.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name_ar || c.name_en}
                </option>
              ))}
            </Select>

            <Select
              value={params.neighborhood}
              onChange={(e) => setParam('neighborhood', e.target.value)}
              disabled={!params.city}
            >
              <option value="">{t('listings_neighborhood')}</option>
              {neighborhoods.map((n) => (
                <option key={n.id} value={String(n.id)}>
                  {n.name_ar || n.name_en}
                </option>
              ))}
            </Select>
          </Grid>
        </CardHeader>

        <CardBody>
          <Flex direction="column" gap="4">
            <InlineError error={error instanceof ApiError ? error : error} onRetry={() => setReloadNonce((n) => n + 1)} />

            {loading ? (
              <Flex direction="column" gap="3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}>
                    <Box p={{ initial: '5', sm: '6' }}>
                      <Flex justify="between" gap="4" align="start" wrap="wrap">
                        <Flex gap="3" align="start" style={{ minWidth: 0, flex: 1 }}>
                          <Skeleton className="h-16 w-16 shrink-0 sm:h-20 sm:w-20" />
                          <Flex direction="column" gap="2" style={{ minWidth: 0, flex: 1 }}>
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-3 w-56" />
                          </Flex>
                        </Flex>
                        <Flex direction="column" gap="2" align="end">
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-6 w-24 rounded-full" />
                        </Flex>
                      </Flex>
                    </Box>
                  </Card>
                ))}
              </Flex>
            ) : (
              <Flex direction="column" gap="5">
                {results.map((r) => (
              <RTLink key={r.id} asChild underline="none" highContrast>
                <Link to={`/listings/${r.id}`}>
                  <Card className="transition-colors hover:bg-[var(--gray-a2)]">
                    <Box p={{ initial: '5', sm: '6' }}>
                      <Flex justify="between" gap="4" align="start" wrap="wrap">
                        <Flex gap="3" align="start" style={{ minWidth: 0, flex: 1 }}>
                          {r.thumbnail ? (
                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-[var(--gray-a5)] bg-[var(--color-panel-solid)] sm:h-20 sm:w-20">
                              <img src={r.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                            </div>
                          ) : null}

                          <Flex direction="column" gap="2" style={{ minWidth: 0 }}>
                            <Text weight="bold" size="3" style={{ wordBreak: 'break-word' }}>
                              {r.title}
                            </Text>
                            <Text size="2">{formatMoney(r.price, r.currency)}</Text>
                            <Flex align="center" gap="2" wrap="wrap">
                              <Icon icon={MapPin} size={14} className="text-[var(--gray-11)]" aria-label="" />
                              <Text size="1" color="gray">
                                {r.governorate?.name_ar || r.governorate?.name_en} · {r.city?.name_ar || r.city?.name_en}
                                {r.neighborhood ? ` · ${r.neighborhood?.name_ar || r.neighborhood?.name_en}` : ''}
                              </Text>
                            </Flex>
                          </Flex>
                        </Flex>

                        <Flex direction="column" gap="2" align="end">
                          <FavoriteButton listingId={r.id} />
                          <Flex align="center" gap="2">
                            <Icon icon={Clock} size={14} className="text-[var(--gray-11)]" aria-label="" />
                            <Text size="1" color="gray">
                              {formatDate(r.created_at)}
                            </Text>
                          </Flex>
                          {r.moderation_status ? (
                            <Badge variant={moderationBadgeVariant(r.moderation_status)}>{moderationLabel(r.moderation_status)}</Badge>
                          ) : null}
                        </Flex>
                      </Flex>
                    </Box>
                  </Card>
                </Link>
              </RTLink>
                ))}
                {!loading && results.length === 0 ? (
                  <EmptyState icon={SearchX}>{t('listings_none')}</EmptyState>
                ) : null}
              </Flex>
            )}

          <Flex mt="1" align="center" justify="between" gap="3">
            <Button
              variant="secondary"
              disabled={Number(params.page) <= 1}
              onClick={() => goPage(Math.max(1, Number(params.page) - 1))}
            >
              <Flex align="center" gap="2">
                <Icon icon={dir === 'rtl' ? ChevronRight : ChevronLeft} size={16} />
                <Text as="span" size="2">
                  {t('prev')}
                </Text>
              </Flex>
            </Button>
            <Text size="2" color="gray">
              {t('page')} {params.page}
            </Text>
            <Button
              variant="secondary"
              disabled={!data?.next}
              onClick={() => goPage(Number(params.page) + 1)}
            >
              <Flex align="center" gap="2">
                <Text as="span" size="2">
                  {t('next')}
                </Text>
                <Icon icon={dir === 'rtl' ? ChevronLeft : ChevronRight} size={16} />
              </Flex>
            </Button>
          </Flex>
          </Flex>
        </CardBody>
      </Card>
    </Flex>
  );
}
