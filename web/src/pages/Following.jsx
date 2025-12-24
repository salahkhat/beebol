import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Box, Flex, Grid, Heading, Text } from '@radix-ui/themes';
import { api, ApiError } from '../lib/api';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { InlineError } from '../ui/InlineError';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { formatMoney } from '../lib/format';
import { useI18n } from '../i18n/i18n';
import { listFollowing, unfollowSeller } from '../lib/following';

export function FollowingPage() {
  const { t } = useI18n();
  const nav = useNavigate();

  const [following, setFollowing] = useState(() => listFollowing());
  const sellerIds = useMemo(() => following.map((x) => x.id), [following]);

  const [latestBySeller, setLatestBySeller] = useState(() => ({}));
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    setFollowing(listFollowing());
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!sellerIds.length) {
        setLatestBySeller({});
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const results = await Promise.allSettled(
          sellerIds.map((seller) => api.listings({ seller, page: 1 }, { auth: false }).then((r) => ({ seller, r }))),
        );

        if (cancelled) return;

        const next = {};
        const failed = [];
        for (const res of results) {
          if (res.status === 'fulfilled') {
            const items = res.value.r?.results || [];
            next[res.value.seller] = items.slice(0, 3);
          } else {
            failed.push(res.reason);
          }
        }

        setLatestBySeller(next);
        setError(failed.length ? failed[0] : null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sellerIds.join(','), reloadNonce]);

  function goBackToListings() {
    nav('/listings');
  }

  function unfollow(id) {
    setFollowing(unfollowSeller(id));
  }

  return (
    <Flex direction="column" gap="5">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading size="5">{t('following_title')}</Heading>
        <Flex align="center" gap="2" wrap="wrap">
          <Button variant="secondary" onClick={() => setReloadNonce((n) => n + 1)} disabled={loading}>
            {t('refresh')}
          </Button>
          <Link to="/listings" style={{ textDecoration: 'none' }}>
            <Button variant="secondary">{t('nav_listings')}</Button>
          </Link>
        </Flex>
      </Flex>

      <InlineError error={error instanceof ApiError ? error : error} />

      {!sellerIds.length ? (
        <EmptyState
          title={t('following_empty_title')}
          description={t('following_empty_desc')}
          action={<Button onClick={goBackToListings}>{t('following_empty_cta')}</Button>}
        />
      ) : loading ? (
        <Flex direction="column" gap="3">
          {Array.from({ length: Math.min(3, sellerIds.length) }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
              </CardHeader>
              <CardBody>
                <Flex direction="column" gap="2">
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </Flex>
              </CardBody>
            </Card>
          ))}
        </Flex>
      ) : (
        <Flex direction="column" gap="3">
          {following.map((s) => {
            const latest = latestBySeller[s.id] || [];
            const sellerLabel = s.username || t('user_number', { id: s.id });
            return (
              <Card key={s.id}>
                <CardHeader>
                  <Flex align="center" justify="between" gap="3" wrap="wrap">
                    <Link to={`/sellers/${s.id}`} className="hover:underline">
                      <Text weight="bold" size="3">{sellerLabel}</Text>
                    </Link>
                    <Flex align="center" gap="2" wrap="wrap">
                      <Link to={`/sellers/${s.id}`} style={{ textDecoration: 'none' }}>
                        <Button size="sm" variant="secondary">{t('view')}</Button>
                      </Link>
                      <Button size="sm" variant="secondary" onClick={() => unfollow(s.id)}>
                        {t('unfollow')}
                      </Button>
                    </Flex>
                  </Flex>
                </CardHeader>
                <CardBody>
                  {latest.length ? (
                    <Grid columns={{ initial: '1', md: '3' }} gap="3">
                      {latest.map((it) => (
                        <Link key={it.id} to={`/listings/${it.id}`} style={{ textDecoration: 'none' }}>
                          <Box className="rounded-lg border border-[var(--gray-a5)] bg-[var(--color-panel-solid)] p-3 transition-colors hover:bg-[var(--gray-a2)]">
                            <Flex gap="3" align="start">
                              {it.thumbnail ? (
                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-[var(--gray-a5)] bg-[var(--color-panel-solid)]">
                                  <img src={it.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                                </div>
                              ) : null}
                              <div style={{ minWidth: 0 }}>
                                <Text weight="bold" size="2" style={{ wordBreak: 'break-word' }}>
                                  {it.title || t('listing_number', { id: it.id })}
                                </Text>
                                {it.price != null ? (
                                  <Text size="1" color="gray">{formatMoney(it.price, it.currency)}</Text>
                                ) : null}
                              </div>
                            </Flex>
                          </Box>
                        </Link>
                      ))}
                    </Grid>
                  ) : (
                    <Text size="2" color="gray">{t('listings_none')}</Text>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </Flex>
      )}
    </Flex>
  );
}
