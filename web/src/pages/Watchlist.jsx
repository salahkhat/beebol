import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Flex, Grid, Heading, Text } from '@radix-ui/themes';
import { X } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { InlineError } from '../ui/InlineError';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { ListingThumbnail } from '../ui/ListingThumbnail';
import { formatDate, formatMoney } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/i18n';
import { listWatchlist, removeWatch, updateWatchSnapshotFromListing } from '../lib/watchlist';

function priceDeltaLabel({ prevPrice, prevCurrency, nextPrice, nextCurrency, t }) {
  if (prevPrice == null || nextPrice == null) return { kind: 'unknown', label: t('watch_price_unknown') };
  if (String(prevCurrency || '') !== String(nextCurrency || '')) return { kind: 'changed', label: t('watch_currency_changed') };
  const a = Number(prevPrice);
  const b = Number(nextPrice);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { kind: 'unknown', label: t('watch_price_unknown') };
  if (b > a) return { kind: 'up', label: t('watch_price_up') };
  if (b < a) return { kind: 'down', label: t('watch_price_down') };
  return { kind: 'same', label: t('watch_price_same') };
}

function deltaBadgeVariant(kind) {
  if (kind === 'down') return 'ok';
  if (kind === 'up') return 'warn';
  if (kind === 'changed') return 'warn';
  if (kind === 'unknown') return 'default';
  return 'default';
}

export function WatchlistPage() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const nav = useNavigate();

  const [watchItems, setWatchItems] = useState(() => listWatchlist());
  const ids = useMemo(() => watchItems.map((x) => x.id), [watchItems]);

  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    setWatchItems(listWatchlist());
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!ids.length) {
        setItems([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const results = await Promise.all(
          ids.map(async (id) => {
            try {
              const value = await api.listing(id, { auth: isAuthenticated });
              return { ok: true, id, value };
            } catch (e) {
              return { ok: false, id, error: e };
            }
          }),
        );
        if (cancelled) return;
        const ok = [];
        const failed = [];
        const staleIds = [];
        for (const r of results) {
          if (r.ok) ok.push(r.value);
          else {
            const err = r.error;
            // A watched listing can be deleted or become unavailable; auto-cleanup stale IDs.
            if (err instanceof ApiError && err.status === 404) {
              staleIds.push(r.id);
              continue;
            }
            failed.push(err);
          }
        }

        if (staleIds.length) {
          for (const id of staleIds) removeWatch(id);
          setWatchItems(listWatchlist());
        }

        setItems(ok);
        setError(failed.length ? failed[0] : null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [ids.join(','), isAuthenticated, reloadNonce]);

  function unwatch(id) {
    setWatchItems(removeWatch(id));
  }

  function markSeen(listing) {
    setWatchItems(updateWatchSnapshotFromListing(listing));
  }

  function goBackToListings() {
    nav('/listings');
  }

  const byId = useMemo(() => {
    const m = new Map();
    for (const w of watchItems) m.set(w.id, w);
    return m;
  }, [watchItems]);

  return (
    <Flex direction="column" gap="4">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading size="5">{t('watchlist_title')}</Heading>
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

      {!ids.length ? (
        <EmptyState
          title={t('watchlist_empty_title')}
          description={t('watchlist_empty_desc')}
          action={<Button onClick={goBackToListings}>{t('watchlist_empty_cta')}</Button>}
        />
      ) : loading ? (
        <Grid columns={{ initial: '1', md: '2', lg: '3' }} gap="3" className="bb-stagger">
          {Array.from({ length: Math.min(3, ids.length) }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardBody>
                <Flex direction="column" gap="2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                </Flex>
              </CardBody>
            </Card>
          ))}
        </Grid>
      ) : (
        <Grid columns={{ initial: '1', md: '2', lg: '3' }} gap="3" className="bb-stagger">
          {items.map((it) => {
            const prev = byId.get(it.id);
            const delta = priceDeltaLabel({
              prevPrice: prev?.lastPrice,
              prevCurrency: prev?.lastCurrency,
              nextPrice: it.price,
              nextCurrency: it.currency,
              t,
            });

            return (
              <Card key={it.id}>
                <CardHeader>
                  <Flex align="start" justify="between" gap="3">
                    <Flex gap="3" align="start" style={{ minWidth: 0, flex: 1 }}>
                      <ListingThumbnail
                        src={it.thumbnail}
                        alt=""
                        className="h-12 w-12"
                        placeholder={t('detail_noImages')}
                        ariaLabel={t('detail_noImages')}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Link to={`/listings/${it.id}`} style={{ textDecoration: 'none' }}>
                          <Text weight="bold" size="3" style={{ wordBreak: 'break-word' }}>
                            {it.title || t('listing_number', { id: it.id })}
                          </Text>
                        </Link>
                        {it.price != null ? <Text size="2" color="gray">{formatMoney(it.price, it.currency)}</Text> : null}
                        <Flex align="center" gap="2" wrap="wrap" className="mt-1">
                          <Text size="1" color="gray">{t('watch_price_change')}:</Text>
                          <Badge variant={deltaBadgeVariant(delta.kind)}>{delta.label}</Badge>
                        </Flex>
                      </div>
                    </Flex>
                    <Button size="sm" variant="secondary" onClick={() => unwatch(it.id)} title={t('remove')}>
                      <Icon icon={X} size={16} />
                    </Button>
                  </Flex>
                </CardHeader>
                <CardBody>
                  <Flex direction="column" gap="2">
                    <Text size="2">
                      <Text as="span" color="gray">{t('detail_created')}:</Text> {formatDate(it.created_at)}
                    </Text>
                    {prev?.lastSeenAt ? (
                      <Text size="2">
                        <Text as="span" color="gray">{t('watch_last_seen')}:</Text> {formatDate(prev.lastSeenAt)}
                      </Text>
                    ) : null}
                    <Flex align="center" gap="2" wrap="wrap" className="mt-1">
                      <Button size="sm" variant="secondary" onClick={() => markSeen(it)}>
                        {t('watch_mark_seen')}
                      </Button>
                      <Link to={`/listings/${it.id}`} style={{ textDecoration: 'none' }}>
                        <Button size="sm">{t('view')}</Button>
                      </Link>
                    </Flex>
                  </Flex>
                </CardBody>
              </Card>
            );
          })}
        </Grid>
      )}
    </Flex>
  );
}
