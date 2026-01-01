import { useEffect, useMemo, useState } from 'react';
import { Box, Callout, Flex, Heading, Spinner, Text } from '@radix-ui/themes';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, Flag, Image as ImageIcon, MapPin, RefreshCcw, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { InlineError } from '../ui/InlineError';
import { Skeleton } from '../ui/Skeleton';
import { Textarea } from '../ui/Textarea';
import { ListingThumbnail } from '../ui/ListingThumbnail';
import { formatDate, formatMoney } from '../lib/format';
import { useToast } from '../ui/Toast';
import { useI18n } from '../i18n/i18n';

function moderationBadgeVariant(m) {
  if (m === 'approved') return 'ok';
  if (m === 'pending') return 'warn';
  if (m === 'rejected') return 'danger';
  return 'default';
}

export function AdminModerationPage() {
  const toast = useToast();
  const { t } = useI18n();

  function moderationLabel(code) {
    if (!code) return '';
    const key = `moderation_status_${code}`;
    const translated = t(key);
    return translated === key ? String(code) : translated;
  }

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [mode, setMode] = useState('listings');
  const [reportSaving, setReportSaving] = useState(false);
  const [reportStatusFilter, setReportStatusFilter] = useState('open');
  const [reportNoteDraftById, setReportNoteDraftById] = useState(() => ({}));

  const [dialog, setDialog] = useState({ open: false, listing: null, action: null, ids: [] });
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [showFlagged, setShowFlagged] = useState(false);

  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [reportPreviewIds, setReportPreviewIds] = useState(() => new Set());
  const [detailsById, setDetailsById] = useState(() => ({}));
  const [detailsLoadingIds, setDetailsLoadingIds] = useState(() => new Set());
  const [detailsErrorById, setDetailsErrorById] = useState(() => ({}));

  const [reportEventsExpandedIds, setReportEventsExpandedIds] = useState(() => new Set());
  const [reportEventsById, setReportEventsById] = useState(() => ({}));
  const [reportEventsLoadingIds, setReportEventsLoadingIds] = useState(() => new Set());
  const [reportEventsErrorById, setReportEventsErrorById] = useState(() => ({}));

  const [userReportEventsExpandedIds, setUserReportEventsExpandedIds] = useState(() => new Set());
  const [userReportEventsById, setUserReportEventsById] = useState(() => ({}));
  const [userReportEventsLoadingIds, setUserReportEventsLoadingIds] = useState(() => new Set());
  const [userReportEventsErrorById, setUserReportEventsErrorById] = useState(() => ({}));

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = mode === 'reports'
        ? await api.reports(reportStatusFilter ? { status: reportStatusFilter } : {})
        : mode === 'userReports'
          ? await api.userReports(reportStatusFilter ? { status: reportStatusFilter } : {})
          : await api.listings(
              showFlagged
                ? {
                    ...(showRemoved ? { include_removed: 1, is_removed: true } : { moderation_status: 'pending', status: 'published' }),
                    is_flagged: true,
                  }
                : (showRemoved ? { include_removed: 1, is_removed: true } : { moderation_status: 'pending', status: 'published' }),
              { auth: true },
            );
      setData(res);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    clearSelection();
  }, [reloadNonce, mode, showRemoved, showFlagged]);

  useEffect(() => {
    if (mode !== 'listings') {
      setShowRemoved(false);
      setShowFlagged(false);
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'reports') {
      setReportPreviewIds(new Set());
      setReportEventsExpandedIds(new Set());
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'userReports') {
      setUserReportEventsExpandedIds(new Set());
    }
  }, [mode]);

  async function ensureReportEvents(reportId) {
    if (!reportId) return;
    if (reportEventsById[reportId]) return;
    if (reportEventsLoadingIds.has(reportId)) return;

    setReportEventsLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(reportId);
      return next;
    });
    setReportEventsErrorById((prev) => ({ ...prev, [reportId]: null }));
    try {
      const res = await api.reportEvents(reportId);
      const events = Array.isArray(res?.results) ? res.results : [];
      setReportEventsById((prev) => ({ ...prev, [reportId]: events }));
    } catch (e) {
      setReportEventsErrorById((prev) => ({ ...prev, [reportId]: e }));
    } finally {
      setReportEventsLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(reportId);
        return next;
      });
    }
  }

  function toggleReportEvents(reportId) {
    if (!reportId) return;
    setReportEventsExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(reportId)) next.delete(reportId);
      else next.add(reportId);
      return next;
    });
    queueMicrotask(() => ensureReportEvents(reportId));
  }

  useEffect(() => {
    if (mode === 'reports' || mode === 'userReports') {
      setReportStatusFilter('open');
    }
  }, [mode]);

  const listingResults = useMemo(() => (mode === 'listings' ? data?.results || [] : []), [data, mode]);
  const reportResults = useMemo(() => (mode === 'reports' ? data?.results || [] : []), [data, mode]);
  const userReportResults = useMemo(() => (mode === 'userReports' ? data?.results || [] : []), [data, mode]);

  const allIds = Array.isArray(listingResults) ? listingResults.map((r) => r.id).filter(Boolean) : [];
  const selectedCount = selectedIds.size;
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const shouldSelectAll = !(allIds.length > 0 && allIds.every((id) => next.has(id)));
      if (!shouldSelectAll) {
        for (const id of allIds) next.delete(id);
        return next;
      }
      for (const id of allIds) next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function ensureDetails(listingId) {
    if (!listingId) return;
    if (detailsById[listingId]) return;
    if (detailsLoadingIds.has(listingId)) return;

    setDetailsLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(listingId);
      return next;
    });
    setDetailsErrorById((prev) => ({ ...prev, [listingId]: null }));
    try {
      const detail = await api.listing(listingId, { auth: true });
      setDetailsById((prev) => ({ ...prev, [listingId]: detail }));
    } catch (e) {
      setDetailsErrorById((prev) => ({ ...prev, [listingId]: e }));
    } finally {
      setDetailsLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(listingId);
        return next;
      });
    }
  }

  async function ensureUserReportEvents(reportId) {
    if (!reportId) return;
    if (userReportEventsById[reportId]) return;
    if (userReportEventsLoadingIds.has(reportId)) return;

    setUserReportEventsLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(reportId);
      return next;
    });
    setUserReportEventsErrorById((prev) => ({ ...prev, [reportId]: null }));
    try {
      const res = await api.userReportEvents(reportId);
      const events = Array.isArray(res?.results) ? res.results : [];
      setUserReportEventsById((prev) => ({ ...prev, [reportId]: events }));
    } catch (e) {
      setUserReportEventsErrorById((prev) => ({ ...prev, [reportId]: e }));
    } finally {
      setUserReportEventsLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(reportId);
        return next;
      });
    }
  }

  function toggleUserReportEvents(reportId) {
    if (!reportId) return;
    setUserReportEventsExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(reportId)) next.delete(reportId);
      else next.add(reportId);
      return next;
    });
    queueMicrotask(() => ensureUserReportEvents(reportId));
  }

  function toggleExpanded(listingId) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(listingId)) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
    // Fire-and-forget detail fetch for first expand.
    queueMicrotask(() => ensureDetails(listingId));
  }

  function toggleReportPreview(listingId) {
    if (!listingId) return;
    setReportPreviewIds((prev) => {
      const next = new Set(prev);
      if (next.has(listingId)) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
    queueMicrotask(() => ensureDetails(listingId));
  }

  async function doModerate(moderation_status) {
    const ids = Array.isArray(dialog.ids) && dialog.ids.length ? dialog.ids : dialog.listing ? [dialog.listing.id] : [];
    if (!ids.length) return;
    setBulkSaving(ids.length > 1);
    try {
      const res = await api.bulkUpdateListings({ ids, data: { moderation_status } });
      const updated = Array.isArray(res?.updated) ? res.updated : [];
      const ok = Array.isArray(res?.updated_ids) ? res.updated_ids.length : updated.length;
      const total = ids.length;

      if (ok === total) {
        toast.push({
          title: t('moderation_title'),
          description: t('toast_moderationBulkChanged', { count: total, status: moderationLabel(moderation_status) }),
        });
      } else {
        toast.push({
          title: t('moderation_title'),
          description: t('toast_moderationBulkPartial', { ok, total, status: moderationLabel(moderation_status) }),
          variant: 'error',
        });
      }

      setDialog({ open: false, listing: null, action: null, ids: [] });
      await refresh();
      clearSelection();
    } catch (e) {
      toast.push({ title: t('moderation_title'), description: e instanceof ApiError ? e.message : String(e), variant: 'error' });
    } finally {
      setBulkSaving(false);
    }
  }

  async function doFlag({ ids, is_flagged }) {
    if (!Array.isArray(ids) || !ids.length) return;
    setBulkSaving(ids.length > 1);
    try {
      const res = await api.bulkUpdateListings({ ids, data: { is_flagged } });
      const ok = Array.isArray(res?.updated_ids) ? res.updated_ids.length : Array.isArray(res?.updated) ? res.updated.length : 0;
      const total = ids.length;
      toast.push({
        title: t('moderation_title'),
        description: ok === total
          ? t('toast_moderationFlagged', { count: total, state: is_flagged ? t('flagged') : t('unflagged') })
          : t('toast_moderationFlaggedPartial', { ok, total, state: is_flagged ? t('flagged') : t('unflagged') }),
        variant: ok === total ? undefined : 'error',
      });
      await refresh();
      clearSelection();
    } catch (e) {
      toast.push({ title: t('moderation_title'), description: e instanceof ApiError ? e.message : String(e), variant: 'error' });
    } finally {
      setBulkSaving(false);
    }
  }

  async function doRemove({ ids, is_removed }) {
    if (!Array.isArray(ids) || !ids.length) return;
    setBulkSaving(ids.length > 1);
    try {
      const res = await api.bulkUpdateListings({ ids, data: { is_removed } });
      const ok = Array.isArray(res?.updated_ids) ? res.updated_ids.length : Array.isArray(res?.updated) ? res.updated.length : 0;
      const total = ids.length;
      toast.push({
        title: t('moderation_title'),
        description: is_removed
          ? (ok === total
              ? t('toast_moderationRemoved', { count: total })
              : t('toast_moderationRemovedPartial', { ok, total }))
          : (ok === total
              ? t('toast_moderationRestored', { count: total })
              : t('toast_moderationRestoredPartial', { ok, total })),
        variant: ok === total ? undefined : 'error',
      });
      setDialog({ open: false, listing: null, action: null, ids: [] });
      await refresh();
      clearSelection();
    } catch (e) {
      toast.push({ title: t('moderation_title'), description: e instanceof ApiError ? e.message : String(e), variant: 'error' });
    } finally {
      setBulkSaving(false);
    }
  }

  function reportReasonLabel(code) {
    if (!code) return '';
    const key = `report_reason_${code}`;
    const translated = t(key);
    return translated === key ? String(code) : translated;
  }

  function handlerLabel(r) {
    if (!r) return '';
    if (r.handled_by_username) return String(r.handled_by_username);
    if (r.handled_by) return t('user_number', { id: r.handled_by });
    return t('none');
  }

  function noteKey(reportId) {
    return `${mode}:${String(reportId)}`;
  }

  async function setReportStatus(reportId, status) {
    if (!reportId) return;
    setReportSaving(true);
    try {
      const k = noteKey(reportId);
      const note = Object.prototype.hasOwnProperty.call(reportNoteDraftById, k)
        ? reportNoteDraftById[k]
        : undefined;
      if (mode === 'userReports') {
        await api.updateUserReportStatus(reportId, status, note);
      } else {
        await api.updateReportStatus(reportId, status, note);
      }
      toast.push({
        title: t('reports_title'),
        description: status === 'resolved' ? t('report_resolved') : status === 'dismissed' ? t('report_dismissed') : t('report_reopened'),
      });
      await refresh();
    } catch (e) {
      toast.push({ title: t('reports_title'), description: e instanceof ApiError ? e.message : String(e), variant: 'error' });
    } finally {
      setReportSaving(false);
    }
  }

  async function saveReportNote(reportId, status) {
    if (!reportId) return;
    setReportSaving(true);
    try {
      const note = reportNoteDraftById[noteKey(reportId)] ?? '';
      if (mode === 'userReports') {
        await api.updateUserReportStatus(reportId, status || 'open', note);
      } else {
        await api.updateReportStatus(reportId, status || 'open', note);
      }
      toast.push({ title: t('reports_title'), description: t('toast_saved') });
      await refresh();
    } catch (e) {
      toast.push({ title: t('reports_title'), description: e instanceof ApiError ? e.message : String(e), variant: 'error' });
    } finally {
      setReportSaving(false);
    }
  }

  return (
    <Flex direction="column" gap="4">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading size="5">{t('moderation_title')}</Heading>
        <Flex align="center" gap="2" wrap="wrap">
          <Button size="sm" variant={mode === 'listings' ? 'primary' : 'secondary'} onClick={() => setMode('listings')}>
            {t('moderation_mode_listings')}
          </Button>
          <Button size="sm" variant={mode === 'reports' ? 'primary' : 'secondary'} onClick={() => setMode('reports')}>
            {t('moderation_mode_reports')}
          </Button>
          <Button size="sm" variant={mode === 'userReports' ? 'primary' : 'secondary'} onClick={() => setMode('userReports')}>
            {t('moderation_mode_user_reports')}
          </Button>
            {mode === 'reports' || mode === 'userReports' ? (
              <label className="inline-flex items-center gap-2">
                <Text size="2" color="gray">
                  {t('reports_status_filter')}
                </Text>
                <select
                  className="rounded-md border border-[var(--gray-a6)] bg-transparent px-2 py-1 text-sm"
                  value={reportStatusFilter}
                  onChange={(e) => setReportStatusFilter(String(e.target.value || ''))}
                >
                  <option value="open">{t('reports_status_open')}</option>
                  <option value="resolved">{t('reports_status_resolved')}</option>
                  <option value="dismissed">{t('reports_status_dismissed')}</option>
                </select>
              </label>
            ) : null}
          {mode === 'listings' ? (
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={showRemoved} onChange={(e) => setShowRemoved(e.target.checked)} />
              <Text size="2">{t('mod_showRemoved')}</Text>
            </label>
          ) : null}
          {mode === 'listings' ? (
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={showFlagged} onChange={(e) => setShowFlagged(e.target.checked)} />
              <Text size="2">{t('mod_showFlagged')}</Text>
            </label>
          ) : null}
          <Button variant="secondary" onClick={refresh}>
            <Flex align="center" gap="2">
              <Icon icon={RefreshCcw} size={16} />
              <Text as="span" size="2">
                {t('refresh')}
              </Text>
            </Flex>
          </Button>
        </Flex>
      </Flex>

      {mode === 'reports' || mode === 'userReports' ? (
        <Card>
          <CardHeader>
            <Text size="2" color="gray">
              {(mode === 'userReports' ? t('user_reports_title') : t('reports_title'))} · {t(`reports_status_${reportStatusFilter}`)}
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
            ) : (mode === 'userReports' ? userReportResults : reportResults).length ? (
              <Flex direction="column" gap="3">
                {(mode === 'userReports' ? userReportResults : reportResults).map((r) => (
                  <div key={r.id} className="rounded-lg border border-[var(--gray-a5)] bg-[var(--color-panel-solid)] p-2">
                    <Flex align="start" justify="between" gap="3" wrap="wrap">
                      <div style={{ minWidth: 0 }}>
                        <Text weight="bold" size="2" style={{ wordBreak: 'break-word' }}>
                          {reportReasonLabel(r.reason)}
                        </Text>
                        <Text size="2" color="gray">
                          {t('reported_by', { user: r.reporter_username || r.reporter })} · {formatDate(r.created_at)}
                        </Text>

                        {mode === 'userReports' ? (
                          <Text size="2" color="gray">
                            {t('reported_user', {
                              user: r.reported_username || (r.reported ? t('user_number', { id: r.reported }) : ''),
                            })}
                          </Text>
                        ) : null}

                        {r.handled_at ? (
                          <Text size="2" color="gray">
                            {t('handled_by_at', { user: handlerLabel(r), date: formatDate(r.handled_at) })}
                          </Text>
                        ) : null}

                        {mode !== 'userReports' && r.listing ? (
                          <div className="mt-2">
                            <Link to={`/listings/${r.listing}`} className="hover:underline">
                              {t('report_view_listing')}{r.listing_title ? ` · ${r.listing_title}` : ''}
                            </Link>
                          </div>
                        ) : null}

                        {mode === 'userReports' && r.thread ? (
                          <div className="mt-2">
                            <Link to={`/threads/${r.thread}`} className="hover:underline">
                              {t('report_view_thread')}
                            </Link>
                          </div>
                        ) : null}

                        {mode === 'userReports' && r.listing ? (
                          <div className="mt-2">
                            <Link to={`/listings/${r.listing}`} className="hover:underline">
                              {t('report_view_listing')}
                            </Link>
                          </div>
                        ) : null}

                        {r.message ? (
                          <Text size="2" className="mt-2" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {r.message}
                          </Text>
                        ) : null}

                        <div className="mt-3">
                          <Text size="2" color="gray">{t('report_staff_note')}</Text>
                          <Textarea
                            value={Object.prototype.hasOwnProperty.call(reportNoteDraftById, noteKey(r.id))
                              ? (reportNoteDraftById[noteKey(r.id)] ?? '')
                              : (r.staff_note || '')}
                            onChange={(e) => {
                              const v = String(e.target.value ?? '');
                              setReportNoteDraftById((prev) => ({ ...prev, [noteKey(r.id)]: v }));
                            }}
                            placeholder={t('none')}
                            className="mt-1"
                          />
                          <Flex align="center" gap="2" wrap="wrap" className="mt-2">
                            <Button size="sm" variant="secondary" onClick={() => saveReportNote(r.id, r.status)} disabled={reportSaving}>
                              {t('save')}
                            </Button>
                            <Button size="sm" onClick={() => setReportStatus(r.id, 'resolved')} disabled={reportSaving || r.status === 'resolved'}>
                              {t('resolve')}
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => setReportStatus(r.id, 'dismissed')} disabled={reportSaving || r.status === 'dismissed'}>
                              {t('dismiss')}
                            </Button>
                            {r.status !== 'open' ? (
                              <Button size="sm" variant="secondary" onClick={() => setReportStatus(r.id, 'open')} disabled={reportSaving}>
                                {t('reopen')}
                              </Button>
                            ) : null}
                          </Flex>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={r.status === 'open' ? 'warn' : r.status === 'resolved' ? 'ok' : 'danger'}>
                          {t(`reports_status_${r.status}`)}
                        </Badge>

                        {mode === 'reports' ? (
                          <Flex direction="column" align="end" gap="2">
                            <Button size="sm" variant="secondary" onClick={() => toggleReportPreview(r.listing)} disabled={!r.listing}>
                              <Flex align="center" gap="2">
                                <Icon icon={reportPreviewIds.has(r.listing) ? ChevronUp : ChevronDown} size={16} />
                                <Text as="span" size="2">
                                  {reportPreviewIds.has(r.listing) ? t('mod_hideDetails') : t('mod_showDetails')}
                                </Text>
                              </Flex>
                            </Button>

                            <Button size="sm" variant="secondary" onClick={() => toggleReportEvents(r.id)}>
                              <Flex align="center" gap="2">
                                <Icon icon={reportEventsExpandedIds.has(r.id) ? ChevronUp : ChevronDown} size={16} />
                                <Text as="span" size="2">
                                  {reportEventsExpandedIds.has(r.id) ? t('mod_hideEvents') : t('mod_showEvents')}
                                </Text>
                              </Flex>
                            </Button>
                          </Flex>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => toggleUserReportEvents(r.id)}>
                            <Flex align="center" gap="2">
                              <Icon icon={userReportEventsExpandedIds.has(r.id) ? ChevronUp : ChevronDown} size={16} />
                              <Text as="span" size="2">
                                {userReportEventsExpandedIds.has(r.id) ? t('mod_hideEvents') : t('mod_showEvents')}
                              </Text>
                            </Flex>
                          </Button>
                        )}
                      </div>
                    </Flex>

                    {mode !== 'userReports' && r.listing && reportPreviewIds.has(r.listing) ? (
                      <div className="mt-3 rounded-md border border-[var(--gray-a5)] p-2">
                        {detailsLoadingIds.has(r.listing) ? (
                          <Flex align="center" gap="2">
                            <Spinner size="2" />
                            <Text size="2" color="gray">{t('loading')}</Text>
                          </Flex>
                        ) : detailsErrorById[r.listing] ? (
                          <Callout.Root color="red" role="alert">
                            <Callout.Icon>
                              <AlertTriangle size={16} />
                            </Callout.Icon>
                            <Callout.Text>{t('mod_detailsLoadFailed')}</Callout.Text>
                          </Callout.Root>
                        ) : detailsById[r.listing] ? (
                          <ReportListingPreview listing={detailsById[r.listing]} />
                        ) : null}
                      </div>
                    ) : null}

                    {mode === 'userReports' && userReportEventsExpandedIds.has(r.id) ? (
                      <div className="mt-3 rounded-md border border-[var(--gray-a5)] p-2">
                        {userReportEventsLoadingIds.has(r.id) && !userReportEventsById[r.id] ? (
                          <Flex align="center" gap="2">
                            <Spinner size="2" />
                            <Text size="2" color="gray">{t('loading')}</Text>
                          </Flex>
                        ) : userReportEventsErrorById[r.id] ? (
                          <Callout.Root color="red" role="alert">
                            <Callout.Icon>
                              <AlertTriangle size={16} />
                            </Callout.Icon>
                            <Callout.Text>
                              {t('mod_detailsLoadFailed')}
                            </Callout.Text>
                          </Callout.Root>
                        ) : Array.isArray(userReportEventsById[r.id]) && userReportEventsById[r.id].length ? (
                          <Flex direction="column" gap="2">
                            {userReportEventsById[r.id].map((ev) => (
                              <div key={ev.id} className="rounded-md border border-[var(--gray-a5)] p-2">
                                <Text size="2" color="gray">
                                  {formatDate(ev.created_at)}
                                  {ev.actor_username ? ` · ${ev.actor_username}` : ''}
                                  {ev.from_status && ev.to_status ? ` · ${ev.from_status} → ${ev.to_status}` : ''}
                                </Text>
                                {ev.note ? (
                                  <Text size="2" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} className="mt-1">
                                    {ev.note}
                                  </Text>
                                ) : null}
                              </div>
                            ))}
                          </Flex>
                        ) : (
                          <Callout.Root variant="surface">
                            <Callout.Text>{t('none')}</Callout.Text>
                          </Callout.Root>
                        )}
                      </div>
                    ) : null}

                    {mode === 'reports' && reportEventsExpandedIds.has(r.id) ? (
                      <div className="mt-3 rounded-md border border-[var(--gray-a5)] p-2">
                        {reportEventsLoadingIds.has(r.id) && !reportEventsById[r.id] ? (
                          <Flex align="center" gap="2">
                            <Spinner size="2" />
                            <Text size="2" color="gray">{t('loading')}</Text>
                          </Flex>
                        ) : reportEventsErrorById[r.id] ? (
                          <Callout.Root color="red" role="alert">
                            <Callout.Icon>
                              <AlertTriangle size={16} />
                            </Callout.Icon>
                            <Callout.Text>
                              {t('mod_detailsLoadFailed')}
                            </Callout.Text>
                          </Callout.Root>
                        ) : Array.isArray(reportEventsById[r.id]) && reportEventsById[r.id].length ? (
                          <Flex direction="column" gap="2">
                            {reportEventsById[r.id].map((ev) => (
                              <div key={ev.id} className="rounded-md border border-[var(--gray-a5)] p-2">
                                <Text size="2" color="gray">
                                  {formatDate(ev.created_at)}
                                  {ev.actor_username ? ` · ${ev.actor_username}` : ''}
                                  {ev.from_status && ev.to_status ? ` · ${ev.from_status} → ${ev.to_status}` : ''}
                                </Text>
                                {ev.note ? (
                                  <Text size="2" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} className="mt-1">
                                    {ev.note}
                                  </Text>
                                ) : null}
                              </div>
                            ))}
                          </Flex>
                        ) : (
                          <Callout.Root variant="surface">
                            <Callout.Text>{t('none')}</Callout.Text>
                          </Callout.Root>
                        )}
                      </div>
                    ) : null}
                  </div>
                ))}
              </Flex>
            ) : (
              <Callout.Root variant="surface">
                <Callout.Text>{t('reports_none')}</Callout.Text>
              </Callout.Root>
            )}
          </CardBody>
        </Card>
      ) : null}

      {mode === 'listings' ? (
      <Card>
        <CardHeader>
          <Text size="2" color="gray">
            {showRemoved ? t('moderation_removed') : t('moderation_pending')}
          </Text>
        </CardHeader>
        <CardBody>
          <InlineError error={error instanceof ApiError ? error : error} onRetry={() => setReloadNonce((n) => n + 1)} />

          {!loading && listingResults.length ? (
            <Card className="mb-3">
              <Box p={{ initial: '2', sm: '3' }}>
                <Flex align="center" justify="between" gap="3" wrap="wrap">
                  <Flex align="center" gap="3" wrap="wrap">
                    <div onClick={(e) => e.preventDefault()}>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                        <Text size="2">{t('mod_selectAll')}</Text>
                      </label>
                    </div>
                    <Text size="2" color="gray">
                      {t('mod_selectedCount', { count: selectedCount })}
                    </Text>
                  </Flex>

                  <Flex align="center" gap="2" wrap="wrap">
                    <Button
                      size="sm"
                      onClick={() =>
                        setDialog({
                          open: true,
                          listing: null,
                          action: 'approve',
                          ids: Array.from(selectedIds),
                        })
                      }
                      disabled={showRemoved || selectedCount === 0 || bulkSaving}
                    >
                      <Flex align="center" gap="2">
                        <Icon icon={CheckCircle2} size={14} />
                        <Text as="span" size="2">
                          {t('mod_bulkApprove')}
                        </Text>
                      </Flex>
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        setDialog({
                          open: true,
                          listing: null,
                          action: 'reject',
                          ids: Array.from(selectedIds),
                        })
                      }
                      disabled={showRemoved || selectedCount === 0 || bulkSaving}
                    >
                      <Flex align="center" gap="2">
                        <Icon icon={XCircle} size={14} />
                        <Text as="span" size="2">
                          {t('mod_bulkReject')}
                        </Text>
                      </Flex>
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => doFlag({ ids: Array.from(selectedIds), is_flagged: true })}
                      disabled={selectedCount === 0 || bulkSaving}
                    >
                      <Flex align="center" gap="2">
                        <Icon icon={Flag} size={14} />
                        <Text as="span" size="2">
                          {t('mod_bulkFlag')}
                        </Text>
                      </Flex>
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => doFlag({ ids: Array.from(selectedIds), is_flagged: false })}
                      disabled={selectedCount === 0 || bulkSaving}
                    >
                      <Flex align="center" gap="2">
                        <Icon icon={Flag} size={14} />
                        <Text as="span" size="2">
                          {t('mod_bulkUnflag')}
                        </Text>
                      </Flex>
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        setDialog({
                          open: true,
                          listing: null,
                          action: 'remove',
                          ids: Array.from(selectedIds),
                        })
                      }
                      disabled={showRemoved || selectedCount === 0 || bulkSaving}
                    >
                      <Flex align="center" gap="2">
                        <Icon icon={Trash2} size={14} />
                        <Text as="span" size="2">
                          {t('mod_bulkRemove')}
                        </Text>
                      </Flex>
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setDialog({
                          open: true,
                          listing: null,
                          action: 'restore',
                          ids: Array.from(selectedIds),
                        })
                      }
                      disabled={!showRemoved || selectedCount === 0 || bulkSaving}
                    >
                      <Flex align="center" gap="2">
                        <Icon icon={RefreshCcw} size={14} />
                        <Text as="span" size="2">
                          {t('mod_bulkRestore')}
                        </Text>
                      </Flex>
                    </Button>
                    <Button size="sm" variant="secondary" onClick={clearSelection} disabled={selectedCount === 0 || bulkSaving}>
                      {t('mod_clearSelection')}
                    </Button>
                  </Flex>
                </Flex>
              </Box>
            </Card>
          ) : null}

          {loading ? (
            <Flex direction="column" gap="3" mt="3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <Box p={{ initial: '2', sm: '3' }}>
                    <Flex align="start" justify="between" gap="4" wrap="wrap">
                      <Flex gap="3" align="start" style={{ minWidth: 0, flex: 1 }}>
                        <Skeleton className="h-16 w-16 shrink-0 sm:h-20 sm:w-20" />
                        <Flex direction="column" gap="2" style={{ minWidth: 0, flex: 1 }}>
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-56" />
                        </Flex>
                      </Flex>
                      <Flex direction="column" gap="2" align="end">
                        <Skeleton className="h-6 w-24 rounded-full" />
                        <Skeleton className="h-8 w-48" />
                      </Flex>
                    </Flex>
                  </Box>
                </Card>
              ))}
            </Flex>
          ) : (
            <Flex direction="column" gap="4" mt="3">
              {listingResults.map((r) => (
              <Card key={r.id}>
                <Box p={{ initial: '2', sm: '3' }}>
                  <Flex align="start" justify="between" gap="4" wrap="wrap">
                    <Flex gap="3" align="start" style={{ minWidth: 0, flex: 1 }}>
                      <div
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(r.id)}
                            onChange={() => toggleSelected(r.id)}
                            aria-label={t('mod_selectListing', { id: r.id })}
                          />
                        </label>
                      </div>
                      <ListingThumbnail
                        src={r.thumbnail}
                        alt=""
                        className="h-16 w-16 sm:h-20 sm:w-20"
                        placeholder={t('detail_noImages')}
                        ariaLabel={t('detail_noImages')}
                      />

                      <Flex direction="column" gap="2" style={{ minWidth: 0 }}>
                        <Text weight="bold" size="3" style={{ wordBreak: 'break-word' }}>
                          <Link to={`/listings/${r.id}`} className="hover:underline">
                            {r.title}
                          </Link>
                        </Text>
                        <Text size="2">{formatMoney(r.price, r.currency)}</Text>
                        <Flex align="center" gap="2" wrap="wrap">
                          <Icon icon={MapPin} size={14} className="text-[var(--gray-11)]" aria-label="" />
                          <Text size="1" color="gray">
                            {r.city?.name_ar || r.city?.name_en}
                          </Text>
                          <Text size="1" color="gray">·</Text>
                          <Icon icon={Clock} size={14} className="text-[var(--gray-11)]" aria-label="" />
                          <Text size="1" color="gray">
                            {formatDate(r.created_at)}
                          </Text>
                        </Flex>
                      </Flex>
                    </Flex>

                    <Flex direction="column" gap="2" align="end">
                      <Badge variant={moderationBadgeVariant(r.moderation_status)}>{moderationLabel(r.moderation_status)}</Badge>
                      <Flex gap="2" wrap="wrap" justify="end">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => doFlag({ ids: [r.id], is_flagged: !r.is_flagged })}
                          disabled={bulkSaving}
                        >
                          <Flex align="center" gap="2">
                            <Icon icon={Flag} size={14} />
                            <Text as="span" size="2">
                              {r.is_flagged ? t('unflag') : t('flag')}
                            </Text>
                          </Flex>
                        </Button>
                        <Button
                          size="sm"
                          variant={r.is_removed ? 'secondary' : 'danger'}
                          onClick={() =>
                            setDialog({ open: true, listing: r, action: r.is_removed ? 'restore' : 'remove', ids: [r.id] })
                          }
                          disabled={bulkSaving}
                        >
                          <Flex align="center" gap="2">
                            <Icon icon={r.is_removed ? RefreshCcw : Trash2} size={14} />
                            <Text as="span" size="2">
                              {r.is_removed ? t('restore') : t('remove')}
                            </Text>
                          </Flex>
                        </Button>
                      </Flex>
                      <Flex gap="2">
                        <Button size="sm" variant="secondary" onClick={() => toggleExpanded(r.id)}>
                          <Flex align="center" gap="2">
                            <Icon icon={expandedIds.has(r.id) ? ChevronUp : ChevronDown} size={14} />
                            <Text as="span" size="2">
                              {expandedIds.has(r.id) ? t('mod_hideDetails') : t('mod_showDetails')}
                            </Text>
                          </Flex>
                        </Button>
                        <Button size="sm" onClick={() => setDialog({ open: true, listing: r, action: 'approve', ids: [r.id] })}>
                          <Flex align="center" gap="2">
                            <Icon icon={CheckCircle2} size={14} />
                            <Text as="span" size="2">
                              {t('approve')}
                            </Text>
                          </Flex>
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setDialog({ open: true, listing: r, action: 'reject', ids: [r.id] })}>
                          <Flex align="center" gap="2">
                            <Icon icon={XCircle} size={14} />
                            <Text as="span" size="2">
                              {t('reject')}
                            </Text>
                          </Flex>
                        </Button>
                      </Flex>
                    </Flex>
                  </Flex>

                  {expandedIds.has(r.id) ? (
                    <Box mt="4">
                      {detailsLoadingIds.has(r.id) && !detailsById[r.id] ? (
                        <Flex direction="column" gap="2">
                          <Skeleton className="h-4 w-5/6" />
                          <Skeleton className="h-4 w-2/3" />
                          <Skeleton className="h-24 w-full" />
                        </Flex>
                      ) : null}

                      {detailsErrorById[r.id] ? (
                        <Callout.Root color="red" variant="surface">
                          <Callout.Text>
                            <Flex align="center" justify="between" gap="3" wrap="wrap">
                              <Flex align="center" gap="2">
                                <Icon icon={AlertTriangle} size={16} className="text-[var(--gray-11)]" aria-label="" />
                                <span>
                                  {t('mod_detailsLoadFailed')}: {detailsErrorById[r.id] instanceof ApiError ? detailsErrorById[r.id].message : String(detailsErrorById[r.id])}
                                </span>
                              </Flex>
                              <Button size="sm" variant="secondary" onClick={() => ensureDetails(r.id)}>
                                {t('retry')}
                              </Button>
                            </Flex>
                          </Callout.Text>
                        </Callout.Root>
                      ) : null}

                      {detailsById[r.id] ? (
                        <Flex direction="column" gap="3">
                          <Text size="2" style={{ whiteSpace: 'pre-wrap' }}>
                            {detailsById[r.id].description || <Text as="span" color="gray">{t('detail_noDescription')}</Text>}
                          </Text>

                          {Array.isArray(detailsById[r.id].images) && detailsById[r.id].images.length ? (
                            <Box>
                              <Flex align="center" gap="2" mb="2">
                                <Icon icon={ImageIcon} size={16} className="text-[var(--gray-11)]" aria-label="" />
                                <Text size="2" color="gray">{t('detail_images')}</Text>
                              </Flex>
                              <Flex gap="2" wrap="wrap">
                                {detailsById[r.id].images.slice(0, 6).map((img) => (
                                  <a
                                    key={img.id}
                                    href={normalizeMediaUrl(img.image)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="h-16 w-16 overflow-hidden rounded-md border border-[var(--gray-a5)] bg-[var(--color-panel-solid)]"
                                  >
                                    <img src={normalizeMediaUrl(img.image)} alt={img.alt_text || ''} className="h-full w-full object-cover" loading="lazy" />
                                  </a>
                                ))}
                              </Flex>
                            </Box>
                          ) : null}
                        </Flex>
                      ) : null}
                    </Box>
                  ) : null}
                </Box>
              </Card>
              ))}
            {!loading && listingResults.length === 0 ? (
              <Callout.Root variant="surface">
                <Callout.Text>
                  <Flex align="center" gap="2">
                    <Icon icon={ShieldCheck} size={16} className="text-[var(--gray-11)]" aria-label="" />
                    <span>{t('listings_none')}</span>
                  </Flex>
                </Callout.Text>
              </Callout.Root>
            ) : null}
            </Flex>
          )}
        </CardBody>
      </Card>
    ) : null}

      <Dialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        title={
          dialog.action === 'approve'
            ? t('moderate_approve_title')
            : dialog.action === 'reject'
              ? t('moderate_reject_title')
              : dialog.action === 'restore'
                ? t('moderate_restore_title')
                : t('moderate_remove_title')
        }
        description={
          dialog.listing
            ? t('moderation_dialog_listing', { id: dialog.listing.id, title: dialog.listing.title })
            : t('moderation_dialog_bulk', { count: Array.isArray(dialog.ids) ? dialog.ids.length : 0 })
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialog({ open: false, listing: null, action: null, ids: [] })}>
              <Flex align="center" gap="2">
                <Icon icon={XCircle} size={16} />
                <Text as="span" size="2">
                  {t('cancel')}
                </Text>
              </Flex>
            </Button>
            <Button
              variant={dialog.action === 'approve' ? 'primary' : 'danger'}
              onClick={() => {
                if (dialog.action === 'approve') return doModerate('approved');
                if (dialog.action === 'reject') return doModerate('rejected');
                if (dialog.action === 'restore') return doRemove({ ids: Array.isArray(dialog.ids) ? dialog.ids : [], is_removed: false });
                return doRemove({ ids: Array.isArray(dialog.ids) ? dialog.ids : [], is_removed: true });
              }}
              disabled={bulkSaving}
            >
              <Flex align="center" gap="2">
                <Icon icon={dialog.action === 'approve' ? CheckCircle2 : dialog.action === 'reject' ? XCircle : dialog.action === 'restore' ? RefreshCcw : Trash2} size={16} />
                <Text as="span" size="2">
                  {t('confirm')}
                </Text>
              </Flex>
            </Button>
          </div>
        }
      >
        <Text size="2" color="gray">
          {dialog.action === 'remove'
            ? t('moderation_remove_help')
            : dialog.action === 'restore'
              ? t('moderation_restore_help')
              : t('moderation_dialog_help')}
        </Text>
      </Dialog>
    </Flex>
  );
}
