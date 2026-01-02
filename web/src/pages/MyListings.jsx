import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Flex, Grid, Heading, Link as RTLink, Text } from '@radix-ui/themes';
import { PackageOpen, PlusCircle } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { formatDate, formatMoney } from '../lib/format';
import { Icon } from '../ui/Icon';
import { InlineError } from '../ui/InlineError';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toast';
import { ListingThumbnail } from '../ui/ListingThumbnail';
import { useI18n } from '../i18n/i18n';

function moderationBadgeVariant(m) {
  if (m === 'approved') return 'ok';
  if (m === 'pending') return 'warn';
  if (m === 'rejected') return 'danger';
  return 'default';
}

export function MyListingsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [statusDrafts, setStatusDrafts] = useState(() => ({}));
  const [savingIds, setSavingIds] = useState(() => new Set());

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  const [editingIds, setEditingIds] = useState(() => new Set());
  const [editDrafts, setEditDrafts] = useState(() => ({}));

  function moderationLabel(code) {
    if (!code) return '';
    const key = `moderation_status_${code}`;
    const translated = t(key);
    return translated === key ? String(code) : translated;
  }

  function listingStatusLabel(code) {
    if (!code) return '';
    const key = `status_${code}`;
    const translated = t(key);
    return translated === key ? String(code) : translated;
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.myListings();
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
  }, [reloadNonce]);

  useEffect(() => {
    const results = data?.results || [];
    if (!Array.isArray(results) || results.length === 0) return;
    setStatusDrafts((prev) => {
      const next = { ...prev };
      for (const r of results) {
        if (!r?.id) continue;
        if (next[r.id] === undefined) next[r.id] = r.status;
      }
      return next;
    });
  }, [data?.results]);

  async function saveStatus(listingId) {
    const desired = statusDrafts[listingId];
    if (!desired) return;
    setSavingIds((prev) => {
      const next = new Set(prev);
      next.add(listingId);
      return next;
    });
    try {
      await api.updateListing(listingId, { status: desired });
      setData((prev) => {
        if (!prev) return prev;
        const results = prev.results;
        if (!Array.isArray(results)) return prev;
        return {
          ...prev,
          results: results.map((r) => (r.id === listingId ? { ...r, status: desired } : r)),
        };
      });
      toast.push({ title: t('my_quickEdit'), description: t('toast_saved') });
    } catch (e) {
      toast.push({
        title: t('my_quickEdit'),
        description: e instanceof ApiError ? e.message : String(e),
        variant: 'error',
      });
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(listingId);
        return next;
      });
    }
  }

  function startEdit(listing) {
    if (!listing?.id) return;
    setEditDrafts((prev) => ({
      ...prev,
      [listing.id]: {
        title: listing.title ?? '',
        price: listing.price ?? '',
        currency: listing.currency ?? 'USD',
      },
    }));
    setEditingIds((prev) => {
      const next = new Set(prev);
      next.add(listing.id);
      return next;
    });
  }

  function cancelEdit(listingId) {
    setEditingIds((prev) => {
      const next = new Set(prev);
      next.delete(listingId);
      return next;
    });
    setEditDrafts((prev) => {
      const next = { ...prev };
      delete next[listingId];
      return next;
    });
  }

  async function saveEdits(listingId) {
    const draft = editDrafts[listingId];
    if (!draft) return;

    setSavingIds((prev) => {
      const next = new Set(prev);
      next.add(listingId);
      return next;
    });

    try {
      const payload = {
        title: String(draft.title || '').trim(),
        currency: String(draft.currency || '').trim() || 'USD',
      };

      const rawPrice = draft.price;
      if (rawPrice === '' || rawPrice === null || rawPrice === undefined) payload.price = null;
      else {
        const n = Number(rawPrice);
        if (!Number.isFinite(n) || n < 0) throw new ApiError(t('invalid'), { status: 400 });
        payload.price = n;
      }

      const updated = await api.updateListing(listingId, payload);

      setData((prev) => {
        if (!prev) return prev;
        const results = prev.results;
        if (!Array.isArray(results)) return prev;
        return {
          ...prev,
          results: results.map((r) => (r.id === listingId ? { ...r, ...updated } : r)),
        };
      });

      toast.push({ title: t('my_quickEdit'), description: t('toast_saved') });
      cancelEdit(listingId);
    } catch (e) {
      toast.push({
        title: t('my_quickEdit'),
        description: e instanceof ApiError ? e.message : String(e),
        variant: 'error',
      });
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(listingId);
        return next;
      });
    }
  }

  const results = data?.results || [];
  const allIds = Array.isArray(results) ? results.map((r) => r.id).filter(Boolean) : [];
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

  async function applyBulkStatus() {
    if (!bulkStatus || selectedIds.size === 0) return;
    setBulkSaving(true);
    const ids = Array.from(selectedIds);
    try {
      const res = await api.bulkUpdateListings({ ids, data: { status: bulkStatus } });
      const updated = Array.isArray(res?.updated) ? res.updated : [];
      const okIds = updated.map((u) => u.id).filter(Boolean);

      const skipped = Array.isArray(res?.skipped) ? res.skipped : [];
      const notFound = Array.isArray(res?.not_found) ? res.not_found : [];
      const failedIds = new Set([
        ...skipped.map((s) => s?.id).filter(Boolean),
        ...notFound.map((id) => id).filter(Boolean),
      ]);
      const failed = ids.filter((id) => !okIds.includes(id) || failedIds.has(id)).map((id) => ({ id }));

      if (okIds.length) {
        setData((prev) => {
          if (!prev) return prev;
          const prevResults = prev.results;
          if (!Array.isArray(prevResults)) return prev;
          const byId = new Map(updated.map((u) => [u.id, u]));
          return {
            ...prev,
            results: prevResults.map((r) => (byId.has(r.id) ? { ...r, ...byId.get(r.id) } : r)),
          };
        });
        setStatusDrafts((prev) => {
          const next = { ...prev };
          for (const id of okIds) next[id] = bulkStatus;
          return next;
        });
      }

      if (failed.length === 0) {
        toast.push({ title: t('my_bulkUpdate'), description: t('toast_saved') });
        clearSelection();
      } else {
        toast.push({
          title: t('my_bulkUpdate'),
          description: t('toast_bulkPartial', { ok: okIds.length, total: ids.length }),
          variant: 'error',
        });
        // Keep only failed ones selected so user can retry.
        setSelectedIds(new Set(failed.map((f) => f.id)));
      }
    } catch (e) {
      toast.push({ title: t('my_bulkUpdate'), description: e instanceof ApiError ? e.message : String(e), variant: 'error' });
    } finally {
      setBulkSaving(false);
    }
  }

  return (
    <Flex direction="column" gap="4">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading size="5">{t('my_title')}</Heading>
        <RTLink asChild underline="none">
          <Link to="/create">
            <Flex align="center" gap="2">
              <Icon icon={PlusCircle} size={16} className="text-[var(--gray-11)]" aria-label="" />
              <Text size="2" weight="bold">
                {t('my_createNew')}
              </Text>
            </Flex>
          </Link>
        </RTLink>
      </Flex>

      <Card>
        <CardHeader>
          <Text size="2" color="gray">
            {t('my_hint')}
          </Text>
        </CardHeader>
        <CardBody>
          <InlineError error={error instanceof ApiError ? error : error} onRetry={() => setReloadNonce((n) => n + 1)} />

          {!loading && results.length ? (
            <Card className="mb-2">
              <Box p={{ initial: '2', sm: '3' }}>
                <Flex align="center" justify="between" gap="3" wrap="wrap">
                  <Flex align="center" gap="3" wrap="wrap">
                    <div
                      onClick={(e) => {
                        e.preventDefault();
                      }}
                    >
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                        />
                        <Text size="2">{t('my_selectAll')}</Text>
                      </label>
                    </div>

                    <Text size="2" color="gray">
                      {t('my_selectedCount', { count: selectedCount })}
                    </Text>
                  </Flex>

                  <Flex align="center" gap="2" wrap="wrap">
                    <Text size="2" color="gray">
                      {t('my_bulkStatus')}:
                    </Text>
                    <Select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
                      <option value="">{t('select_placeholder')}</option>
                      <option value="draft">{listingStatusLabel('draft')}</option>
                      <option value="published">{listingStatusLabel('published')}</option>
                      <option value="archived">{listingStatusLabel('archived')}</option>
                    </Select>
                    <Button
                      size="sm"
                      onClick={applyBulkStatus}
                      disabled={bulkSaving || selectedCount === 0 || !bulkStatus}
                    >
                      {bulkSaving ? t('loading') : t('my_apply')}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={clearSelection} disabled={selectedCount === 0}>
                      {t('my_clearSelection')}
                    </Button>
                  </Flex>
                </Flex>
              </Box>
            </Card>
          ) : null}

          {loading ? (
            <Flex direction="column" gap="3" mt="3" className="bb-stagger">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <Box p={{ initial: '2', sm: '3' }}>
                    <Flex justify="between" gap="4" align="start" wrap="wrap">
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
                        <Skeleton className="h-6 w-24 rounded-full" />
                      </Flex>
                    </Flex>
                  </Box>
                </Card>
              ))}
            </Flex>
          ) : (
            <Flex direction="column" gap="4" mt="3" className="bb-stagger">
              {results.map((r) => (
              <RTLink key={r.id} asChild underline="none" highContrast>
                <Link to={`/listings/${r.id}`}>
                  <Card className="transition-colors hover:bg-[var(--gray-a2)]">
                    <Box p={{ initial: '2', sm: '3' }}>
                      <Flex justify="between" gap="4" align="start" wrap="wrap">
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
                                aria-label={t('my_selectListing', { id: r.id })}
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
                            {editingIds.has(r.id) ? (
                              <Flex direction="column" gap="2">
                                <div
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                >
                                  <Text size="1" color="gray">{t('create_title_label')}</Text>
                                  <Input
                                    value={editDrafts[r.id]?.title ?? ''}
                                    onChange={(e) =>
                                      setEditDrafts((prev) => ({
                                        ...prev,
                                        [r.id]: { ...prev[r.id], title: e.target.value },
                                      }))
                                    }
                                  />
                                </div>
                                <Grid columns={{ initial: '1', sm: '2' }} gap="2">
                                  <div
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                  >
                                    <Text size="1" color="gray">{t('create_price')}</Text>
                                    <Input
                                      inputMode="decimal"
                                      value={editDrafts[r.id]?.price ?? ''}
                                      onChange={(e) =>
                                        setEditDrafts((prev) => ({
                                          ...prev,
                                          [r.id]: { ...prev[r.id], price: e.target.value },
                                        }))
                                      }
                                    />
                                  </div>
                                  <div
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                  >
                                    <Text size="1" color="gray">{t('create_currency')}</Text>
                                    <Input
                                      value={editDrafts[r.id]?.currency ?? 'USD'}
                                      onChange={(e) =>
                                        setEditDrafts((prev) => ({
                                          ...prev,
                                          [r.id]: { ...prev[r.id], currency: e.target.value },
                                        }))
                                      }
                                    />
                                  </div>
                                </Grid>

                                <Flex gap="2" wrap="wrap">
                                  <div
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                  >
                                    <Button size="sm" onClick={() => saveEdits(r.id)} disabled={savingIds.has(r.id)}>
                                      {savingIds.has(r.id) ? t('loading') : t('save')}
                                    </Button>
                                  </div>
                                  <div
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                  >
                                    <Button size="sm" variant="secondary" onClick={() => cancelEdit(r.id)} disabled={savingIds.has(r.id)}>
                                      {t('cancel')}
                                    </Button>
                                  </div>
                                </Flex>
                              </Flex>
                            ) : (
                              <>
                                <Text weight="bold" size="3" style={{ wordBreak: 'break-word' }}>
                                  {r.title}
                                </Text>
                                <Text size="2">{formatMoney(r.price, r.currency)}</Text>
                                {typeof r.view_count === 'number' || typeof r.messages_count === 'number' || typeof r.favorites_count === 'number' ? (
                                  <Text size="1" color="gray">
                                    Views: {Number.isFinite(r.view_count) ? r.view_count : 0} · Messages: {Number.isFinite(r.messages_count) ? r.messages_count : 0} · Favorites: {Number.isFinite(r.favorites_count) ? r.favorites_count : 0}
                                  </Text>
                                ) : null}
                              </>
                            )}
                            <Text size="1" color="gray">
                              {t('detail_created')}: {formatDate(r.created_at)}
                            </Text>

                            <Flex gap="2" align="center" wrap="wrap" mt="2">
                              <Text size="1" color="gray">
                                {t('my_status')}:
                              </Text>
                              <div
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                              >
                                <Select
                                  value={statusDrafts[r.id] ?? r.status}
                                  onChange={(e) =>
                                    setStatusDrafts((prev) => ({
                                      ...prev,
                                      [r.id]: e.target.value,
                                    }))
                                  }
                                >
                                  <option value="draft">{listingStatusLabel('draft')}</option>
                                  <option value="published">{listingStatusLabel('published')}</option>
                                  <option value="archived">{listingStatusLabel('archived')}</option>
                                </Select>
                              </div>

                              <div
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                              >
                                <Button
                                  size="sm"
                                  onClick={() => saveStatus(r.id)}
                                  disabled={savingIds.has(r.id) || (statusDrafts[r.id] ?? r.status) === r.status}
                                >
                                  {savingIds.has(r.id) ? t('loading') : t('save')}
                                </Button>
                              </div>

                              {!editingIds.has(r.id) ? (
                                <div
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                >
                                  <Button size="sm" variant="secondary" onClick={() => startEdit(r)}>
                                    {t('edit')}
                                  </Button>
                                </div>
                              ) : null}
                            </Flex>
                          </Flex>
                        </Flex>
                        <Flex direction="column" gap="2" align="end">
                          <Badge variant={moderationBadgeVariant(r.moderation_status)}>{moderationLabel(r.moderation_status)}</Badge>
                          <Badge>{listingStatusLabel(r.status)}</Badge>
                        </Flex>
                      </Flex>
                    </Box>
                  </Card>
                </Link>
              </RTLink>
              ))}
              {!loading && results.length === 0 ? (
                <EmptyState icon={PackageOpen}>{t('my_empty')}</EmptyState>
              ) : null}
            </Flex>
          )}
        </CardBody>
      </Card>
    </Flex>
  );
}
