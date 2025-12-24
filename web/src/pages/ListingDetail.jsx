import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Box, Flex, Grid, Heading, Link as RTLink, Text } from '@radix-ui/themes';
import { ArrowLeft, ArrowRight, Link2, MessageSquareText } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { InlineError } from '../ui/InlineError';
import { Skeleton } from '../ui/Skeleton';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { formatDate, formatMoney } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../ui/Toast';
import { useI18n } from '../i18n/i18n';
import { FavoriteButton } from '../ui/FavoriteButton';
import { pushRecentlyViewed } from '../lib/recentlyViewed';
import { addCompareId, formatIdsParam } from '../lib/compare';
import { addWatch, isWatched, removeWatch, updateWatchSnapshotFromListing } from '../lib/watchlist';
import { followSeller, isFollowingSeller, unfollowSeller } from '../lib/following';

function moderationBadgeVariant(m) {
  if (m === 'approved') return 'ok';
  if (m === 'pending') return 'warn';
  if (m === 'rejected') return 'danger';
  return 'default';
}

export function ListingDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();
  const { t, dir } = useI18n();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [images, setImages] = useState([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const dragIdRef = useRef(null);
  const imageElRefs = useRef(new Map());
  const prevRectsRef = useRef(null);

  const displayImages = useMemo(() => {
    const src = isOwner ? images : data?.images;
    return Array.isArray(src) ? src : [];
  }, [isOwner, images, data?.images]);

  const [focusedImageId, setFocusedImageId] = useState(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  useEffect(() => {
    if (!displayImages.length) {
      setFocusedImageId(null);
      return;
    }
    if (!focusedImageId || !displayImages.some((img) => img.id === focusedImageId)) {
      setFocusedImageId(displayImages[0].id);
    }
  }, [displayImages, focusedImageId]);

  const focusedImage = useMemo(() => {
    if (!displayImages.length) return null;
    return displayImages.find((img) => img.id === focusedImageId) || displayImages[0];
  }, [displayImages, focusedImageId]);

  const [editDraft, setEditDraft] = useState(null);
  const [savingListing, setSavingListing] = useState(false);

  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadAlt, setUploadAlt] = useState('');
  const [uploading, setUploading] = useState(false);

  const [questions, setQuestions] = useState([]);
  const [qLoading, setQLoading] = useState(false);
  const [qError, setQError] = useState(null);
  const [qDraft, setQDraft] = useState('');
  const [asking, setAsking] = useState(false);
  const [answeringId, setAnsweringId] = useState(null);
  const [answerDrafts, setAnswerDrafts] = useState(() => new Map());

  const isOwner = !!user && !!data && data.seller_id === user.id;
  const [watchNonce, setWatchNonce] = useState(0);
  const watched = useMemo(() => (data?.id ? isWatched(data.id) : false), [data?.id, watchNonce]);

  const sellerId = data?.seller_id;
  const sellerName = data?.seller_username || data?.seller_id;
  const [followNonce, setFollowNonce] = useState(0);
  const isFollowing = useMemo(() => (sellerId ? isFollowingSeller(sellerId) : false), [sellerId, followNonce]);

  function toggleFollow() {
    if (!sellerId) return;
    if (isFollowing) {
      unfollowSeller(sellerId);
      toast.push({ title: t('following_title'), description: t('follow_removed') });
      setFollowNonce((n) => n + 1);
      return;
    }
    followSeller({ id: sellerId, username: sellerName });
    toast.push({ title: t('following_title'), description: t('follow_added') });
    setFollowNonce((n) => n + 1);
  }

  useEffect(() => {
    if (!data?.id) return;
    pushRecentlyViewed({
      id: data.id,
      title: data.title,
      price: data.price,
      currency: data.currency,
      thumbnail: data.thumbnail,
    });
  }, [data?.id]);

  function measureImageRects() {
    const m = new Map();
    for (const [key, el] of imageElRefs.current.entries()) {
      if (!el) continue;
      m.set(key, el.getBoundingClientRect());
    }
    return m;
  }

  useLayoutEffect(() => {
    if (!prevRectsRef.current) return;
    const prev = prevRectsRef.current;
    prevRectsRef.current = null;
    const next = measureImageRects();
    for (const [key, el] of imageElRefs.current.entries()) {
      if (!el) continue;
      const a = prev.get(key);
      const b = next.get(key);
      if (!a || !b) continue;
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (dx === 0 && dy === 0) continue;
      try {
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
          { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
        );
      } catch {
        // ignore animation failures
      }
    }
  }, [images]);

  function moderationLabel(code) {
    if (!code) return '';
    const key = `moderation_status_${code}`;
    const translated = t(key);
    return translated === key ? String(code) : translated;
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.listing(id, { auth: isAuthenticated });
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
  }, [id, isAuthenticated, reloadNonce]);

  useEffect(() => {
    // Initialize editable image order when the listing changes.
    if (data?.id) {
      setImages(Array.isArray(data.images) ? data.images : []);
    }
  }, [data?.id]);

  useEffect(() => {
    // Initialize edit form draft when listing loads/changes.
    if (!data?.id) {
      setEditDraft(null);
      return;
    }
    setEditDraft({
      title: data.title || '',
      description: data.description || '',
      price: data.price ?? '',
      currency: data.currency || 'USD',
      status: data.status || 'draft',
    });
  }, [data?.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadQuestions() {
      if (!data?.id) return;
      setQLoading(true);
      setQError(null);
      try {
        const res = await api.listingQuestions(data.id, { auth: isAuthenticated });
        if (!cancelled) setQuestions(Array.isArray(res) ? res : []);
      } catch (e) {
        if (!cancelled) setQError(e);
      } finally {
        if (!cancelled) setQLoading(false);
      }
    }
    loadQuestions();
    return () => {
      cancelled = true;
    };
  }, [data?.id, isAuthenticated]);

  async function saveImageOrder(nextImages) {
    if (!isOwner) return;
    if (!nextImages || nextImages.length < 2) return;
    setSavingOrder(true);
    try {
      const order = nextImages.map((img) => img.id);
      const res = await api.reorderListingImages(id, order);
      // Backend returns the images list.
      setImages(Array.isArray(res) ? res : nextImages);
      setData((prev) => {
        if (!prev) return prev;
        return { ...prev, images: Array.isArray(res) ? res : nextImages, moderation_status: 'pending' };
      });
      toast.push({ title: t('detail_images'), description: t('toast_reorderSaved') });
    } catch (e) {
      toast.push({
        title: t('detail_images'),
        description: `${t('toast_reorderFailed')}: ${e instanceof ApiError ? e.message : String(e)}`,
        variant: 'error',
      });
    } finally {
      setSavingOrder(false);
    }
  }

  function moveImageTo(dragId, targetId) {
    if (!dragId || !targetId || dragId === targetId) return;
    prevRectsRef.current = measureImageRects();
    setImages((prev) => {
      const from = prev.findIndex((p) => p.id === dragId);
      const to = prev.findIndex((p) => p.id === targetId);
      if (from < 0 || to < 0 || from === to) return prev;
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      // Fire-and-forget save, but keep order changes visible immediately.
      queueMicrotask(() => saveImageOrder(copy));
      return copy;
    });
  }

  async function messageSeller() {
    try {
      const thread = await api.createThread(Number(id));
      toast.push({ title: t('toast_threadCreated'), description: t('toast_openingMessages') });
      nav(`/threads/${thread.id}`);
    } catch (e) {
      toast.push({ title: t('toast_couldNotMessageSeller'), description: e instanceof ApiError ? e.message : String(e), variant: 'error' });
    }
  }

  async function copyLink() {
    try {
      const url = window.location.href;
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for older browsers
        window.prompt(t('copy_link_prompt'), url);
      }
      toast.push({ title: t('copied'), description: t('copy_link_done') });
    } catch (e) {
      toast.push({ title: t('copy_link_failed'), description: String(e?.message || e), variant: 'error' });
    }
  }

  function addToCompare() {
    const nextIds = addCompareId(Number(id));
    toast.push({ title: t('compare_title'), description: t('compare_added') });
    nav(`/compare?ids=${encodeURIComponent(formatIdsParam(nextIds))}`);
  }

  function toggleWatch() {
    if (!data?.id) return;
    if (watched) {
      removeWatch(data.id);
      toast.push({ title: t('watchlist_title'), description: t('watch_removed') });
      setWatchNonce((n) => n + 1);
      return;
    }
    addWatch(data.id, { lastPrice: data.price, lastCurrency: data.currency });
    toast.push({ title: t('watchlist_title'), description: t('watch_added') });
    setWatchNonce((n) => n + 1);
  }

  useEffect(() => {
    if (!data?.id) return;
    if (!watched) return;
    updateWatchSnapshotFromListing(data);
  }, [data, watched]);

  function listingStatusLabel(code) {
    if (!code) return '';
    const key = `status_${code}`;
    const translated = t(key);
    return translated === key ? String(code) : translated;
  }

  async function saveListingEdits() {
    if (!isOwner || !editDraft) return;
    setSavingListing(true);
    try {
      const payload = {
        title: String(editDraft.title || '').trim(),
        description: String(editDraft.description || '').trim(),
        currency: editDraft.currency || 'USD',
        status: editDraft.status || 'draft',
      };

      const rawPrice = editDraft.price;
      if (rawPrice === '' || rawPrice === null || rawPrice === undefined) payload.price = null;
      else {
        const n = Number(rawPrice);
        if (!Number.isFinite(n) || n < 0) throw new ApiError(t('invalid'), { status: 400 });
        payload.price = n;
      }

      const updated = await api.updateListing(id, payload);
      setData((prev) => (prev ? { ...prev, ...updated } : updated));
      toast.push({ title: t('detail_manage'), description: t('toast_saved') });
    } catch (e) {
      toast.push({
        title: t('detail_manage'),
        description: e instanceof ApiError ? e.message : String(e),
        variant: 'error',
      });
    } finally {
      setSavingListing(false);
    }
  }

  async function uploadImages() {
    if (!isOwner || !data?.id || !uploadFiles.length) return;
    setUploading(true);
    try {
      let nextSort = Array.isArray(images) ? images.length : 0;
      const created = [];
      for (const file of uploadFiles) {
        const img = await api.uploadListingImage(id, {
          file,
          alt_text: uploadAlt || '',
          sort_order: nextSort,
        });
        created.push(img);
        nextSort += 1;
      }

      setImages((prev) => {
        const arr = Array.isArray(prev) ? prev : [];
        return [...arr, ...created];
      });
      setData((prev) => {
        if (!prev) return prev;
        const prevImages = Array.isArray(prev.images) ? prev.images : [];
        return { ...prev, images: [...prevImages, ...created], moderation_status: 'pending' };
      });

      setUploadFiles([]);
      setUploadAlt('');
      toast.push({ title: t('detail_images'), description: t('toast_uploaded') });
    } catch (e) {
      toast.push({
        title: t('detail_images'),
        description: `${t('toast_uploadFailed')}: ${e instanceof ApiError ? e.message : String(e)}`,
        variant: 'error',
      });
    } finally {
      setUploading(false);
    }
  }

  function moveImageById(imageId, delta) {
    if (!isOwner) return;
    prevRectsRef.current = measureImageRects();
    setImages((prev) => {
      const from = prev.findIndex((p) => p.id === imageId);
      if (from < 0) return prev;
      const to = from + delta;
      if (to < 0 || to >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      queueMicrotask(() => saveImageOrder(copy));
      return copy;
    });
  }

  async function deleteImage(imageId) {
    if (!isOwner || !imageId) return;
    const ok = window.confirm(t('detail_deleteImageConfirm'));
    if (!ok) return;
    try {
      await api.deleteListingImage(id, imageId);
      setImages((prev) => (Array.isArray(prev) ? prev.filter((x) => x.id !== imageId) : prev));
      setData((prev) => {
        if (!prev) return prev;
        const prevImages = Array.isArray(prev.images) ? prev.images : [];
        return { ...prev, images: prevImages.filter((x) => x.id !== imageId), moderation_status: 'pending' };
      });
      toast.push({ title: t('detail_images'), description: t('toast_imageDeleted') });
    } catch (e) {
      toast.push({
        title: t('detail_images'),
        description: `${t('toast_imageDeleteFailed')}: ${e instanceof ApiError ? e.message : String(e)}`,
        variant: 'error',
      });
    }
  }

  async function askQuestion() {
    if (!data?.id || !isAuthenticated) return;
    const q = String(qDraft || '').trim();
    if (!q) return;
    setAsking(true);
    try {
      const created = await api.askListingQuestion(data.id, { question: q });
      setQuestions((prev) => [created, ...(Array.isArray(prev) ? prev : [])]);
      setQDraft('');
      toast.push({ title: t('detail_questions'), description: t('toast_questionSent') });
    } catch (e) {
      toast.push({
        title: t('detail_questions'),
        description: e instanceof ApiError ? e.message : String(e),
        variant: 'error',
      });
    } finally {
      setAsking(false);
    }
  }

  async function answerQuestion(questionId) {
    if (!questionId || !isOwner) return;
    const answer = String(answerDrafts.get(questionId) || '').trim();
    if (!answer) return;
    setAnsweringId(questionId);
    try {
      const updated = await api.answerQuestion(questionId, { answer });
      setQuestions((prev) => (Array.isArray(prev) ? prev.map((x) => (x.id === questionId ? updated : x)) : prev));
      setAnswerDrafts((prev) => {
        const next = new Map(prev);
        next.delete(questionId);
        return next;
      });
      toast.push({ title: t('detail_questions'), description: t('toast_answerSaved') });
    } catch (e) {
      toast.push({
        title: t('detail_questions'),
        description: e instanceof ApiError ? e.message : String(e),
        variant: 'error',
      });
    } finally {
      setAnsweringId(null);
    }
  }

  return (
    <Flex direction="column" gap="5">
      <RTLink asChild underline="none" highContrast>
        <Link to="/listings">
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
          <Flex align="start" justify="between" gap="4" wrap="wrap">
            <Flex direction="column" gap="1" style={{ minWidth: 0 }}>
              <Heading size="5" style={{ wordBreak: 'break-word' }}>
                {data?.title ? data.title : loading ? <Skeleton className="h-6 w-72 max-w-full" /> : t('listings_title')}
              </Heading>
              {data ? (
                <Text size="3">{formatMoney(data.price, data.currency)}</Text>
              ) : loading ? (
                <Skeleton className="mt-2 h-5 w-40" />
              ) : null}
            </Flex>

            <Flex direction="column" align="end" gap="2" style={{ marginLeft: 'auto' }}>
              {data?.moderation_status ? (
                <Badge variant={moderationBadgeVariant(data.moderation_status)}>{moderationLabel(data.moderation_status)}</Badge>
              ) : null}

              {data?.id ? (
                <Flex align="center" gap="2" wrap="wrap" justify="end">
                  <FavoriteButton listingId={data.id} />
                  <Button variant="secondary" size="sm" onClick={copyLink}>
                    <Flex align="center" gap="2">
                      <Icon icon={Link2} size={14} />
                      <Text as="span" size="2">
                        {t('copy_link')}
                      </Text>
                    </Flex>
                  </Button>
                  <Button variant="secondary" size="sm" onClick={addToCompare}>
                    <Text as="span" size="2">
                      {t('compare_add')}
                    </Text>
                  </Button>
                  <Button variant="secondary" size="sm" onClick={toggleWatch}>
                    <Text as="span" size="2">
                      {watched ? t('watch_remove') : t('watch_add')}
                    </Text>
                  </Button>
                  {isAuthenticated ? (
                    <RTLink asChild underline="none">
                      <Link to={`/reports/new?listing=${data.id}`}>
                        <Button variant="secondary" size="sm">
                          <Text as="span" size="2">
                            {t('report')}
                          </Text>
                        </Button>
                      </Link>
                    </RTLink>
                  ) : (
                    <RTLink asChild underline="none">
                      <Link to="/login" state={{ from: `/listings/${id}` }}>
                        <Button variant="secondary" size="sm">
                          <Text as="span" size="2">
                            {t('login_to_report')}
                          </Text>
                        </Button>
                      </Link>
                    </RTLink>
                  )}
                </Flex>
              ) : null}
            </Flex>
          </Flex>
        </CardHeader>
        <CardBody>
          <InlineError error={error instanceof ApiError ? error : error} onRetry={() => setReloadNonce((n) => n + 1)} />

          {loading && !data ? (
            <Flex direction="column" gap="4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-10 w-64" />
              <div className="overflow-hidden rounded-lg border border-[var(--gray-a5)] bg-[var(--color-panel-solid)]">
                <Skeleton className="h-72 w-full sm:h-96" />
              </div>
              <Flex gap="2" wrap="nowrap" className="overflow-x-auto pb-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-16 shrink-0 rounded-md" />
                ))}
              </Flex>
            </Flex>
          ) : null}

          {data ? (
            <Flex direction="column" gap="4">
              <Dialog
                open={imageDialogOpen}
                onOpenChange={setImageDialogOpen}
                title={t('image_preview')}
                maxWidth="900px"
              >
                {focusedImage ? (
                  <Flex direction="column" gap="3">
                    <div className="overflow-hidden rounded-lg border border-[var(--gray-a5)] bg-[var(--color-panel-solid)]">
                      <img
                        src={focusedImage.image}
                        alt={focusedImage.alt_text || ''}
                        className="max-h-[70vh] w-full object-contain"
                      />
                    </div>
                    {displayImages.length > 1 ? (
                      <Flex gap="2" wrap="nowrap" className="overflow-x-auto pb-1">
                        {displayImages.map((img) => {
                          const selected = focusedImage && img.id === focusedImage.id;
                          return (
                            <button
                              key={img.id}
                              type="button"
                              className={
                                `h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-[var(--color-panel-solid)] ` +
                                (selected ? 'border-[var(--accent-a8)]' : 'border-[var(--gray-a5)]')
                              }
                              onClick={() => setFocusedImageId(img.id)}
                              aria-label={img.alt_text || t('image_preview')}
                            >
                              <img src={img.image} alt={img.alt_text || ''} className="h-full w-full object-cover" loading="lazy" />
                            </button>
                          );
                        })}
                      </Flex>
                    ) : null}
                  </Flex>
                ) : null}
              </Dialog>

              <Grid columns={{ initial: '1', md: '2' }} gap="5" align="start">
                <Flex direction="column" gap="4" style={{ minWidth: 0 }}>
                  <Text size="2">
                    {data.description ? data.description : <Text as="span" color="gray">{t('detail_noDescription')}</Text>}
                  </Text>

                  <Grid gap="2">
                    <Flex align="center" gap="2" wrap="wrap">
                      <Text size="2">
                        <Text as="span" color="gray">
                          {t('detail_seller')}:
                        </Text>{' '}
                        <RTLink asChild underline="always" highContrast>
                          <Link to={`/sellers/${data.seller_id}`}>
                            {data.seller_username || data.seller_id}
                          </Link>
                        </RTLink>
                      </Text>
                      {isAuthenticated && sellerId && !isOwner ? (
                        <Button size="sm" variant="secondary" onClick={toggleFollow}>
                          {isFollowing ? t('unfollow') : t('follow')}
                        </Button>
                      ) : null}
                    </Flex>
                    <Text size="2">
                      <Text as="span" color="gray">
                        {t('detail_location')}:
                      </Text>{' '}
                      {data.governorate?.name_ar || data.governorate?.name_en}
                      {' · '}
                      {data.city?.name_ar || data.city?.name_en}
                      {data.neighborhood ? ` · ${data.neighborhood?.name_ar || data.neighborhood?.name_en}` : ''}
                    </Text>
                    <Text size="2">
                      <Text as="span" color="gray">
                        {t('detail_created')}:
                      </Text>{' '}
                      {formatDate(data.created_at)}
                    </Text>
                  </Grid>

                  <Flex gap="2" wrap="wrap">
                    {isAuthenticated ? (
                      <Button onClick={messageSeller}>
                        <Flex align="center" gap="2">
                          <Icon icon={MessageSquareText} size={16} />
                          <Text as="span" size="2">
                            {t('detail_messageSeller')}
                          </Text>
                        </Flex>
                      </Button>
                    ) : (
                      <RTLink asChild underline="none">
                        <Link to="/login" state={{ from: `/listings/${id}` }}>
                          <Button>
                            <Flex align="center" gap="2">
                              <Icon icon={MessageSquareText} size={16} />
                              <Text as="span" size="2">
                                {t('login_to_message')}
                              </Text>
                            </Flex>
                          </Button>
                        </Link>
                      </RTLink>
                    )}
                  </Flex>
                </Flex>

                <Box>
                  <Flex align="center" justify="between" gap="3" wrap="wrap">
                    <Heading size="3">{t('detail_images')}</Heading>
                    {isOwner && displayImages.length > 1 ? (
                      <Text size="2" color="gray">
                        {savingOrder ? t('loading') : t('detail_dragToReorder')}
                      </Text>
                    ) : null}
                  </Flex>

                  {focusedImage ? (
                    <Flex direction="column" gap="3" mt="3">
                      <button
                        type="button"
                        className="overflow-hidden rounded-lg border border-[var(--gray-a5)] bg-[var(--color-panel-solid)]"
                        onClick={() => setImageDialogOpen(true)}
                        aria-label={t('open_image_preview')}
                      >
                        <img
                          src={focusedImage.image}
                          alt={focusedImage.alt_text || ''}
                          className="h-72 w-full object-contain sm:h-96"
                          loading="lazy"
                        />
                      </button>

                      {displayImages.length > 1 ? (
                        <Flex gap="2" wrap="nowrap" className="overflow-x-auto pb-1">
                          {displayImages.map((img) => {
                            const selected = img.id === focusedImage.id;
                            return (
                              <button
                                key={img.id}
                                type="button"
                                className={
                                  `h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-[var(--color-panel-solid)] ` +
                                  (selected ? 'border-[var(--accent-a8)]' : 'border-[var(--gray-a5)]')
                                }
                                onClick={() => setFocusedImageId(img.id)}
                                draggable={isOwner}
                                onDragStart={() => {
                                  if (!isOwner) return;
                                  dragIdRef.current = img.id;
                                }}
                                onDragOver={(e) => {
                                  if (!isOwner) return;
                                  e.preventDefault();
                                }}
                                onDrop={(e) => {
                                  if (!isOwner) return;
                                  e.preventDefault();
                                  moveImageTo(dragIdRef.current, img.id);
                                  dragIdRef.current = null;
                                }}
                                onDragEnd={() => {
                                  dragIdRef.current = null;
                                }}
                                aria-label={img.alt_text || t('image_preview')}
                              >
                                <img
                                  src={img.image}
                                  alt={img.alt_text || ''}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              </button>
                            );
                          })}
                        </Flex>
                      ) : null}

                      {isOwner && focusedImage ? (
                        <Flex gap="2" wrap="wrap">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => moveImageById(focusedImage.id, -1)}
                            disabled={savingOrder || displayImages.findIndex((x) => x.id === focusedImage.id) <= 0}
                          >
                            {t('move_up')}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => moveImageById(focusedImage.id, 1)}
                            disabled={
                              savingOrder ||
                              displayImages.findIndex((x) => x.id === focusedImage.id) >= displayImages.length - 1
                            }
                          >
                            {t('move_down')}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => deleteImage(focusedImage.id)}
                            disabled={uploading || savingOrder}
                          >
                            {t('remove')}
                          </Button>
                        </Flex>
                      ) : null}

                      {isOwner ? (
                        <Card>
                          <Box p={{ initial: '4', sm: '5' }}>
                            <Flex direction="column" gap="2">
                              <Text size="2" color="gray">
                                {t('detail_uploadImage')}
                              </Text>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                              />
                              <Input
                                placeholder={t('create_photos_alt_optional')}
                                value={uploadAlt}
                                onChange={(e) => setUploadAlt(e.target.value)}
                              />
                              <Flex gap="2" wrap="wrap">
                                <Button size="sm" onClick={uploadImages} disabled={uploading || uploadFiles.length === 0}>
                                  {uploading ? t('loading') : t('detail_upload')}
                                </Button>
                              </Flex>
                            </Flex>
                          </Box>
                        </Card>
                      ) : null}
                    </Flex>
                  ) : (
                    <Text size="2" color="gray" mt="3">
                      {t('detail_noImages')}
                    </Text>
                  )}
                </Box>
              </Grid>

              {isOwner && editDraft ? (
                <Card>
                  <CardHeader>
                    <Heading size="3">{t('detail_manage')}</Heading>
                  </CardHeader>
                  <CardBody>
                    <Grid columns={{ initial: '1', sm: '2' }} gap="3">
                      <Box>
                        <Text size="2" color="gray">
                          {t('create_title_label')}
                        </Text>
                        <Input
                          value={editDraft.title}
                          onChange={(e) => setEditDraft((p) => ({ ...p, title: e.target.value }))}
                        />
                      </Box>
                      <Box>
                        <Text size="2" color="gray">
                          {t('create_status')}
                        </Text>
                        <Select
                          value={editDraft.status}
                          onChange={(e) => setEditDraft((p) => ({ ...p, status: e.target.value }))}
                        >
                          <option value="draft">{listingStatusLabel('draft')}</option>
                          <option value="published">{listingStatusLabel('published')}</option>
                          <option value="archived">{listingStatusLabel('archived')}</option>
                        </Select>
                      </Box>
                      <Box style={{ gridColumn: '1 / -1' }}>
                        <Text size="2" color="gray">
                          {t('create_description_label')}
                        </Text>
                        <Textarea
                          value={editDraft.description}
                          onChange={(e) => setEditDraft((p) => ({ ...p, description: e.target.value }))}
                          rows={4}
                        />
                      </Box>
                      <Box>
                        <Text size="2" color="gray">
                          {t('create_price')}
                        </Text>
                        <Input
                          inputMode="decimal"
                          value={editDraft.price}
                          onChange={(e) => setEditDraft((p) => ({ ...p, price: e.target.value }))}
                        />
                      </Box>
                      <Box>
                        <Text size="2" color="gray">
                          {t('create_currency')}
                        </Text>
                        <Input
                          value={editDraft.currency}
                          onChange={(e) => setEditDraft((p) => ({ ...p, currency: e.target.value }))}
                        />
                      </Box>
                    </Grid>

                    <Flex gap="2" mt="3" wrap="wrap">
                      <Button onClick={saveListingEdits} disabled={savingListing}>
                        {savingListing ? t('loading') : t('save')}
                      </Button>
                    </Flex>
                  </CardBody>
                </Card>
              ) : null}

              <Card>
                <CardHeader>
                  <Heading size="3">{t('detail_questions')}</Heading>
                </CardHeader>
                <CardBody>
                  <InlineError error={qError instanceof ApiError ? qError : qError} />

                  {qLoading ? (
                    <Flex direction="column" gap="2">
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-4 w-3/5" />
                      <Skeleton className="h-4 w-2/3" />
                    </Flex>
                  ) : null}

                  {!qLoading && (!questions || questions.length === 0) ? (
                    <Text size="2" color="gray">
                      {t('detail_noQuestions')}
                    </Text>
                  ) : null}

                  {!qLoading && Array.isArray(questions) && questions.length ? (
                    <Flex direction="column" gap="3">
                      {questions.map((q) => {
                        const hasAnswer = !!q.answer;
                        const answerDraft = answerDrafts.get(q.id) || '';
                        return (
                          <Card key={q.id}>
                            <Box p={{ initial: '4', sm: '5' }}>
                              <Flex direction="column" gap="2">
                                <Text weight="bold" size="2">
                                  {q.question}
                                </Text>
                                {hasAnswer ? (
                                  <Text size="2">{q.answer}</Text>
                                ) : isOwner ? (
                                  <Flex direction="column" gap="2">
                                    <Text size="2" color="gray">
                                      {t('detail_answerPrompt')}
                                    </Text>
                                    <Textarea
                                      value={answerDraft}
                                      onChange={(e) =>
                                        setAnswerDrafts((prev) => {
                                          const next = new Map(prev);
                                          next.set(q.id, e.target.value);
                                          return next;
                                        })
                                      }
                                      rows={3}
                                    />
                                    <Flex gap="2" wrap="wrap">
                                      <Button
                                        size="sm"
                                        onClick={() => answerQuestion(q.id)}
                                        disabled={answeringId === q.id}
                                      >
                                        {answeringId === q.id ? t('loading') : t('detail_saveAnswer')}
                                      </Button>
                                    </Flex>
                                  </Flex>
                                ) : (
                                  <Text size="2" color="gray">
                                    {t('detail_unanswered')}
                                  </Text>
                                )}
                              </Flex>
                            </Box>
                          </Card>
                        );
                      })}
                    </Flex>
                  ) : null}

                  {isAuthenticated ? (
                    <Box mt="4">
                      <Text size="2" color="gray">
                        {t('detail_askQuestion')}
                      </Text>
                      <Textarea value={qDraft} onChange={(e) => setQDraft(e.target.value)} rows={3} />
                      <Flex gap="2" mt="2" wrap="wrap">
                        <Button size="sm" onClick={askQuestion} disabled={asking || !String(qDraft || '').trim()}>
                          {asking ? t('loading') : t('detail_sendQuestion')}
                        </Button>
                      </Flex>
                    </Box>
                  ) : (
                    <Text size="2" color="gray" mt="3">
                      {t('detail_loginToAsk')}
                    </Text>
                  )}
                </CardBody>
              </Card>

            </Flex>
          ) : null}
        </CardBody>
      </Card>
    </Flex>
  );
}
