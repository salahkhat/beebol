import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Box, Flex, Grid, Heading, Link as RTLink, Text } from '@radix-ui/themes';
import { ArrowUpDown, BookmarkPlus, ChevronLeft, ChevronRight, Clock, Eye, EyeOff, FilterX, MapPin, PlusCircle, Search, SearchX, Shapes } from 'lucide-react';
import { Map } from 'lucide-react';
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
import { Dialog } from '../ui/Dialog';
import { ListingThumbnail } from '../ui/ListingThumbnail';
import { formatAttributeValue, getAttributeChoiceLabel } from '../lib/attributeFormat';
import { CategoryCascadeSelect } from '../components/CategoryCascadeSelect';
import { formatMoney } from '../lib/format';
import { getRecentlyViewed, onRecentlyViewedChange } from '../lib/recentlyViewed';
import { formatDate } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/i18n';
import { useToast } from '../ui/Toast';
import { addSavedSearch, describeListingSearch } from '../lib/savedSearches';
import { addWatch, listWatchlist, removeWatch } from '../lib/watchlist';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import { useListingFilters } from '../lib/useListingFilters';
import { ListingsFiltersSidebar } from '../components/ListingsFiltersSidebar';

function moderationBadgeVariant(m) {
  if (m === 'approved') return 'ok';
  if (m === 'pending') return 'warn';
  if (m === 'rejected') return 'danger';
  return 'default';
}

