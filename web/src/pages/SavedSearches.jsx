import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Flex, Heading, Text } from '@radix-ui/themes';
import { Bell, BellOff, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { EmptyState } from '../ui/EmptyState';
import { InlineError } from '../ui/InlineError';
import { useI18n } from '../i18n/i18n';
import { formatDate } from '../lib/format';
import { getAccessToken } from '../lib/authStorage';
import { listSavedSearches, markSavedSearchChecked, removeSavedSearch, savedSearchParams, toggleSavedSearchNotify } from '../lib/savedSearches';

export function SavedSearchesPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const isAuthenticated = !!getAccessToken();
  const [items, setItems] = useState(() => (isAuthenticated ? [] : listSavedSearches()));
  const [checkingId, setCheckingId] = useState(null);
  const [checkError, setCheckError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isAuthenticated) {
        setItems(listSavedSearches());
        return;
      }
      try {
        const res = await api.savedSearches();
        if (cancelled) return;
        const arr = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
        setItems(
          arr.map((x) => ({
            id: String(x.id),
            name: String(x.name || '').trim() || 'Saved search',
            queryString: String(x.querystring || '').replace(/^\?/, ''),
            createdAt: String(x.created_at || ''),
            notifyEnabled: !!x.notify_enabled,
            lastCheckedAt: String(x.last_checked_at || ''),
            lastCount: typeof x.last_result_count === 'number' ? x.last_result_count : x.last_result_count == null ? null : Number(x.last_result_count),
            lastDelta: null,
          }))
        );
      } catch (e) {
        if (!cancelled) setCheckError(e);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const hasAny = items.length > 0;

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }, [items]);

  async function checkNow(search) {
    if (!search?.id) return;
    setCheckingId(search.id);
    setCheckError(null);
    try {
      if (isAuthenticated) {
        const prevCount = search.lastCount;
        const updated = await api.checkSavedSearch(search.id);
        const nextCount = updated?.last_result_count ?? null;
        const delta =
          typeof prevCount === 'number' && typeof nextCount === 'number' ? Math.max(0, nextCount - prevCount) : null;

        setItems((prev) =>
          prev.map((s) =>
            String(s.id) === String(search.id)
              ? {
                  ...s,
                  lastCheckedAt: String(updated?.last_checked_at || ''),
                  lastCount: typeof nextCount === 'number' ? nextCount : null,
                  lastDelta: typeof delta === 'number' ? delta : null,
                }
              : s
          )
        );
      } else {
        const params = savedSearchParams(search.queryString);
        const res = await api.listings(params, { auth: false });
        const c = res?.count ?? 0;
        setItems(markSavedSearchChecked(search.id, c, search.lastCount));
      }
    } catch (e) {
      setCheckError(e);
    } finally {
      setCheckingId(null);
    }
  }

  function openSearch(queryString) {
    const qs = String(queryString || '').replace(/^\?/, '');
    navigate(`/listings${qs ? `?${qs}` : ''}`);
  }

  return (
    <Flex direction="column" gap="4">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading size="5">{t('saved_searches_title')}</Heading>
        <Link to="/listings" style={{ textDecoration: 'none' }}>
          <Button variant="secondary">{t('nav_listings')}</Button>
        </Link>
      </Flex>

      {!hasAny ? (
        <EmptyState
          title={t('saved_searches_empty_title')}
          description={t('saved_searches_empty_desc')}
          action={
            <Link to="/listings" style={{ textDecoration: 'none' }}>
              <Button>{t('saved_searches_empty_cta')}</Button>
            </Link>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <Text size="2" color="gray">
              {t('saved_searches_count', { count: sorted.length })}
            </Text>
          </CardHeader>
          <CardBody>
            <InlineError error={checkError instanceof ApiError ? checkError : checkError} />
            <Flex direction="column" gap="3" className="bb-stagger">
              {sorted.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-[var(--gray-a5)] bg-[var(--color-panel-solid)] p-2 transition-colors hover:bg-[var(--gray-a2)]"
                >
                  <Flex align="start" justify="between" gap="3" wrap="wrap">
                    <div style={{ minWidth: 0 }}>
                      <Text weight="bold" size="2" style={{ wordBreak: 'break-word' }}>
                        {s.name}
                      </Text>
                      {s.queryString ? (
                        <Text size="1" color="gray" style={{ wordBreak: 'break-word' }}>
                          ?{s.queryString}
                        </Text>
                      ) : null}
                      <Flex align="center" gap="2" wrap="wrap" className="mt-2">
                        <Badge variant={s.notifyEnabled ? 'ok' : 'default'}>
                          {s.notifyEnabled ? t('saved_search_notify_on') : t('saved_search_notify_off')}
                        </Badge>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            if (isAuthenticated) {
                              try {
                                const updated = await api.updateSavedSearch(s.id, { notify_enabled: !s.notifyEnabled });
                                setItems((prev) =>
                                  prev.map((it) =>
                                    String(it.id) === String(s.id)
                                      ? { ...it, notifyEnabled: !!updated?.notify_enabled }
                                      : it
                                  )
                                );
                              } catch (e) {
                                setCheckError(e);
                              }
                            } else {
                              setItems(toggleSavedSearchNotify(s.id, !s.notifyEnabled));
                            }
                          }}
                          title={s.notifyEnabled ? t('saved_search_notify_off') : t('saved_search_notify_on')}
                        >
                          <Flex align="center" gap="2">
                            <Icon icon={s.notifyEnabled ? Bell : BellOff} size={16} />
                            <Text as="span" size="2">
                              {s.notifyEnabled ? t('saved_search_notify_on') : t('saved_search_notify_off')}
                            </Text>
                          </Flex>
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => checkNow(s)} disabled={checkingId === s.id}>
                          {checkingId === s.id ? t('checking') : t('check_now')}
                        </Button>
                        {typeof s.lastCount === 'number' ? (
                          <Badge>{t('saved_search_last_count', { count: s.lastCount })}</Badge>
                        ) : null}
                        {typeof s.lastDelta === 'number' && s.lastDelta > 0 ? (
                          <Badge variant="ok">{t('saved_search_new_matches', { count: s.lastDelta })}</Badge>
                        ) : null}
                        {s.lastCheckedAt ? (
                          <Text size="1" color="gray">
                            {t('saved_search_last_checked')}: {formatDate(s.lastCheckedAt)}
                          </Text>
                        ) : null}
                      </Flex>
                    </div>
                    <Flex align="center" gap="2" wrap="wrap">
                      <Button size="sm" onClick={() => openSearch(s.queryString)}>
                        {t('open')}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="px-2"
                        onClick={async () => {
                          if (isAuthenticated) {
                            try {
                              await api.deleteSavedSearch(s.id);
                              setItems((prev) => prev.filter((x) => String(x.id) !== String(s.id)));
                            } catch (e) {
                              setCheckError(e);
                            }
                          } else {
                            setItems(removeSavedSearch(s.id));
                          }
                        }}
                        title={t('delete')}
                        aria-label={t('delete')}
                      >
                        <Icon icon={Trash2} size={16} />
                      </Button>
                    </Flex>
                  </Flex>
                </div>
              ))}
            </Flex>
          </CardBody>
        </Card>
      )}
    </Flex>
  );
}
