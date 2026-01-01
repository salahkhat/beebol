import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Box, Flex, Heading, Link as RTLink, Text } from '@radix-ui/themes';
import { ArrowLeft, ArrowRight, RefreshCcw, Send } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { formatDate } from '../lib/format';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { InlineError } from '../ui/InlineError';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { useI18n } from '../i18n/i18n';
import { useAuth } from '../auth/AuthContext';

const REPORT_REASONS = ['spam', 'scam', 'prohibited', 'duplicate', 'other'];

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
  const { user } = useAuth();

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

  const [blocks, setBlocks] = useState([]);
  const [blocking, setBlocking] = useState(false);

  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [reportMessage, setReportMessage] = useState('');
  const [reporting, setReporting] = useState(false);

  const myId = user?.id;
  const otherUserId = thread && myId ? (Number(thread.buyer) === Number(myId) ? thread.seller : thread.buyer) : null;
  const otherBlocked = otherUserId ? blocks.find((b) => Number(b.blocked) === Number(otherUserId)) : null;

  const endRef = useRef(null);
  const didInitialScroll = useRef(false);

  async function refresh({ soft } = { soft: false }) {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [threadRes, messagesRes, blocksRes] = await Promise.all([api.thread(id), api.threadMessages(id), api.blocks()]);
      setThread(threadRes);
      setMessages(messagesRes);

      const blockItems = Array.isArray(blocksRes) ? blocksRes : blocksRes?.results || [];
      setBlocks(blockItems);

      // Mark thread read on the server so unread state syncs across devices.
      try {
        const updated = await api.markThreadRead(id);
        if (updated) setThread(updated);
      } catch {
        // ignore
      }

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

  async function toggleBlock() {
    if (!otherUserId) return;
    setBlocking(true);
    try {
      if (otherBlocked?.id) {
        await api.deleteBlock(otherBlocked.id);
        setBlocks((prev) => prev.filter((b) => Number(b.id) !== Number(otherBlocked.id)));
        toast.push({ title: t('block_title'), description: t('block_unblocked') });
      } else {
        const created = await api.createBlock(otherUserId);
        // create endpoint is get_or_create; list is source of truth
        if (created && typeof created === 'object') {
          setBlocks((prev) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            // Avoid duplicates
            if (!next.some((b) => Number(b.blocked) === Number(otherUserId))) next.unshift(created);
            return next;
          });
        } else {
          const res = await api.blocks();
          const items = Array.isArray(res) ? res : res?.results || [];
          setBlocks(items);
        }
        toast.push({ title: t('block_title'), description: t('block_blocked') });
      }
    } catch (e) {
      toast.push({ title: t('block_title'), description: e instanceof ApiError ? e.message : String(e), variant: 'error' });
    } finally {
      setBlocking(false);
    }
  }

  async function submitUserReport() {
    if (!otherUserId) return;
    setReporting(true);
    try {
      await api.createUserReport({
        reported: otherUserId,
        thread: Number(id),
        reason: reportReason,
        message: String(reportMessage || '').trim(),
      });
      toast.push({ title: t('report_title'), description: t('report_submitted') });
      setShowReport(false);
      setReportReason('spam');
      setReportMessage('');
    } catch (e) {
      toast.push({
        title: t('report_title'),
        description: e instanceof ApiError ? e.message : String(e),
        variant: 'error',
      });
    } finally {
      setReporting(false);
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

            {otherUserId ? (
              <Flex align="center" gap="2" wrap="wrap">
                <Button variant="secondary" onClick={toggleBlock} disabled={blocking || loading}>
                  <Text as="span" size="2">
                    {otherBlocked ? t('unblock_user') : t('block_user')}
                  </Text>
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowReport((v) => !v)}
                  disabled={loading || reporting}
                >
                  <Text as="span" size="2">
                    {t('report_user')}
                  </Text>
                </Button>
              </Flex>
            ) : null}
          </Flex>
        </CardHeader>
        <CardBody>
          <InlineError error={error instanceof ApiError ? error : error} onRetry={() => setReloadNonce((n) => n + 1)} />

          {showReport && otherUserId ? (
            <Card>
              <CardHeader>
                <Text size="2" color="gray">
                  {t('report_title')} · {userLabel(otherUserId)}
                </Text>
              </CardHeader>
              <CardBody>
                <Flex direction="column" gap="3">
                  <Box>
                    <Text size="2" color="gray">
                      {t('report_reason')}
                    </Text>
                    <Select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                      {REPORT_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {t(`report_reason_${r}`)}
                        </option>
                      ))}
                    </Select>
                  </Box>

                  <Box>
                    <Text size="2" color="gray">
                      {t('report_details')}
                    </Text>
                    <Textarea value={reportMessage} onChange={(e) => setReportMessage(e.target.value)} rows={4} />
                  </Box>

                  <Flex align="center" gap="2" wrap="wrap">
                    <Button onClick={submitUserReport} disabled={reporting}>
                      {reporting ? t('submitting') : t('submit')}
                    </Button>
                    <Button variant="secondary" onClick={() => setShowReport(false)} disabled={reporting}>
                      {t('cancel')}
                    </Button>
                  </Flex>
                </Flex>
              </CardBody>
            </Card>
          ) : null}

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
