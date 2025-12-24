import { useEffect, useMemo, useState } from 'react';
import { Box, Callout, Flex, Heading, Spinner, Text } from '@radix-ui/themes';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, Flag, Image as ImageIcon, MapPin, RefreshCcw, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { InlineError } from '../ui/InlineError';
import { Skeleton } from '../ui/Skeleton';
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

  const [dialog, setDialog] = useState({ open: false, listing: null, action: null, ids: [] });
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [showFlagged, setShowFlagged] = useState(false);

  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [detailsById, setDetailsById] = useState(() => ({}));
  const [detailsLoadingIds, setDetailsLoadingIds] = useState(() => new Set());
  const [detailsErrorById, setDetailsErrorById] = useState(() => ({}));

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = mode === 'reports'
        ? await api.reports({ status: 'open' })
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

  const listingResults = useMemo(() => (mode === 'listings' ? data?.results || [] : []), [data, mode]);
  const reportResults = useMemo(() => (mode === 'reports' ? data?.results || [] : []), [data, mode]);

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

  async function setReportStatus(reportId, status) {
    if (!reportId) return;
    setReportSaving(true);
    try {
      await api.updateReportStatus(reportId, status);
      toast.push({
        title: t('reports_title'),
        description: status === 'resolved' ? t('report_resolved') : t('report_dismissed'),
      });
      await refresh();
    } catch (e) {
      toast.push({ title: t('reports_title'), description: e instanceof ApiError ? e.message : String(e), variant: 'error' });
    } finally {
      setReportSaving(false);
    }
  }

  return (
    <Flex direction="column" gap="5">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading size="5">{t('moderation_title')}</Heading>
        <Flex align="center" gap="2" wrap="wrap">
          <Button size="sm" variant={mode === 'listings' ? 'primary' : 'secondary'} onClick={() => setMode('listings')}>
            {t('moderation_mode_listings')}
          </Button>
          <Button size="sm" variant={mode === 'reports' ? 'primary' : 'secondary'} onClick={() => setMode('reports')}>
            {t('moderation_mode_reports')}
          </Button>
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

      {mode === 'reports' ? (
        <Card>
          <CardHeader>
            <Text size="2" color="gray">{t('reports_open')}</Text>
          </CardHeader>
          <CardBody>
            <InlineError error={error instanceof ApiError ? error : error} onRetry={() => setReloadNonce((n) => n + 1)} />

            {loading ? (
              <Flex direction="column" gap="3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </Flex>
            ) : reportResults.length ? (
              <Flex direction="column" gap="3">
                {reportResults.map((r) => (
                  <div key={r.id} className="rounded-lg border border-[var(--gray-a5)] bg-[var(--color-panel-solid)] p-4">
                    <Flex align="start" justify="between" gap="3" wrap="wrap">
                      <div style={{ minWidth: 0 }}>
                        <Text weight="bold" size="2" style={{ wordBreak: 'break-word' }}>
                          {reportReasonLabel(r.reason)}
                        </Text>
                        <Text size="2" color="gray">
                          {t('reported_by', { user: r.reporter_username || r.reporter })} · {formatDate(r.created_at)}
                        </Text>
                        <div className="mt-2">
                          <Link to={`/listings/${r.listing}`} className="hover:underline">
                            {t('report_view_listing')}{r.listing_title ? ` · ${r.listing_title}` : ''}
                          </Link>
                        </div>
                        {r.message ? (
                          <Text size="2" className="mt-2" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {r.message}
                          </Text>
                        ) : null}
                      </div>

                      <Flex align="center" gap="2" wrap="wrap">
                        <Button size="sm" onClick={() => setReportStatus(r.id, 'resolved')} disabled={reportSaving}>
                          {t('resolve')}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setReportStatus(r.id, 'dismissed')} disabled={reportSaving}>
                          {t('dismiss')}
                        </Button>
                      </Flex>
                    </Flex>
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

      {mode === 'reports' ? null : (
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
              <Box p={{ initial: '4', sm: '5' }}>
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
                  <Box p={{ initial: '5', sm: '6' }}>
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
            <Flex direction="column" gap="5" mt="3">
              {listingResults.map((r) => (
              <Card key={r.id}>
                <Box p={{ initial: '5', sm: '6' }}>
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
                      {r.thumbnail ? (
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-[var(--gray-a5)] bg-[var(--color-panel-solid)] sm:h-20 sm:w-20">
                          <img src={r.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                        </div>
                      ) : null}

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
                                    href={img.image}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="h-16 w-16 overflow-hidden rounded-md border border-[var(--gray-a5)] bg-[var(--color-panel-solid)]"
                                  >
                                    <img src={img.image} alt={img.alt_text || ''} className="h-full w-full object-cover" loading="lazy" />
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
      )}

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
