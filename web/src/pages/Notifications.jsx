import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flex, Heading, Text } from '@radix-ui/themes';

import { api, ApiError } from '../lib/api';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { InlineError } from '../ui/InlineError';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { formatDate } from '../lib/format';
import { useI18n } from '../i18n/i18n';

function notificationLink(n) {
  const payload = n?.payload || {};
  if (n?.kind === 'private_message' && payload.thread_id) {
    return { to: `/threads/${payload.thread_id}`, labelKey: 'notifications_open_thread' };
  }
  if (n?.kind === 'question_answered' && payload.listing_id) {
    return { to: `/listings/${payload.listing_id}`, labelKey: 'notifications_open_listing' };
  }
  if (n?.kind === 'listing_status' && payload.listing_id) {
    return { to: `/listings/${payload.listing_id}`, labelKey: 'notifications_open_listing' };
  }
  return null;
}

export function NotificationsPage() {
  const { t } = useI18n();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.notifications();
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
  }, [reloadNonce]);

  const results = useMemo(() => data?.results || [], [data]);

  async function markRead(id) {
    try {
      const updated = await api.markNotificationRead(id);
      setData((prev) => {
        const prevResults = prev?.results || [];
        const nextResults = prevResults.map((n) => (n.id === id ? updated : n));
        return { ...(prev || {}), results: nextResults };
      });
    } catch (e) {
      setError(e);
    }
  }

  function titleFor(n) {
    if (!n) return '';
    if (n.title) return String(n.title);
    if (n.kind === 'private_message') return t('notifications_kind_private_message');
    if (n.kind === 'question_answered') return t('notifications_kind_question_answered');
    if (n.kind === 'listing_status') return t('notifications_kind_listing_status');
    return t('notifications_kind_generic');
  }

  return (
    <Flex direction="column" gap="4">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading size="5">{t('notifications_title')}</Heading>
        <Flex align="center" gap="2" wrap="wrap">
          <Button variant="secondary" size="sm" onClick={() => setReloadNonce((n) => n + 1)} disabled={loading}>
            {t('refresh')}
          </Button>
          <Link to="/listings" style={{ textDecoration: 'none' }}>
            <Button variant="secondary">{t('nav_listings')}</Button>
          </Link>
        </Flex>
      </Flex>

      <Card>
        <CardHeader>
          <Text size="2" color="gray">
            {t('notifications_subtitle')}
          </Text>
        </CardHeader>
        <CardBody>
          <InlineError error={error instanceof ApiError ? error : error} onRetry={() => setReloadNonce((n) => n + 1)} />

          {loading ? (
            <Flex direction="column" gap="3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </Flex>
          ) : results.length ? (
            <Flex direction="column" gap="3">
              {results.map((n) => {
                const link = notificationLink(n);
                const isRead = Boolean(n.is_read || n.read_at);
                return (
                  <div
                    key={n.id}
                    className="rounded-lg border border-[var(--gray-a5)] bg-[var(--color-panel-solid)] p-2"
                  >
                    <Flex align="start" justify="between" gap="3" wrap="wrap">
                      <div style={{ minWidth: 0 }}>
                        <Text weight="bold" size="2" style={{ wordBreak: 'break-word' }}>
                          {titleFor(n)}
                          {!isRead ? ` · ${t('notifications_unread')}` : ''}
                        </Text>
                        <Text size="2" color="gray">
                          {n.created_at ? formatDate(n.created_at) : ''}
                        </Text>
                        {n.body ? (
                          <Text size="2" className="mt-2" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {n.body}
                          </Text>
                        ) : null}
                        {link ? (
                          <div className="mt-2">
                            <Link to={link.to} className="hover:underline">
                              {t(link.labelKey)}
                            </Link>
                          </div>
                        ) : null}
                      </div>
                      <Flex align="center" gap="2" wrap="wrap">
                        {!isRead ? (
                          <Button size="sm" variant="secondary" onClick={() => markRead(n.id)}>
                            {t('notifications_mark_read')}
                          </Button>
                        ) : null}
                      </Flex>
                    </Flex>
                  </div>
                );
              })}
            </Flex>
          ) : (
            <EmptyState title={t('notifications_empty_title')} description={t('notifications_empty_description')} />
          )}
        </CardBody>
      </Card>
    </Flex>
  );
}
