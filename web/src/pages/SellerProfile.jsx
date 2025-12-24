import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Box, Flex, Heading, Link as RTLink, Text } from '@radix-ui/themes';
import { ArrowLeft, ArrowRight, Clock, MapPin, User } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { InlineError } from '../ui/InlineError';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { formatDate, formatMoney } from '../lib/format';
import { useI18n } from '../i18n/i18n';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../ui/Toast';
import { followSeller, isFollowingSeller, unfollowSeller } from '../lib/following';
import { addWatch, listWatchlist, removeWatch } from '../lib/watchlist';

export function SellerProfilePage() {
  const { id } = useParams();
  const { t, dir } = useI18n();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();

  const page = sp.get('page') || '1';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const sellerId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!sellerId) {
        setData({ results: [], count: 0 });
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await api.listings({ seller: sellerId, page }, { auth: false });
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [sellerId, page, reloadNonce]);

  const results = data?.results || [];
  const count = data?.count ?? 0;

  const sellerName = results?.[0]?.seller_username || (sellerId ? t('user_number', { id: sellerId }) : '');

  const [followNonce, setFollowNonce] = useState(0);
  const isFollowing = useMemo(() => (sellerId ? isFollowingSeller(sellerId) : false), [sellerId, followNonce]);

  const [watchedIds, setWatchedIds] = useState(() => new Set(listWatchlist().map((x) => x.id)));
  useEffect(() => {
    setWatchedIds(new Set(listWatchlist().map((x) => x.id)));
  }, []);

  function toggleFollow() {
    if (!sellerId) return;
    if (isFollowing) {
      unfollowSeller(sellerId);
      toast.push({ title: t('following_title'), description: t('follow_removed') });
      setFollowNonce((n) => n + 1);
      return;
    }
    followSeller({ id: sellerId, username: sellerName });
    toast.push({ title: t('following_title'), description: t('follow_added') });
    setFollowNonce((n) => n + 1);
  }

  function toggleWatch(listing, e) {
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

  function goPage(p) {
    const next = new URLSearchParams(sp);
    next.set('page', String(p));
    setSp(next);
  }

  return (
    <Flex direction="column" gap="4">
      <RTLink asChild underline="none" highContrast>
        <Link to="/listings">
          <Flex align="center" gap="2">
            <Icon icon={dir === 'rtl' ? ArrowRight : ArrowLeft} size={16} className="text-[var(--gray-11)]" aria-label="" />
            <Text size="2" color="gray">
              {t('back')}
            </Text>
          </Flex>
        </Link>
      </RTLink>

      <Card>
        <CardHeader>
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <Flex direction="column" gap="1">
              <Heading size="5">{t('seller_profile_title')}</Heading>
              <Flex align="center" gap="2" wrap="wrap">
                <Icon icon={User} size={16} className="text-[var(--gray-11)]" aria-label="" />
                <Text size="2" color="gray">
                  {sellerName}
                </Text>
              </Flex>
            </Flex>
            <Flex align="center" gap="2" wrap="wrap">
              {isAuthenticated && sellerId ? (
                <Button size="sm" variant="secondary" onClick={toggleFollow}>
                  {isFollowing ? t('unfollow') : t('follow')}
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => setReloadNonce((n) => n + 1)} disabled={loading}>
                {t('refresh')}
              </Button>
            </Flex>
          </Flex>
        </CardHeader>
        <CardBody>
          <InlineError error={error instanceof ApiError ? error : error} onRetry={() => setReloadNonce((n) => n + 1)} />

          {loading ? (
            <Flex direction="column" gap="3" mt="3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <Box p={{ initial: '5', sm: '6' }}>
                    <Flex align="start" justify="between" gap="4" wrap="wrap">
                      <Flex direction="column" gap="2" style={{ minWidth: 0, flex: 1 }}>
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-56" />
                      </Flex>
                      <Skeleton className="h-8 w-20" />
                    </Flex>
                  </Box>
                </Card>
              ))}
            </Flex>
          ) : (
            <Flex direction="column" gap="3" mt="3">
              <Text size="2" color="gray">
                {t('seller_listings_count', { count })}
              </Text>

              {results.map((r) => (
                <Card key={r.id}>
                  <Box p={{ initial: '5', sm: '6' }}>
                    <Flex align="start" justify="between" gap="4" wrap="wrap">
                      <Flex direction="column" gap="2" style={{ minWidth: 0, flex: 1 }}>
                        <RTLink asChild underline="none" highContrast>
                          <Link to={`/listings/${r.id}`}>
                            <Text weight="bold" size="3" style={{ wordBreak: 'break-word' }}>
                              {r.title}
                            </Text>
                          </Link>
                        </RTLink>
                        <Text size="2">{formatMoney(r.price, r.currency)}</Text>
                        <Flex align="center" gap="2" wrap="wrap">
                          <Icon icon={MapPin} size={14} className="text-[var(--gray-11)]" aria-label="" />
                          <Text size="1" color="gray">
                            {r.city?.name_ar || r.city?.name_en}
                          </Text>
                          <Text size="1" color="gray">·</Text>
                          <Icon icon={Clock} size={14} className="text-[var(--gray-11)]" aria-label="" />
                          <Text size="1" color="gray">
                            {formatDate(r.created_at)}
                          </Text>
                        </Flex>
                      </Flex>
                      <Flex align="center" gap="2">
                        <Button size="sm" variant="secondary" onClick={(e) => toggleWatch(r, e)}>
                          {watchedIds.has(Number(r.id)) ? t('watch_remove') : t('watch_add')}
                        </Button>
                        <RTLink asChild underline="none" highContrast>
                          <Link to={`/listings/${r.id}`}>
                            <Button size="sm" variant="secondary">{t('view')}</Button>
                          </Link>
                        </RTLink>
                      </Flex>
                    </Flex>
                  </Box>
                </Card>
              ))}

              {!loading && results.length === 0 ? (
                <EmptyState icon={User}>{t('seller_no_listings')}</EmptyState>
              ) : null}

              {data?.next || data?.previous ? (
                <Flex align="center" justify="between" gap="2" mt="2" wrap="wrap">
                  <Button variant="secondary" disabled={!data?.previous} onClick={() => goPage(Math.max(1, Number(page) - 1))}>
                    {t('prev')}
                  </Button>
                  <Text size="2" color="gray">
                    {t('page')} {page}
                  </Text>
                  <Button variant="secondary" disabled={!data?.next} onClick={() => goPage(Number(page) + 1)}>
                    {t('next')}
                  </Button>
                </Flex>
              ) : null}
            </Flex>
          )}
        </CardBody>
      </Card>
    </Flex>
  );
}