export function ListingsPage() {
  const { isAuthenticated } = useAuth();
  const { t, dir, locale } = useI18n();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();

  const filtersWrapClass = 'bb-filters';
  const filterSectionClass = 'bb-filter-section';
  const filterControlClass = 'bb-filter-control';

  const [imagePreview, setImagePreview] = useState({ open: false, src: '', title: '' });

  function openImagePreview({ src, title }, e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!src) return;
    setImagePreview({ open: true, src: normalizeMediaUrl(src), title: title || '' });
  }

  const [watchedIds, setWatchedIds] = useState(() => new Set(listWatchlist().map((x) => x.id)));

  function toggleWatchCard(listing, e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!listing?.id) return;
    const id = Number(listing.id);
    if (watchedIds.has(id)) {
      removeWatch(id);
      setWatchedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    addWatch(id, { lastPrice: listing.price, lastCurrency: listing.currency });
    setWatchedIds((prev) => new Set(prev).add(id));
  }

  function moderationLabel(code) {
    if (!code) return '';
    const key = `moderation_status_${code}`;
    const translated = t(key);
    return translated === key ? String(code) : translated;
  }

  const {
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
  } = useListingFilters({ sp, setSp, locale });

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [recentlyViewed, setRecentlyViewed] = useState(() => getRecentlyViewed());

  useEffect(() => {
    setRecentlyViewed(getRecentlyViewed());
    return onRecentlyViewedChange(() => setRecentlyViewed(getRecentlyViewed()));
  }, []);

  const listingsLayoutClass =
    dir === 'rtl'
      ? 'grid gap-4 md:gap-6 md:grid-cols-[minmax(0,1fr)_380px] md:items-start'
      : 'grid gap-4 md:gap-6 md:grid-cols-[380px_minmax(0,1fr)] md:items-start';

  useEffect(() => {
    let cancelled = false;
    async function loadListings() {
      setLoading(true);
      setError(null);
      try {
        const attr = {};
        for (const [k, v] of sp.entries()) {
          if (!String(k).startsWith('attr_')) continue;
          if (v == null || String(v) === '') continue;
          attr[k] = String(v);
        }

        const res = await api.listings(
          {
            search: params.search,
            category: params.category,
            governorate: params.governorate,
            city: params.city,
            neighborhood: params.neighborhood,
            price_min: params.price_min,
            price_max: params.price_max,
            ordering: params.ordering,
            page: params.page,
            ...attr,
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
  }, [params, sp, isAuthenticated, reloadNonce]);

  const results = data?.results || [];
  const count = data?.count ?? 0;

  const hasActiveFilters = !!(
    params.search ||
    params.category ||
    params.governorate ||
    params.city ||
    params.neighborhood ||
    params.price_min ||
    params.price_max ||
    params.ordering ||
    hasAttrFilters
  );

  // clearFilters, setParam, attrLabel now come from useListingFilters

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
    <Flex direction="column" gap="4">
      <Dialog
        open={imagePreview.open}
        onOpenChange={(open) => setImagePreview((p) => ({ ...p, open }))}
        title={imagePreview.title || t('image_preview')}
        maxWidth="900px"
      >
        {imagePreview.src ? (
          <div className="overflow-hidden rounded-md border border-[var(--gray-a5)] bg-[var(--color-panel-solid)]">
            <img
              src={normalizeMediaUrl(imagePreview.src)}
              alt={imagePreview.title || ''}
              className="max-h-[70vh] w-full object-contain"
            />
          </div>
        ) : null}
      </Dialog>

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
                            <ListingThumbnail
                              src={rv.thumbnail}
                              alt={rv.title || ''}
                              className="h-14 w-14 sm:h-16 sm:w-16"
                              placeholder={t('detail_noImages')}
                              ariaLabel={rv.thumbnail ? t('open_image_preview') : t('detail_noImages')}
                              onClick={
                                rv.thumbnail
                                  ? (e) =>
                                      openImagePreview(
                                        { src: rv.thumbnail, title: rv.title || t('listing_number', { id: rv.id }) },
                                        e,
                                      )
                                  : undefined
                              }
                            />
                            <Flex direction="column" gap="1" style={{ minWidth: 0 }}>
                              <Text weight="bold" size="2" className="break-words whitespace-normal">
                                {rv.title || t('listing_number', { id: rv.id })}
                              </Text>
                              {rv.price != null ? (
                                <Text size="1" color="gray">
                                  {Number(rv.price) === 0 ? t('price_free') : formatMoney(rv.price, rv.currency)}
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
          <RTLink asChild underline="none">
            <Link to={sp.toString() ? `/map?${sp.toString()}` : '/map'}>
              <Button size="sm" variant="secondary">
                <Flex align="center" gap="2">
                  <Icon icon={Map} size={16} />
                  <Text as="span" size="2">
                    {t('nav_map')}
                  </Text>
                </Flex>
              </Button>
            </Link>
          </RTLink>
          {hasActiveFilters ? (
            <Button size="sm" variant="secondary" onClick={clearFilters}>
              <Flex align="center" gap="2">
                <Icon icon={FilterX} size={16} />
                <Text as="span" size="2">
                  {t('clear_filters')}
                </Text>
              </Flex>
            </Button>
          ) : null}
          {hasActiveFilters ? (
            <Button size="sm" variant="secondary" onClick={saveCurrentSearch}>
              <Flex align="center" gap="2">
                <Icon icon={BookmarkPlus} size={16} />
                <Text as="span" size="2">
                  {t('save_search')}
                </Text>
              </Flex>
            </Button>
          ) : null}
          <Box style={{  }}>
            <Select
              value={params.ordering}
              onChange={(e) => setParam('ordering', e.target.value)}
            >
              <option value="">{t('listings_sort')}</option>
              <option value="-created_at">{t('sort_newest')}</option>
              <option value="created_at">{t('sort_oldest')}</option>
              <option value="price">{t('sort_price_low')}</option>
              <option value="-price">{t('sort_price_high')}</option>
            </Select>
          </Box>
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

      <div className={listingsLayoutClass}>
        <div className={dir === 'rtl' ? 'order-1 md:order-2' : 'order-1'}>
          <div className="self-start">
              <ListingsFiltersSidebar
                t={t}
                locale={locale}
                sp={sp}
                params={params}
                cats={cats}
                govs={govs}
                cities={cities}
                neighborhoods={neighborhoods}
                uniqueAttrDefs={uniqueAttrDefs}
                attrLabel={attrLabel}
                searchDraft={searchDraft}
                setSearchDraft={setSearchDraft}
                setParam={setParam}
                classNames={{ filtersWrapClass, filterSectionClass, filterControlClass }}
              />
          </div>
        </div>

        <div className={dir === 'rtl' ? 'order-2 md:order-1' : 'order-2'}>
          <Card>
            <CardBody>
              <Flex direction="column" gap="4">
                <InlineError error={error instanceof ApiError ? error : error} onRetry={() => setReloadNonce((n) => n + 1)} />

            {loading ? (
              <Flex direction="column" gap="3" className="bb-stagger">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}>
                    <Box p={{ initial: '2', sm: '3' }}>
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
              <Flex direction="column" gap="4" className="bb-stagger">
                {results.map((r) => (
              <RTLink key={r.id} asChild underline="none" highContrast>
                <Link to={`/listings/${r.id}`}>
                  <Card className="transition-colors hover:bg-[var(--gray-a2)]">
                    <Box p={{ initial: '2', sm: '3' }}>
                      <Flex
                        justify="between"
                        gap="4"
                        align="start"
                        wrap="wrap"
                        className="flex-col sm:flex-row"
                      >
                        <Flex gap="3" align="start" style={{ minWidth: 0, flex: 1 }} className="w-full sm:w-auto">
                          <ListingThumbnail
                            src={r.thumbnail}
                            alt={r.title || ''}
                            className="h-24 w-24 rounded-lg border-[var(--gray-a6)] sm:h-28 sm:w-28"
                            placeholder={t('detail_noImages')}
                            ariaLabel={r.thumbnail ? t('open_image_preview') : t('detail_noImages')}
                            onClick={r.thumbnail ? (e) => openImagePreview({ src: r.thumbnail, title: r.title }, e) : undefined}
                          />

                          <Flex direction="column" gap="2" style={{ minWidth: 0 }} className="flex-1">
                            <Text weight="bold" size="3" className="break-words whitespace-normal">
                              {r.title}
                            </Text>
                            <Text size="2">{Number(r.price) === 0 ? t('price_free') : formatMoney(r.price, r.currency)}</Text>
                            <Flex align="center" gap="2" wrap="wrap">
                              <Icon icon={MapPin} size={14} className="text-[var(--gray-11)]" aria-label="" />
                              <Text size="1" color="gray" className="break-words whitespace-normal">
                                {r.governorate?.name_ar || r.governorate?.name_en} · {r.city?.name_ar || r.city?.name_en}
                                {r.neighborhood ? ` · ${r.neighborhood?.name_ar || r.neighborhood?.name_en}` : ''}
                              </Text>
                            </Flex>
                          </Flex>
                        </Flex>

                        <Flex
                          direction="column"
                          gap="2"
                          align="end"
                          className="w-full sm:w-auto mt-3 sm:mt-0"
                        >
                          <Flex align="center" gap="2" justify="end">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="px-2"
                              onClick={(e) => toggleWatchCard(r, e)}
                              title={watchedIds.has(Number(r.id)) ? t('watch_remove') : t('watch_add')}
                              aria-label={watchedIds.has(Number(r.id)) ? t('watch_remove') : t('watch_add')}
                            >
                              <Icon icon={watchedIds.has(Number(r.id)) ? EyeOff : Eye} size={16} />
                            </Button>
                            <FavoriteButton listingId={r.id} />
                          </Flex>
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
        </div>
      </div>
    </Flex>
  );
}
