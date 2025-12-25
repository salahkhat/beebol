import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Box, Flex, Heading, Link as RTLink, Text } from '@radix-ui/themes';
import { ArrowLeft, ArrowRight, RefreshCcw, Send } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { formatDate } from '../lib/format';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { InlineError } from '../ui/InlineError';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { useI18n } from '../i18n/i18n';

const THREAD_SEEN_KEY = 'beebol.threadLastSeenAt';

function writeSeenAt(threadId, iso) {
  if (!threadId || !iso) return;
  try {
    const raw = localStorage.getItem(THREAD_SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = parsed && typeof parsed === 'object' ? { ...parsed } : {};
    next[String(threadId)] = String(iso);
    localStorage.setItem(THREAD_SEEN_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function ThreadDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const { t, dir } = useI18n();

  function userLabel(userId) {
    return t('user_number', { id: userId });
  }

  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const endRef = useRef(null);
  const didInitialScroll = useRef(false);

  async function refresh({ soft } = { soft: false }) {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [threadRes, messagesRes] = await Promise.all([api.thread(id), api.threadMessages(id)]);
      setThread(threadRes);
      setMessages(messagesRes);

      const last = Array.isArray(messagesRes) && messagesRes.length ? messagesRes[messagesRes.length - 1] : null;
      const lastIso = last?.created_at || threadRes?.last_message_at;
      if (lastIso) writeSeenAt(id, lastIso);
    } catch (e) {
      setError(e);
    } finally {
      if (soft) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    refresh({ soft: false });
    didInitialScroll.current = false;
  }, [id, reloadNonce]);

  useEffect(() => {
    if (loading) return;
    if (didInitialScroll.current) return;
    if (!messages.length) return;
    didInitialScroll.current = true;
    queueMicrotask(() => {
      endRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    });
  }, [loading, messages.length]);

  async function send(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const msg = await api.sendThreadMessage(id, body.trim());
      setBody('');
      if (msg) {
        setMessages((prev) => [...(Array.isArray(prev) ? prev : []), msg]);
        setThread((prev) =>
          prev
            ? {
                ...prev,
                last_message_body: msg.body,
                last_message_at: msg.created_at,
                last_message_sender_username: msg.sender_username,
              }
            : prev
        );
        if (msg.created_at) writeSeenAt(id, msg.created_at);
      } else {
        await refresh({ soft: true });
      }
      queueMicrotask(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
    } catch (e2) {
      toast.push({ title: t('toast_sendFailed'), description: e2 instanceof ApiError ? e2.message : String(e2), variant: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Flex direction="column" gap="4">
      <RTLink asChild underline="none" highContrast>
        <Link to="/threads">
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
          <Flex align="start" justify="between" gap="3" wrap="wrap">
            <Flex direction="column" gap="1">
              <Heading size="4">{t('thread_title', { id })}</Heading>
              <Text size="2" color="gray">
                {thread?.listing_title
                  ? thread.listing_title
                  : thread?.listing
                    ? t('listing_number', { id: thread.listing })
                    : loading
                      ? ''
                      : ''}
              </Text>
            </Flex>
            <Button
              variant="secondary"
              onClick={() => refresh({ soft: true })}
              disabled={loading || refreshing}
            >
              <Flex align="center" gap="2">
                <Icon icon={RefreshCcw} size={16} />
                <Text as="span" size="2">
                  {refreshing ? t('loading') : t('refresh')}
                </Text>
              </Flex>
            </Button>
          </Flex>
        </CardHeader>
        <CardBody>
          <InlineError error={error instanceof ApiError ? error : error} onRetry={() => setReloadNonce((n) => n + 1)} />

          {loading && messages.length === 0 ? (
            <Flex direction="column" gap="3" mt="4" className="bb-stagger">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <Box p="4">
                    <Flex align="center" justify="between" gap="3" wrap="wrap">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </Flex>
                    <Skeleton className="mt-3 h-4 w-5/6" />
                    <Skeleton className="mt-2 h-4 w-2/3" />
                  </Box>
                </Card>
              ))}
            </Flex>
          ) : null}

          <Flex direction="column" gap="3" mt="4" className="bb-stagger">
            {messages.map((m) => (
              <Card key={m.id}>
                <Box p="4">
                  <Flex align="center" justify="between" gap="3" wrap="wrap">
                    <Text weight="bold" size="2">
                      {m.sender_username || userLabel(m.sender)}
                    </Text>
                    <Text size="1" color="gray">
                      {formatDate(m.created_at)}
                    </Text>
                  </Flex>
                  <Text size="2" mt="2" style={{ whiteSpace: 'pre-wrap' }}>
                    {m.body}
                  </Text>
                </Box>
              </Card>
            ))}
            {!loading && messages.length === 0 ? (
              <EmptyState icon={Send}>{t('messages_empty')}</EmptyState>
            ) : null}
            <div ref={endRef} />
          </Flex>

          <form onSubmit={send} className="mt-6 flex gap-3">
            <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('messages_typePlaceholder')} />
            <Button type="submit" disabled={busy || !body.trim()}>
              <Flex align="center" gap="2">
                <Icon icon={Send} size={16} />
                <Text as="span" size="2">
                  {t('send')}
                </Text>
              </Flex>
            </Button>
          </form>
        </CardBody>
      </Card>
    </Flex>
  );
}
