import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Flex, Heading, Text } from '@radix-ui/themes';
import { api, ApiError } from '../lib/api';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { InlineError } from '../ui/InlineError';
import { EmptyState } from '../ui/EmptyState';
import { Select } from '../ui/Select';
import { Skeleton } from '../ui/Skeleton';
import { formatDate } from '../lib/format';
import { useI18n } from '../i18n/i18n';

const STATUSES = ['open', 'resolved', 'dismissed'];
const KINDS = ['listings', 'users'];

export function MyReportsPage() {
  const { t } = useI18n();
  const [sp, setSp] = useSearchParams();

  const kind = useMemo(() => {
    const raw = String(sp.get('kind') || '').trim().toLowerCase();
    if (!raw) return 'listings';
    return KINDS.includes(raw) ? raw : 'listings';
  }, [sp]);

  const status = useMemo(() => {
    const s = String(sp.get('status') || '').trim().toLowerCase();
    if (!s) return '';
    return STATUSES.includes(s) ? s : '';
  }, [sp]);

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
        const res = kind === 'users'
          ? await api.userReports(status ? { status } : {})
          : await api.reports(status ? { status } : {});
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
  }, [kind, status, reloadNonce]);

  const results = data?.results || [];

  function handlerLabel(r) {
    if (!r) return '';
    if (r.handled_by_username) return String(r.handled_by_username);
    if (r.handled_by) return t('user_number', { id: r.handled_by });
    return t('none');
  }

  function statusLabel(code) {
    if (!code) return '';
    const key = `reports_status_${code}`;
    const translated = t(key);
    return translated === key ? String(code) : translated;
  }

  return (
    <Flex direction="column" gap="4">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading size="5">{t('my_reports_title')}</Heading>
        <Link to="/listings" style={{ textDecoration: 'none' }}>
          <Button variant="secondary">{t('nav_listings')}</Button>
        </Link>
      </Flex>

      <Card>
        <CardHeader>
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <Text size="2" color="gray">{t('my_reports_subtitle')}</Text>
            <Flex align="center" gap="2" wrap="wrap">
              <Text size="2" color="gray">{t('my_reports_kind')}</Text>
              <Select
                value={kind}
                onChange={(e) => {
                  const next = String(e.target.value || 'listings');
                  const q = new URLSearchParams(sp);
                  if (next && next !== 'listings') q.set('kind', next);
                  else q.delete('kind');
                  setSp(q, { replace: true });
                }}
              >
                <option value="listings">{t('my_reports_kind_listings')}</option>
                <option value="users">{t('my_reports_kind_users')}</option>
              </Select>

              <Text size="2" color="gray">{t('reports_status_filter')}</Text>
              <Select
                value={status}
                onChange={(e) => {
                  const next = String(e.target.value || '');
                  const q = new URLSearchParams(sp);
                  if (next) q.set('status', next);
                  else q.delete('status');
                  setSp(q, { replace: true });
                }}
              >
                <option value="">{t('my_reports_all')}</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" size="sm" onClick={() => setReloadNonce((n) => n + 1)} disabled={loading}>
                {t('refresh')}
              </Button>
            </Flex>
          </Flex>
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
              {results.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-[var(--gray-a5)] bg-[var(--color-panel-solid)] p-2"
                >
                  <Flex align="start" justify="between" gap="3" wrap="wrap">
                    <div style={{ minWidth: 0 }}>
                      <Text weight="bold" size="2" style={{ wordBreak: 'break-word' }}>
                        {statusLabel(r.status)}
                      </Text>
                      <Text size="2" color="gray">
                        {formatDate(r.created_at)}
                      </Text>
                      {r.handled_at ? (
                        <Text size="2" color="gray">
                          {t('handled_by_at', { user: handlerLabel(r), date: formatDate(r.handled_at) })}
                        </Text>
                      ) : null}

                      {kind !== 'users' && r.listing ? (
                        <div className="mt-2">
                          <Link to={`/listings/${r.listing}`} className="hover:underline">
                            {t('report_view_listing')}{r.listing_title ? ` · ${r.listing_title}` : ''}
                          </Link>
                        </div>
                      ) : null}

                      {kind === 'users' ? (
                        <div className="mt-2">
                          <Text size="2" color="gray">
                            {t('reported_user', { user: r.reported_username || r.reported })}
                          </Text>
                          {r.thread ? (
                            <div className="mt-1">
                              <Link to={`/threads/${r.thread}`} className="hover:underline">
                                {t('report_view_thread')}
                              </Link>
                            </div>
                          ) : null}
                          {r.listing ? (
                            <div className="mt-1">
                              <Link to={`/listings/${r.listing}`} className="hover:underline">
                                {t('report_view_listing')}
                              </Link>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {r.reason ? (
                        <Text size="2" color="gray" className="mt-2" style={{ wordBreak: 'break-word' }}>
                          {t(`report_reason_${r.reason}`)}
                        </Text>
                      ) : null}
                      {r.message ? (
                        <Text size="2" className="mt-2" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {r.message}
                        </Text>
                      ) : null}
                      {r.staff_note ? (
                        <div className="mt-2">
                          <Text size="2" color="gray">{t('report_staff_note')}</Text>
                          <Text size="2" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {r.staff_note}
                          </Text>
                        </div>
                      ) : null}
                    </div>
                    <Flex align="center" gap="2" wrap="wrap">
                      {kind !== 'users' && r.listing ? (
                        <Link to={`/reports/new?listing=${r.listing}`} style={{ textDecoration: 'none' }}>
                          <Button size="sm" variant="secondary">{t('report_again')}</Button>
                        </Link>
                      ) : null}
                    </Flex>
                  </Flex>
                </div>
              ))}
            </Flex>
          ) : (
            <EmptyState
              title={kind === 'users' ? t('my_user_reports_empty_title') : t('my_reports_empty_title')}
              description={kind === 'users' ? t('my_user_reports_empty_desc') : t('my_reports_empty_desc')}
              action={
                <Link to="/listings" style={{ textDecoration: 'none' }}>
                  <Button>{t('my_reports_empty_cta')}</Button>
                </Link>
              }
            />
          )}
        </CardBody>
      </Card>
    </Flex>
  );
}
