import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Flex, Grid, Heading, Text } from '@radix-ui/themes';
import { X } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { InlineError } from '../ui/InlineError';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { formatDate, formatMoney } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/i18n';
import { formatIdsParam, getCompareIds, parseIdsParam, removeCompareId, setCompareIds } from '../lib/compare';

export function CompareListingsPage() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();

  const ids = useMemo(() => {
    const fromUrl = parseIdsParam(sp.get('ids'));
    if (fromUrl.length) return fromUrl;
    return getCompareIds();
  }, [sp]);

  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Keep URL shareable if we loaded from storage.
    if (!ids.length) return;
    const urlIds = parseIdsParam(sp.get('ids'));
    if (urlIds.length) return;
    const next = new URLSearchParams(sp);
    next.set('ids', formatIdsParam(ids));
    setSp(next, { replace: true });
  }, [ids]);

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
        const results = await Promise.allSettled(ids.map((id) => api.listing(id, { auth: isAuthenticated })));
        if (cancelled) return;
        const ok = [];
        const failed = [];
        for (const r of results) {
          if (r.status === 'fulfilled') ok.push(r.value);
          else failed.push(r.reason);
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
  }, [ids.join(','), isAuthenticated]);

  function syncIds(nextIds) {
    const normalized = setCompareIds(nextIds);
    const next = new URLSearchParams(sp);
    if (normalized.length) next.set('ids', formatIdsParam(normalized));
    else next.delete('ids');
    setSp(next, { replace: true });
    if (!normalized.length) nav('/compare', { replace: true });
  }

  function remove(id) {
    const nextStored = removeCompareId(id);
    syncIds(nextStored);
  }

  return (
    <Flex direction="column" gap="4">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading size="5">{t('compare_title')}</Heading>
        <Flex align="center" gap="2" wrap="wrap">
          <Link to="/listings" style={{ textDecoration: 'none' }}>
            <Button variant="secondary">{t('nav_listings')}</Button>
          </Link>
        </Flex>
      </Flex>

      <InlineError error={error instanceof ApiError ? error : error} />

      {!ids.length ? (
        <EmptyState
          title={t('compare_empty_title')}
          description={t('compare_empty_desc')}
          action={
            <Link to="/listings" style={{ textDecoration: 'none' }}>
              <Button>{t('compare_empty_cta')}</Button>
            </Link>
          }
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
          {items.map((it) => (
            <Card key={it.id}>
              <CardHeader>
                <Flex align="start" justify="between" gap="2">
                  <div style={{ minWidth: 0 }}>
                    <Link to={`/listings/${it.id}`} style={{ textDecoration: 'none' }}>
                      <Text weight="bold" size="3" style={{ wordBreak: 'break-word' }}>{it.title || t('listing_number', { id: it.id })}</Text>
                    </Link>
                    {it.price != null ? (
                      <Text size="2" color="gray">{formatMoney(it.price, it.currency)}</Text>
                    ) : null}
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => remove(it.id)} title={t('remove')}>
                    <Icon icon={X} size={16} />
                  </Button>
                </Flex>
              </CardHeader>
              <CardBody>
                <Flex direction="column" gap="2">
                  <Text size="2"><Text as="span" color="gray">{t('detail_seller')}:</Text> {it.seller_username || it.seller_id}</Text>
                  <Text size="2"><Text as="span" color="gray">{t('detail_location')}:</Text> {it.governorate?.name_ar || it.governorate?.name_en} · {it.city?.name_ar || it.city?.name_en}</Text>
                  <Text size="2"><Text as="span" color="gray">{t('detail_created')}:</Text> {formatDate(it.created_at)}</Text>
                  <Text size="2"><Text as="span" color="gray">{t('detail_status')}:</Text> {it.status || '-'}</Text>
                </Flex>
              </CardBody>
            </Card>
          ))}
        </Grid>
      )}
    </Flex>
  );
}
