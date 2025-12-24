import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Flex, Heading, Link as RTLink, Text } from '@radix-ui/themes';
import { Flag, ShieldCheck, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { InlineError } from '../ui/InlineError';
import { Skeleton } from '../ui/Skeleton';
import { useI18n } from '../i18n/i18n';

function StatCard({ title, value, icon, to, cta }) {
  return (
    <Card>
      <CardBody>
        <Flex align="start" justify="between" gap="3">
          <Flex direction="column" gap="2" style={{ minWidth: 0 }}>
            <Text size="2" color="gray">
              {title}
            </Text>
            <Heading size="6">{value}</Heading>
            {to ? (
              <RTLink asChild underline="none" highContrast>
                <Link to={to}>
                  <Button size="sm" variant="secondary">
                    {cta}
                  </Button>
                </Link>
              </RTLink>
            ) : null}
          </Flex>
          <Icon icon={icon} size={20} className="text-[var(--gray-11)]" aria-label="" />
        </Flex>
      </CardBody>
    </Card>
  );
}

export function AdminDashboardPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ pending: 0, flagged: 0, removed: 0 });
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [pendingRes, flaggedRes, removedRes] = await Promise.all([
          api.listings({ moderation_status: 'pending', status: 'published', page: 1 }, { auth: true }),
          api.listings({ is_flagged: true, page: 1 }, { auth: true }),
          api.listings({ include_removed: 1, is_removed: true, page: 1 }, { auth: true }),
        ]);

        if (cancelled) return;
        setStats({
          pending: pendingRes?.count ?? 0,
          flagged: flaggedRes?.count ?? 0,
          removed: removedRes?.count ?? 0,
        });
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

  const cards = useMemo(
    () => [
      {
        key: 'pending',
        title: t('dashboard_pending'),
        value: stats.pending,
        icon: ShieldCheck,
        to: '/admin/moderation',
        cta: t('open_moderation'),
      },
      {
        key: 'flagged',
        title: t('dashboard_flagged'),
        value: stats.flagged,
        icon: Flag,
        to: '/admin/moderation',
        cta: t('open_moderation'),
      },
      {
        key: 'removed',
        title: t('dashboard_removed'),
        value: stats.removed,
        icon: Trash2,
        to: '/admin/moderation',
        cta: t('open_moderation'),
      },
    ],
    [stats, t],
  );

  return (
    <Flex direction="column" gap="4">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading size="5">{t('dashboard_title')}</Heading>
        <Button variant="secondary" onClick={() => setReloadNonce((n) => n + 1)} disabled={loading}>
          {t('refresh')}
        </Button>
      </Flex>

      <Card>
        <CardHeader>
          <Text size="2" color="gray">
            {t('dashboard_subtitle')}
          </Text>
        </CardHeader>
        <CardBody>
          <InlineError error={error instanceof ApiError ? error : error} onRetry={() => setReloadNonce((n) => n + 1)} />

          {loading ? (
            <Flex direction="column" gap="3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <Box p="4">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="mt-3 h-8 w-24" />
                    <Skeleton className="mt-3 h-8 w-40" />
                  </Box>
                </Card>
              ))}
            </Flex>
          ) : (
            <Flex direction="column" gap="3">
              {cards.map((c) => (
                <StatCard key={c.key} title={c.title} value={c.value} icon={c.icon} to={c.to} cta={c.cta} />
              ))}
            </Flex>
          )}
        </CardBody>
      </Card>
    </Flex>
  );
}
