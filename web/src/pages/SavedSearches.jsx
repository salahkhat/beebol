import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Flex, Heading, Text } from '@radix-ui/themes';
import { Trash2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { EmptyState } from '../ui/EmptyState';
import { useI18n } from '../i18n/i18n';
import { listSavedSearches, removeSavedSearch } from '../lib/savedSearches';

export function SavedSearchesPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [items, setItems] = useState(() => listSavedSearches());

  useEffect(() => {
    setItems(listSavedSearches());
  }, []);

  const hasAny = items.length > 0;

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }, [items]);

  function openSearch(queryString) {
    const qs = String(queryString || '').replace(/^\?/, '');
    navigate(`/listings${qs ? `?${qs}` : ''}`);
  }

  return (
    <Flex direction="column" gap="5">
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
            <Flex direction="column" gap="3">
              {sorted.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-[var(--gray-a5)] bg-[var(--color-panel-solid)] p-4"
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
                    </div>
                    <Flex align="center" gap="2" wrap="wrap">
                      <Button size="sm" onClick={() => openSearch(s.queryString)}>
                        {t('open')}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setItems(removeSavedSearch(s.id));
                        }}
                        title={t('delete')}
                      >
                        <Flex align="center" gap="2">
                          <Icon icon={Trash2} size={16} />
                          <Text as="span" size="2">
                            {t('delete')}
                          </Text>
                        </Flex>
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
