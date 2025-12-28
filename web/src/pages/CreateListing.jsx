import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Callout, Flex, Grid, Heading, Spinner, Text } from '@radix-ui/themes';
import {
  AlignLeft,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Banknote,
  Captions,
  ChevronLeft,
  ChevronRight,
  Images,
  ImagePlus,
  Info,
  LocateFixed,
  MapPin,
  PackageOpen,
  Shapes,
  Tag,
  Trash2,
  Type,
  UploadCloud,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Badge } from '../ui/Badge';
import { useToast } from '../ui/Toast';
import { useI18n } from '../i18n/i18n';
import { useAuth } from '../auth/AuthContext';
import { CategoryCascadeSelect } from '../components/CategoryCascadeSelect';
import { formatAttributeValue, getAttributeChoiceLabel } from '../lib/attributeFormat';
import { buildCategoryIndex } from '../lib/categoryTree';

function toNumberOrNull(v) {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function setCenteredDraftValue(setter, n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return;
  setter(n.toFixed(6));
}

function SyncMapToCenter({ center }) {
  const map = useMap();
  const lastAppliedRef = useRef(null);

  useEffect(() => {
    if (!map) return;
    const lat = Array.isArray(center) ? Number(center[0]) : NaN;
    const lng = Array.isArray(center) ? Number(center[1]) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const last = lastAppliedRef.current;
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    if (last === key) return;
    lastAppliedRef.current = key;

    const cur = map.getCenter();
    const dLat = Math.abs(Number(cur?.lat) - lat);
    const dLng = Math.abs(Number(cur?.lng) - lng);
    if (dLat < 1e-7 && dLng < 1e-7) return;

    map.setView([lat, lng], map.getZoom(), { animate: false });
  }, [map, center]);

  return null;
}

function TrackCenter({ onCenterChange }) {
  const map = useMapEvents({
    moveend() {
      try {
        const c = map.getCenter();
        onCenterChange?.(c.lat, c.lng);
      } catch {
        // ignore
      }
    },
  });
  return null;
}

function getCurrentPositionAsync(options) {
  return new Promise((resolve, reject) => {
    try {
      const geo = navigator?.geolocation;
      if (!geo || typeof geo.getCurrentPosition !== 'function') {
        reject(new Error('Geolocation unavailable'));
        return;
      }
      geo.getCurrentPosition(resolve, reject, options);
    } catch (e) {
      reject(e);
    }
  });
}

export function CreateListingPage() {
  const nav = useNavigate();
  const toast = useToast();
  const { t, dir, locale } = useI18n();
  const auth = useAuth();

  const STEPS = useMemo(
    () => [
      { key: 'basic', title: t('create_step_basic') },
      { key: 'pricing', title: t('create_step_pricing') },
      { key: 'location', title: t('create_step_location') },
      { key: 'photos', title: t('create_step_photos') },
      { key: 'review', title: t('create_step_review') },
    ],
    [t],
  );

  function moderationLabel(code) {
    if (!code) return '';
    const key = `moderation_status_${code}`;
    const translated = t(key);
    return translated === key ? String(code) : translated;
  }

  const [cats, setCats] = useState([]);
  const [govs, setGovs] = useState([]);
  const [cities, setCities] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('SYP');
  const [status, setStatus] = useState('published');

  const [category, setCategory] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');

  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const didAutoPinRef = useRef(false);

  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showRequiredHints, setShowRequiredHints] = useState(false);

  const [attrDefs, setAttrDefs] = useState([]);
  const [attributes, setAttributes] = useState({});

  const draftKey = useMemo(() => {
    const uid = auth?.user?.id ? String(auth.user.id) : 'anon';
    return `beebol.createListingDraft.${uid}`;
  }, [auth?.user?.id]);

  const [draftExists, setDraftExists] = useState(false);
  const [draftRestoredPhotoCount, setDraftRestoredPhotoCount] = useState(0);

  const fileInputRef = useRef(null);
  const photosRef = useRef([]);
  const dragIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [c, g] = await Promise.all([api.categoriesAll(), api.governorates()]);
      if (cancelled) return;
      setCats(Array.isArray(c) ? c : []);
      setGovs(g.results || []);
    }
    load().catch(() => {
      // ignore
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function isMeaningfulDraft(d) {
    if (!d || typeof d !== 'object') return false;
    const titleHas = String(d.title || '').trim().length > 0;
    const descHas = String(d.description || '').trim().length > 0;
    const priceHas = String(d.price ?? '').trim().length > 0;
    const categoryHas = String(d.category || '').trim().length > 0;
    const govHas = String(d.governorate || '').trim().length > 0;
    const cityHas = String(d.city || '').trim().length > 0;
    const neighborhoodHas = String(d.neighborhood || '').trim().length > 0;
    const latHas = String(d.latitude ?? '').trim().length > 0;
    const lngHas = String(d.longitude ?? '').trim().length > 0;
    const stepHas = Number(d.step) > 0;
    const photosHas = Number(d.photosCount) > 0;

    const statusHas = d.status && d.status !== 'published';
    const currencyHas = d.currency && d.currency !== 'SYP';

    return (
      titleHas ||
      descHas ||
      priceHas ||
      categoryHas ||
      govHas ||
      cityHas ||
      neighborhoodHas ||
      latHas ||
      lngHas ||
      stepHas ||
      photosHas ||
      statusHas ||
      currencyHas
    );
  }

  function readDraft() {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.v !== 1) return null;
      if (!isMeaningfulDraft(parsed)) {
        try {
          localStorage.removeItem(draftKey);
        } catch {
          // ignore
        }
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function writeDraft(payload) {
    try {
      localStorage.setItem(draftKey, JSON.stringify(payload));
      setDraftExists(true);
    } catch {
      // ignore
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
    setDraftExists(false);
    setDraftRestoredPhotoCount(0);
  }

  function revokeAllPhotoUrls(list) {
    for (const p of list || []) {
      if (p?.previewUrl) URL.revokeObjectURL(p.previewUrl);
    }
  }

  function applyDraft(d) {
    // Note: we cannot restore selected File objects (browser security). We restore all text fields + step.
    setTitle(d.title || '');
    setDescription(d.description || '');
    setPrice(d.price ?? '');
    setCurrency(d.currency || 'SYP');
    setStatus(d.status || 'published');
    setCategory(d.category || '');
    setGovernorate(d.governorate || '');
    setCity(d.city || '');
    setNeighborhood(d.neighborhood || '');

    setLatitude(d.latitude ?? '');
    setLongitude(d.longitude ?? '');

    setAttributes(d.attributes && typeof d.attributes === 'object' ? d.attributes : {});

    setStep(Number.isFinite(Number(d.step)) ? Math.max(0, Math.min(STEPS.length - 1, Number(d.step))) : 0);

    setDraftRestoredPhotoCount(Number(d.photosCount) > 0 ? Number(d.photosCount) : 0);

    // Clear any currently selected photos (revoking object URLs)
    setPhotos((prev) => {
      revokeAllPhotoUrls(prev);
      return [];
    });
    setDraftExists(true);
  }

  useEffect(() => {
    // After auth is known, check for a saved draft and offer to restore.
    if (auth?.loading) return;
    const d = readDraft();
    setDraftExists(!!d);
    if (!d) return;

    const shouldRestore = window.confirm(t('draft_restore_prompt'));
    if (shouldRestore) {
      applyDraft(d);
      toast.push({ title: t('create_title'), description: t('draft_restored') });
    }
    // If user declines, keep the draft so they can restore later with the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, auth?.loading]);

  useEffect(() => {
    let cancelled = false;
    async function loadCities() {
      if (!governorate) {
        setCities([]);
        return;
      }
      const res = await api.cities({ governorate });
      if (cancelled) return;
      setCities(res.results || []);
    }
    loadCities().catch(() => setCities([]));
    return () => {
      cancelled = true;
    };
  }, [governorate]);

  useEffect(() => {
    let cancelled = false;
    async function loadNeighborhoods() {
      if (!city) {
        setNeighborhoods([]);
        return;
      }
      const res = await api.neighborhoods({ city });
      if (cancelled) return;
      setNeighborhoods(res.results || []);
    }
    loadNeighborhoods().catch(() => setNeighborhoods([]));
    return () => {
      cancelled = true;
    };
  }, [city]);

  useEffect(() => {
    let cancelled = false;
    async function loadAttrDefs() {
      if (!category) {
        setAttrDefs([]);
        setAttributes({});
        return;
      }
      const defs = await api.categoryAttributes(category);
      if (cancelled) return;
      const safeDefs = Array.isArray(defs) ? defs : [];
      setAttrDefs(safeDefs);
      setAttributes((prev) => {
        if (!prev || typeof prev !== 'object') return {};
        const next = {};
        for (const d of safeDefs) {
          const k = String(d?.key || '');
          if (!k) continue;
          if (prev[k] == null) continue;
          next[k] = prev[k];
        }

        // Spec defaults (docs/Categories.md)
        if (next.show_phone == null) next.show_phone = 'true';
        if (next.price_on_inquiry == null) next.price_on_inquiry = 'false';
        if (next.deal_type == null) next.deal_type = 'sale';

        return next;
      });
    }
    loadAttrDefs().catch(() => {
      setAttrDefs([]);
      setAttributes({});
    });
    return () => {
      cancelled = true;
    };
  }, [category]);

  async function createAndUpload() {
    setBusy(true);
    try {
      if (status !== 'draft') {
        const missing = (attrDefs || [])
          .filter((d) => d && d.is_required_in_post)
          .map((d) => String(d.key || ''))
          .filter((k) => k && (attributes[k] == null || String(attributes[k]).trim() === ''));
        if (missing.length > 0) {
          toast.push({
            title: t('create_title'),
            description: `Missing required fields: ${missing.join(', ')}`,
            variant: 'error',
          });
          setStep(0);
          setShowRequiredHints(true);
          return;
        }
      }

      const payload = {
        title,
        description,
        price: price ? String(price) : null,
        currency,
        status,
        category: Number(category),
        governorate: Number(governorate),
        city: Number(city),
        neighborhood: neighborhood ? Number(neighborhood) : null,
        latitude: String(latitude || '').trim() ? String(latitude).trim() : null,
        longitude: String(longitude || '').trim() ? String(longitude).trim() : null,
        attributes,
      };
      const created = await api.createListing(payload);

      if (photos.length > 0) {
        setUploading(true);
        try {
          // Upload sequentially to keep ordering and simplify error reporting.
          for (let i = 0; i < photos.length; i++) {
            const p = photos[i];
            await api.uploadListingImage(created.id, { file: p.file, alt_text: p.altText || '', sort_order: i });
          }
        } finally {
          setUploading(false);
        }
      }

      toast.push({
        title: t('create_title'),
        description: t('toast_moderationStatus', { status: moderationLabel(created.moderation_status) }),
      });

      clearDraft();
      nav(`/listings/${created.id}`);
    } catch (e2) {
      toast.push({
        title: t('create_title'),
        description: e2 instanceof ApiError ? e2.message : String(e2),
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  function saveDraftSilent() {
    const payload = buildDraftPayload();
    if (!isMeaningfulDraft(payload)) {
      clearDraft();
      return;
    }
    writeDraft(payload);
  }

  function goNext() {
    setShowRequiredHints(true);
    setStep((s) => {
      const next = Math.min(STEPS.length - 1, s + 1);
      return next;
    });
    saveDraftSilent();
  }

  function goBack() {
    setStep((s) => {
      const next = Math.max(0, s - 1);
      return next;
    });
    saveDraftSilent();
  }

  const priceOk = price === '' || !Number.isNaN(Number(price));
  const priceIsFree = priceOk && String(price).trim() !== '' && Number(price) === 0;

  const catIdx = useMemo(() => buildCategoryIndex(cats), [cats]);
  const categoryLeafOk = category ? catIdx.isLeaf(String(category)) : false;

  const generalRootId = useMemo(() => {
    const roots = catIdx.getChildren('');
    if (roots.length !== 1) return '';
    const r = roots[0];
    if (String(r?.slug || '') !== 'general') return '';
    return String(r.id);
  }, [catIdx]);

  function getCategoryPathLabel(id, sep = ' › ') {
    const ids = catIdx.pathToRoot(id ? String(id) : '');
    const trimmed = generalRootId && ids.length && ids[0] === generalRootId ? ids.slice(1) : ids;
    return trimmed
      .map((x) => catIdx.getLabel(catIdx.byId.get(String(x)), locale))
      .filter(Boolean)
      .join(sep);
  }

  function attrLabel(d) {
    if (!d) return '';
    const ar = String(d.label_ar || '').trim();
    const en = String(d.label_en || '').trim();
    const key = String(d.key || '').trim();
    if (String(locale || '').startsWith('ar')) return ar || en || key;
    return en || ar || key;
  }

  const priceOnInquiry = useMemo(() => {
    const v = attributes?.price_on_inquiry;
    if (v === true) return true;
    return String(v || '').trim().toLowerCase() === 'true';
  }, [attributes?.price_on_inquiry]);

  const canGoBasic = title.trim().length > 0 && category && categoryLeafOk;
  const canGoPricing = priceOnInquiry ? true : currency && priceOk;
  const canGoLocation = governorate && city;

  const latitudeOk = latitude === '' || !Number.isNaN(Number(latitude));
  const longitudeOk = longitude === '' || !Number.isNaN(Number(longitude));

  const pinnedLat = useMemo(() => toNumberOrNull(latitude), [latitude]);
  const pinnedLng = useMemo(() => toNumberOrNull(longitude), [longitude]);

  const mapCenter = useMemo(() => {
    if (pinnedLat != null && pinnedLng != null) return [pinnedLat, pinnedLng];
    // Default center (Syria region) when no pin exists yet.
    return [34.8, 38.9];
  }, [pinnedLat, pinnedLng]);

  useEffect(() => {
    // When the user reaches the location step with no coords yet, try to start
    // from their current location (if permitted). If not available, fall back
    // to the country default center.
    if (step !== 2) return;
    if (didAutoPinRef.current) return;
    if (String(latitude || '').trim() || String(longitude || '').trim()) return;

    didAutoPinRef.current = true;

    const fallback = () => {
      setLatitude('34.800000');
      setLongitude('38.900000');
      setTimeout(() => saveDraftSilent(), 0);
    };

    try {
      getCurrentPositionAsync({ enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 8000 })
        .then((pos) => {
          const lat = pos?.coords?.latitude;
          const lng = pos?.coords?.longitude;
          if (typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng)) {
            setLatitude(lat.toFixed(6));
            setLongitude(lng.toFixed(6));
            setTimeout(() => saveDraftSilent(), 0);
            return;
          }
          fallback();
        })
        .catch(() => fallback());
    } catch {
      fallback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const maxReachableStep = useMemo(() => {
    // You can always stay on or go back to earlier steps.
    // Forward navigation is gated by required fields.
    if (!canGoBasic) return 0;
    if (!canGoPricing) return 1;
    if (!canGoLocation) return 2;
    return 4;
  }, [canGoBasic, canGoPricing, canGoLocation]);

  function jumpToStep(nextStep) {
    if (busy) return;
    if (!Number.isFinite(Number(nextStep))) return;
    const target = Math.max(0, Math.min(STEPS.length - 1, Number(nextStep)));
    const allowed = target <= maxReachableStep;
    if (!allowed) return;
    setStep(target);
    setShowRequiredHints(true);
    saveDraftSilent();
  }

  const canProceedCurrentStep =
    (step === 0 && canGoBasic) ||
    (step === 1 && canGoPricing) ||
    (step === 2 && canGoLocation) ||
    (step === 3 && true) ||
    (step === 4 && true);

  const canSubmit = canGoBasic && canGoPricing && canGoLocation;

  function addFiles(fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (files.length === 0) return;
    setPhotos((prev) => {
      const next = [...prev];
      for (const file of files) {
        next.push({
          id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          file,
          previewUrl: URL.createObjectURL(file),
          altText: '',
        });
      }
      return next;
    });
  }

  function removePhoto(id) {
    setPhotos((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  function movePhoto(id, direction) {
    setPhotos((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0) return prev;
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[idx];
      copy[idx] = copy[nextIdx];
      copy[nextIdx] = tmp;
      return copy;
    });
  }

  function movePhotoTo(dragId, targetId) {
    if (!dragId || !targetId || dragId === targetId) return;
    setPhotos((prev) => {
      const from = prev.findIndex((p) => p.id === dragId);
      const to = prev.findIndex((p) => p.id === targetId);
      if (from < 0 || to < 0 || from === to) return prev;
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  }

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  function buildDraftPayload() {
    return {
      v: 1,
      savedAt: Date.now(),
      step,
      title,
      description,
      price,
      currency,
      status,
      category,
      governorate,
      city,
      neighborhood,
      latitude,
      longitude,
      attributes,
      photosCount: photos.length,
    };
  }

  useEffect(() => {
    // Keep draft in sync with step + photo count changes (photos can't be restored, but progress should be).
    if (busy) return;
    saveDraftSilent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, photos.length, busy, draftKey]);

  useEffect(() => {
    return () => {
      // Cleanup object URLs on unmount
      for (const p of photosRef.current) {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      }
    };
  }, []);

  const stepTitle = STEPS[step]?.title || '';

  useEffect(() => {
    // When the user moves around steps, keep hints available.
    // This avoids a confusing "disabled button with no reason" feeling.
    setShowRequiredHints(true);
  }, [step]);

  return (
    <Card >
      <CardHeader>
        <Flex align="start" justify="between" gap="3" wrap="wrap">
          <Flex direction="column" gap="1">
            <Heading size="5">{t('create_title')}</Heading>
            <Text size="2" color="gray">
              {t('create_step', { current: step + 1, total: STEPS.length })} · {stepTitle}
            </Text>
          </Flex>

          <Flex gap="2" wrap="wrap" justify="end">
            {STEPS.map((s, idx) => (
              <button
                key={s.key}
                type="button"
                onClick={() => jumpToStep(idx)}
                disabled={busy || idx > maxReachableStep}
                title={s.title}
                className={
                  'm-0 inline-flex rounded-full bg-transparent p-0 align-middle' +
                  ' focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gray-a8)]' +
                  ' focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-panel-solid)]' +
                  (busy || idx > maxReachableStep
                    ? ' cursor-not-allowed opacity-50'
                    : ' cursor-pointer hover:opacity-90')
                }
                aria-label={s.title}
              >
                <Badge variant={idx < step ? 'ok' : idx === step ? 'warn' : 'default'}>{idx + 1}</Badge>
              </button>
            ))}
          </Flex>
        </Flex>

        <Callout.Root variant="surface" mt="2">
          <Callout.Text>
            <Flex align="center" gap="2">
              <Icon icon={Info} size={16} className="text-[var(--gray-11)]" aria-label="" />
              <span>{t('create_hint')}</span>
            </Flex>
          </Callout.Text>
        </Callout.Root>
      </CardHeader>

      <CardBody>
        {step === 0 ? (
          <div>
            <div className="pt-px">
              <Flex align="center" gap="2" mt="1" mb="2">
                <Icon icon={Type} size={16} className="text-[var(--gray-11)]" aria-label="" />
                <Text as="div" size="2" color="gray">
                  {t('create_title_label')}
                </Text>
              </Flex>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveDraftSilent} />
              {showRequiredHints && !title.trim() ? (
                <Text size="1" color="red" mt="1" as="div">
                  {t('required')}
                </Text>
              ) : null}
            </div>

            <div className="pt-px">
              <Flex align="center" gap="2" mt="1" mb="2">
                <Icon icon={AlignLeft} size={16} className="text-[var(--gray-11)]" aria-label="" />
                <Text as="div" size="2" color="gray">
                  {t('create_description_label')}
                </Text>
              </Flex>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} onBlur={saveDraftSilent} />
            </div>

            <div className="pt-px">
              <Flex align="center" gap="2" mt="1" mb="2">
                <Icon icon={Shapes} size={16} className="text-[var(--gray-11)]" aria-label="" />
                <Text as="div" size="2" color="gray">
                  {t('listings_category')}
                </Text>
              </Flex>
              <CategoryCascadeSelect
                categories={cats}
                value={category}
                onChange={(v) => setCategory(v)}
                onBlur={saveDraftSilent}
                locale={locale}
                t={t}
                required={showRequiredHints}
                leafOnly
              />
              {showRequiredHints && !category ? (
                <Text size="1" color="red" mt="1" as="div">
                  {t('required')}
                </Text>
              ) : null}
            </div>

            {category && Array.isArray(attrDefs) && attrDefs.length > 0 ? (
              <div className="pt-px">
                <Grid gap="3" columns={{ initial: '1', sm: '2' }}>
                  {attrDefs.map((d) => {
                    const key = String(d?.key || '');
                    if (!key) return null;
                    const label = attrLabel(d);
                    const val = attributes?.[key] == null ? '' : String(attributes[key]);
                    const requiredNow = status !== 'draft' && !!d?.is_required_in_post;

                    const onChange = (nextVal) => {
                      setAttributes((prev) => ({
                        ...(prev && typeof prev === 'object' ? prev : {}),
                        [key]: nextVal,
                      }));
                    };

                    return (
                      <div key={key} className="pt-px">
                        <Text as="div" size="2" color="gray" mb="2">
                          {label}{d?.unit ? ` (${String(d.unit)})` : ''}
                        </Text>

                        {d?.type === 'enum' && Array.isArray(d?.choices) ? (
                          <Select value={val} onChange={(e) => onChange(e.target.value)} onBlur={saveDraftSilent}>
                            <option value="">{t('select_placeholder')}</option>
                            {d.choices.map((c) => (
                              <option key={String(c)} value={String(c)}>
                                {getAttributeChoiceLabel(d, c, t) || String(c)}
                              </option>
                            ))}
                          </Select>
                        ) : d?.type === 'bool' ? (
                          <Select value={val} onChange={(e) => onChange(e.target.value)} onBlur={saveDraftSilent}>
                            <option value="">{t('select_placeholder')}</option>
                            <option value="true">{formatAttributeValue(d, true, t)}</option>
                            <option value="false">{formatAttributeValue(d, false, t)}</option>
                          </Select>
                        ) : (
                          <Input value={val} onChange={(e) => onChange(e.target.value)} onBlur={saveDraftSilent} />
                        )}

                        {showRequiredHints && requiredNow && !String(val || '').trim() ? (
                          <Text size="1" color="red" mt="1" as="div">
                            {t('required')}
                          </Text>
                        ) : null}
                      </div>
                    );
                  })}
                </Grid>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 1 ? (
            <Grid gap="3" columns={{ initial: '1', sm: '3' }}>
              <div className="pt-px">
                <Flex align="center" gap="2" mt="1" mb="2">
                  <Icon icon={Tag} size={16} className="text-[var(--gray-11)]" aria-label="" />
                  <Text as="div" size="2" color="gray">
                    {t('create_price')}
                  </Text>
                </Flex>
                <Input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  onBlur={saveDraftSilent}
                  placeholder="123.00"
                  disabled={priceOnInquiry}
                />
                {priceOnInquiry ? (
                  <Text size="1" color="gray" mt="1" as="div">
                    {t('price_on_inquiry_hint')}
                  </Text>
                ) : null}
                {priceIsFree ? (
                  <Text size="1" color="gray" mt="1" as="div">
                    {t('price_free')}
                  </Text>
                ) : null}
                {!priceOk ? (
                  <Flex align="center" gap="2" mt="1">
                    <Icon icon={Tag} size={14} className="text-[var(--red-11)]" aria-label="" />
                    <Text size="1" color="red" as="div">
                      {t('create_price')} {t('invalid')}
                    </Text>
                  </Flex>
                ) : null}
              </div>

              <div className="pt-px">
                <Flex align="center" gap="2" mt="1" mb="2">
                  <Icon icon={Banknote} size={16} className="text-[var(--gray-11)]" aria-label="" />
                  <Text as="div" size="2" color="gray">
                    {t('create_currency')}
                  </Text>
                </Flex>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} onBlur={saveDraftSilent} disabled={priceOnInquiry} />
              </div>

              <div className="pt-px">
                <Flex align="center" gap="2" mt="1" mb="2">
                  <Icon icon={Tag} size={16} className="text-[var(--gray-11)]" aria-label="" />
                  <Text as="div" size="2" color="gray">
                    {t('create_status')}
                  </Text>
                </Flex>
                <Select value={status} onChange={(e) => setStatus(e.target.value)} onBlur={saveDraftSilent}>
                  <option value="draft">{t('status_draft')}</option>
                  <option value="published">{t('status_published')}</option>
                  <option value="archived">{t('status_archived')}</option>
                </Select>
              </div>
            </Grid>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <Grid gap="3" columns={{ initial: '1', sm: '2' }}>
              <div className="pt-px">
                <Flex align="center" gap="2" mt="1" mb="2">
                  <Icon icon={MapPin} size={16} className="text-[var(--gray-11)]" aria-label="" />
                  <Text as="div" size="2" color="gray">
                    {t('listings_governorate')}
                  </Text>
                </Flex>
                <Select
                  value={governorate}
                  onChange={(e) => {
                    setGovernorate(e.target.value);
                    setCity('');
                    setNeighborhood('');
                  }}
                  onBlur={saveDraftSilent}
                >
                  <option value="">{t('select_placeholder')}</option>
                  {govs.map((g) => (
                    <option key={g.id} value={String(g.id)}>
                      {g.name_ar || g.name_en}
                    </option>
                  ))}
                </Select>
                {showRequiredHints && !governorate ? (
                  <Text size="1" color="red" mt="1" as="div">
                    {t('required')}
                  </Text>
                ) : null}
              </div>

              <div className="pt-px">
                <Flex align="center" gap="2" mt="1" mb="2">
                  <Icon icon={MapPin} size={16} className="text-[var(--gray-11)]" aria-label="" />
                  <Text as="div" size="2" color="gray">
                    {t('listings_city')}
                  </Text>
                </Flex>
                <Select
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    setNeighborhood('');
                  }}
                  onBlur={saveDraftSilent}
                  disabled={!governorate}
                >
                  <option value="">{t('select_placeholder')}</option>
                  {cities.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name_ar || c.name_en}
                    </option>
                  ))}
                </Select>
                {showRequiredHints && !!governorate && !city ? (
                  <Text size="1" color="red" mt="1" as="div">
                    {t('required')}
                  </Text>
                ) : null}
              </div>

              <div className="pt-px">
                <Flex align="center" gap="2" mt="1" mb="2">
                  <Icon icon={MapPin} size={16} className="text-[var(--gray-11)]" aria-label="" />
                  <Text as="div" size="2" color="gray">
                    {t('create_neighborhood_optional')}
                  </Text>
                </Flex>
                <Select
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  onBlur={saveDraftSilent}
                  disabled={!city}
                >
                  <option value="">{t('none')}</option>
                  {neighborhoods.map((n) => (
                    <option key={n.id} value={String(n.id)}>
                      {n.name_ar || n.name_en}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="pt-px sm:col-span-2">
                <Flex align="center" justify="between" gap="2" mt="1" mb="2" wrap="wrap">
                  <Flex align="center" gap="2">
                    <Icon icon={MapPin} size={16} className="text-[var(--gray-11)]" aria-label="" />
                    <Text as="div" size="2" color="gray">
                      {t('create_pin_on_map')}
                    </Text>
                  </Flex>
                  <Text size="1" color="gray" as="div">
                    {t('create_pin_help')}
                  </Text>
                </Flex>

                <Box className="relative overflow-hidden rounded-md border border-[var(--gray-a5)] bg-[var(--color-panel-solid)]">
                  <MapContainer
                    center={mapCenter}
                    zoom={pinnedLat != null && pinnedLng != null ? 13 : 7}
                    style={{ height: 340, width: '100%' }}
                    scrollWheelZoom
                    className="z-0"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <SyncMapToCenter center={mapCenter} />
                    <TrackCenter
                      onCenterChange={(lat, lng) => {
                        setCenteredDraftValue(setLatitude, lat);
                        setCenteredDraftValue(setLongitude, lng);
                        setTimeout(() => saveDraftSilent(), 0);
                      }}
                    />
                  </MapContainer>

                  {/* Center pin overlay */}
                  <div
                    className="pointer-events-none absolute left-1/2 top-1/2 z-20"
                    style={{ transform: 'translate(-50%, calc(-100% + 6px))' }}
                    aria-hidden="true"
                  >
                    <Icon icon={MapPin} size={34} className="text-[var(--accent-9)]" aria-label="" />
                  </div>

                  {/* Go to current location */}
                  <div className="absolute bottom-3 right-3 z-20 pointer-events-auto">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          const pos = await getCurrentPositionAsync({ enableHighAccuracy: true, maximumAge: 30_000, timeout: 8000 });
                          const lat = pos?.coords?.latitude;
                          const lng = pos?.coords?.longitude;
                          if (typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng)) {
                            setLatitude(lat.toFixed(6));
                            setLongitude(lng.toFixed(6));
                            setTimeout(() => saveDraftSilent(), 0);
                          }
                        } catch {
                          // ignore
                        }
                      }}
                      title={t('use_current_location')}
                    >
                      <Flex align="center" gap="2">
                        <Icon icon={LocateFixed} size={16} />
                        <Text as="span" size="2">
                          {t('use_current_location')}
                        </Text>
                      </Flex>
                    </Button>
                  </div>
                </Box>
              </div>

              <div className="pt-px">
                <Flex align="center" gap="2" mt="1" mb="2">
                  <Icon icon={MapPin} size={16} className="text-[var(--gray-11)]" aria-label="" />
                  <Text as="div" size="2" color="gray">
                    {t('latitude_optional')}
                  </Text>
                </Flex>
                <Input
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  onBlur={saveDraftSilent}
                  placeholder="33.5"
                />
                {!latitudeOk ? (
                  <Text size="1" color="red" mt="1" as="div">
                    {t('invalid')}
                  </Text>
                ) : null}
              </div>

              <div className="pt-px">
                <Flex align="center" gap="2" mt="1" mb="2">
                  <Icon icon={MapPin} size={16} className="text-[var(--gray-11)]" aria-label="" />
                  <Text as="div" size="2" color="gray">
                    {t('longitude_optional')}
                  </Text>
                </Flex>
                <Input
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  onBlur={saveDraftSilent}
                  placeholder="36.3"
                />
                {!longitudeOk ? (
                  <Text size="1" color="red" mt="1" as="div">
                    {t('invalid')}
                  </Text>
                ) : null}
              </div>
            </Grid>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <Text size="2" color="gray">
              {t('create_photos_help')}
            </Text>
            <Text size="2" color="gray">
              {t('create_photos_reorder_help')}
            </Text>

            {draftRestoredPhotoCount > 0 && photos.length === 0 ? (
              <Callout.Root variant="surface">
                <Callout.Text>
                  <Flex align="center" gap="2">
                    <Icon icon={Info} size={16} className="text-[var(--gray-11)]" aria-label="" />
                    <span>{t('draft_photos_note', { count: draftRestoredPhotoCount })}</span>
                  </Flex>
                </Callout.Text>
              </Callout.Root>
            ) : null}

            <div className="pt-px">
              <Flex align="center" gap="2" mt="1" mb="2">
                <Icon icon={Images} size={16} className="text-[var(--gray-11)]" aria-label="" />
                <Text as="div" size="2" color="gray">
                  {t('create_photos_optional')}
                </Text>
              </Flex>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <div className="mt-2">
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  <Flex align="center" gap="2">
                    <Icon icon={ImagePlus} size={16} />
                    <Text as="span" size="2">
                      {t('create_photos_add')}
                    </Text>
                  </Flex>
                </Button>
              </div>
              <Text size="1" color="gray" as="div" mt="2">
                {photos.length} {t('detail_images')}
              </Text>
            </div>

            {photos.length ? (
              <Grid gap="3" columns={{ initial: '1', sm: '2' }}>
                {photos.map((p) => (
                  <Card
                    key={p.id}
                    draggable
                    onDragStart={() => {
                      dragIdRef.current = p.id;
                    }}
                    onDragOver={(e) => {
                      // Required to allow drop.
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      movePhotoTo(dragIdRef.current, p.id);
                      dragIdRef.current = null;
                    }}
                    onDragEnd={() => {
                      dragIdRef.current = null;
                    }}
                    className="cursor-move select-none transition-opacity hover:opacity-95"
                  >
                    <Box p="3">
                      <div className="overflow-hidden rounded-md border border-[var(--gray-a5)] bg-[var(--color-panel-solid)]">
                        <img
                          src={p.previewUrl}
                          alt={p.altText || ''}
                          className="h-40 w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <Text as="div" size="1" color="gray" mt="2" style={{ wordBreak: 'break-word' }}>
                        {p.file?.name}
                      </Text>
                      <div className="mt-2">
                        <Flex align="center" gap="2" mt="1" mb="1">
                          <Icon icon={Captions} size={16} className="text-[var(--gray-11)]" aria-label="" />
                          <Text as="div" size="2" color="gray">
                            {t('create_photos_alt_optional')}
                          </Text>
                        </Flex>
                        <Input
                          value={p.altText}
                          onChange={(e) => {
                            const v = e.target.value;
                            setPhotos((prev) => prev.map((x) => (x.id === p.id ? { ...x, altText: v } : x)));
                          }}
                          onBlur={saveDraftSilent}
                        />
                      </div>
                      <Flex mt="3" justify="between" gap="2" wrap="wrap">
                        <Flex gap="2" wrap="wrap">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => movePhoto(p.id, -1)}
                            disabled={photos[0]?.id === p.id}
                          >
                            <Flex align="center" gap="2">
                              <Icon icon={ArrowUp} size={14} />
                              <Text as="span" size="2">
                                {t('move_up')}
                              </Text>
                            </Flex>
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => movePhoto(p.id, 1)}
                            disabled={photos[photos.length - 1]?.id === p.id}
                          >
                            <Flex align="center" gap="2">
                              <Icon icon={ArrowDown} size={14} />
                              <Text as="span" size="2">
                                {t('move_down')}
                              </Text>
                            </Flex>
                          </Button>
                        </Flex>
                        <Button variant="danger" size="sm" onClick={() => removePhoto(p.id)}>
                          <Flex align="center" gap="2">
                            <Icon icon={Trash2} size={14} />
                            <Text as="span" size="2">
                              {t('remove')}
                            </Text>
                          </Flex>
                        </Button>
                      </Flex>
                    </Box>
                  </Card>
                ))}
              </Grid>
            ) : (
              <Callout.Root variant="surface">
                <Callout.Text>
                  <Flex align="center" gap="2">
                    <Icon icon={PackageOpen} size={16} className="text-[var(--gray-11)]" aria-label="" />
                    <span>{t('none')}</span>
                  </Flex>
                </Callout.Text>
              </Callout.Root>
            )}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-5">
            <Heading size="4">{t('review')}</Heading>

            <Card>
              <Box p="4">
                <Grid gap="3">
                  <Text size="2">
                    <Text as="span" color="gray">
                      {t('create_title_label')}:
                    </Text>{' '}
                    {title || '-'}
                  </Text>
                  <Text size="2">
                    <Text as="span" color="gray">
                      {t('listings_category')}:
                    </Text>{' '}
                    {category ? getCategoryPathLabel(String(category)) || '-' : '-'}
                  </Text>
                  <Text size="2">
                    <Text as="span" color="gray">
                      {t('create_price')}:
                    </Text>{' '}
                    {priceOnInquiry ? t('price_on_inquiry_display') : price ? `${price} ${currency}` : '-'}
                  </Text>
                  <Text size="2">
                    <Text as="span" color="gray">
                      {t('create_status')}:
                    </Text>{' '}
                    {status}
                  </Text>
                  <Text size="2">
                    <Text as="span" color="gray">
                      {t('listings_governorate')}:
                    </Text>{' '}
                    {govs.find((g) => String(g.id) === String(governorate))?.name_ar ||
                      govs.find((g) => String(g.id) === String(governorate))?.name_en ||
                      '-'}
                  </Text>
                  <Text size="2">
                    <Text as="span" color="gray">
                      {t('listings_city')}:
                    </Text>{' '}
                    {cities.find((c) => String(c.id) === String(city))?.name_ar ||
                      cities.find((c) => String(c.id) === String(city))?.name_en ||
                      '-'}
                  </Text>
                  <Text size="2">
                    <Text as="span" color="gray">
                      {t('create_photos_optional')}:
                    </Text>{' '}
                    {photos.length}
                  </Text>
                </Grid>
              </Box>
            </Card>

            <Button
              disabled={!canSubmit || busy}
              className="w-full"
              onClick={createAndUpload}
            >
              {busy || uploading ? (
                <Flex align="center" justify="center" gap="2">
                  <Spinner size="2" />
                  <Text size="2" as="span">
                    {t('loading')}
                  </Text>
                </Flex>
              ) : (
                <Flex align="center" justify="center" gap="2">
                  <Icon icon={UploadCloud} size={16} />
                  <Text as="span" size="2">
                    {t('create_submit_and_upload')}
                  </Text>
                </Flex>
              )}
            </Button>
          </div>
        ) : null}

        <div className="mt-8 border-t border-[var(--gray-a5)] pt-6">
          <Flex justify="between" gap="4">
            <Button variant="secondary" onClick={goBack} disabled={step === 0 || busy}>
              <Flex align="center" gap="2">
                <Icon icon={dir === 'rtl' ? ChevronRight : ChevronLeft} size={16} />
                <Text as="span" size="2">
                  {t('back')}
                </Text>
              </Flex>
            </Button>

            {step < STEPS.length - 1 ? (
              <Button onClick={goNext} disabled={!canProceedCurrentStep || busy}>
                <Flex align="center" gap="2">
                  <Text as="span" size="2">
                    {t('next')}
                  </Text>
                  <Icon icon={dir === 'rtl' ? ChevronLeft : ChevronRight} size={16} />
                </Flex>
              </Button>
            ) : null}
          </Flex>
        </div>
      </CardBody>
    </Card>
  );
}
