import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Flex, Heading, Link as RTLink, Text } from '@radix-ui/themes';
import { ChevronRight, Clock, MessageSquareText } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { formatDate } from '../lib/format';
import { Icon } from '../ui/Icon';
import { InlineError } from '../ui/InlineError';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { useI18n } from '../i18n/i18n';

const THREAD_SEEN_KEY = 'beebol.threadLastSeenAt';

function readSeenMap() {
  try {
    const raw = localStorage.getItem(THREAD_SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getSeenAt(threadId) {
  const map = readSeenMap();
  const v = map?.[String(threadId)];
  return typeof v === 'string' ? v : null;
}

function isUnread(thread) {
  if (!thread?.id) return false;
  if (!thread?.last_message_at) return false;
  const seenAt = getSeenAt(thread.id);
  if (!seenAt) return true;
  const seen = Date.parse(seenAt);
  const last = Date.parse(thread.last_message_at);
  if (!Number.isFinite(seen) || !Number.isFinite(last)) return false;
  return last > seen;
}

export function ThreadsPage() {
  const { t } = useI18n();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.threads();
        const items = Array.isArray(res) ? res : res?.results || [];
        if (!cancelled) setData(items);
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

  return (
    <Flex direction="column" gap="4">
      <Heading size="5">{t('messages_title')}</Heading>
      <Card>
        <CardHeader>
          <Text size="2" color="gray">
            {t('messages_threads')}
          </Text>
        </CardHeader>
        <CardBody>
          <InlineError error={error instanceof ApiError ? error : error} onRetry={() => setReloadNonce((n) => n + 1)} />

          {loading ? (
            <Flex direction="column" gap="2" mt="2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <Box p="4">
                    <Flex align="start" justify="between" gap="3">
                      <Flex direction="column" gap="2" style={{ minWidth: 0, flex: 1 }}>
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-48" />
                      </Flex>
                      <Skeleton className="h-4 w-4 rounded-full" />
                    </Flex>
                  </Box>
                </Card>
              ))}
            </Flex>
          ) : (
            <Flex direction="column" gap="2" mt="2">
              {data.map((thread) => (
              <RTLink key={thread.id} asChild underline="none" highContrast>
                <Link to={`/threads/${thread.id}`}>
                  <Card className="transition-colors hover:bg-[var(--gray-a2)]">
                    <Box p="4">
                      <Flex align="start" justify="between" gap="3">
                        <Flex direction="column" gap="1" style={{ minWidth: 0 }}>
                          <Flex align="center" gap="2" style={{ minWidth: 0 }}>
                            <Icon icon={MessageSquareText} size={16} className="text-[var(--gray-11)]" aria-label="" />
                            <Text weight="bold" size="2" style={{ wordBreak: 'break-word' }}>
                              {thread.listing_title ? thread.listing_title : t('listing_number', { id: thread.listing })}
                            </Text>
                          </Flex>
                          <Text size="2" color={isUnread(thread) ? undefined : 'gray'} style={{ wordBreak: 'break-word' }}>
                            {thread.last_message_body ? thread.last_message_body : t('messages_noMessagesYet')}
                          </Text>
                          <Flex align="center" gap="2">
                            <Icon icon={Clock} size={14} className="text-[var(--gray-11)]" aria-label="" />
                            <Text size="1" color="gray">
                              {thread.last_message_at ? t('messages_lastMessage') : t('detail_created')}: {formatDate(thread.last_message_at || thread.created_at)}
                            </Text>
                          </Flex>
                        </Flex>

                        <Flex align="center" gap="2">
                          {isUnread(thread) ? <Badge variant="warn">{t('messages_unread')}</Badge> : null}
                          <Icon icon={ChevronRight} size={16} className="text-[var(--gray-11)]" aria-label="" />
                        </Flex>
                      </Flex>
                    </Box>
                  </Card>
                </Link>
              </RTLink>
              ))}
              {!loading && data.length === 0 ? (
                <EmptyState icon={MessageSquareText}>{t('messages_empty')}</EmptyState>
              ) : null}
            </Flex>
          )}
        </CardBody>
      </Card>
    </Flex>
  );
}
