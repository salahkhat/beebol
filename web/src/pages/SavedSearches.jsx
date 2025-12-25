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
import { listSavedSearches, markSavedSearchChecked, removeSavedSearch, savedSearchParams, toggleSavedSearchNotify } from '../lib/savedSearches';

export function SavedSearchesPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [items, setItems] = useState(() => listSavedSearches());
  const [checkingId, setCheckingId] = useState(null);
  const [checkError, setCheckError] = useState(null);

  useEffect(() => {
    setItems(listSavedSearches());
  }, []);

  const hasAny = items.length > 0;

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }, [items]);

  async function checkNow(search) {
    if (!search?.id) return;
    setCheckingId(search.id);
    setCheckError(null);
    try {
      const params = savedSearchParams(search.queryString);
      const res = await api.listings(params, { auth: false });
      const c = res?.count ?? 0;
      setItems(markSavedSearchChecked(search.id, c, search.lastCount));
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
                          onClick={() => setItems(toggleSavedSearchNotify(s.id, !s.notifyEnabled))}
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
                        onClick={() => {
                          setItems(removeSavedSearch(s.id));
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
