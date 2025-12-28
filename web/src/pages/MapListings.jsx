import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Box, Callout, Flex, Grid, Heading, Text } from '@radix-ui/themes';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { latLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { Eye, EyeOff } from 'lucide-react';

import { api, apiFetchJson, ApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/i18n';
import { Card, CardBody } from '../ui/Card';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { FavoriteButton } from '../ui/FavoriteButton';
import { ListingThumbnail } from '../ui/ListingThumbnail';
import { formatMoney } from '../lib/format';
import { listWatchlist, addWatch, removeWatch } from '../lib/watchlist';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import { useListingFilters } from '../lib/useListingFilters';
import { ListingsFiltersSidebar } from '../components/ListingsFiltersSidebar';

function FitToBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    try {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
    } catch {
      // ignore
    }
  }, [map, bounds]);
  return null;
}

function toNumberOrNull(v) {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function MapListingsPage() {
  const { isAuthenticated } = useAuth();
  const { t, dir, locale } = useI18n();
  const [sp, setSp] = useSearchParams();

  const filtersWrapClass = 'bb-filters';
  const filterSectionClass = 'bb-filter-section';
  const filterControlClass = 'bb-filter-control';

  const {
    params,
    cats,
    govs,
    cities,
    neighborhoods,
    uniqueAttrDefs,
    searchDraft,
    setSearchDraft,
    setParam,
    attrLabel,
  } = useListingFilters({ sp, setSp, locale });

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [watchedIds, setWatchedIds] = useState(() => new Set(listWatchlist().map((x) => x.id)));

  function toggleWatchCard(listingId) {
    const id = Number(listingId);
    if (!id) return;
    if (watchedIds.has(id)) {
      removeWatch(id);
      setWatchedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    const row = items?.find((x) => Number(x?.id) === id) || null;
    addWatch(id, { lastPrice: row?.price, lastCurrency: row?.currency });
    setWatchedIds((prev) => new Set(prev).add(id));
  }

  const apiParams = useMemo(() => {
    const out = {};
    for (const [k, v] of sp.entries()) {
      if (v == null || String(v) === '') continue;
      out[k] = String(v);
    }
    if (!out.page_size) out.page_size = '200';
    if (!out.page) out.page = '1';
    return out;
  }, [sp]);

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const maxPages = 10;
        let pageCount = 0;
        let next = `api/v1/listings/?${new URLSearchParams(apiParams).toString()}`;
        const acc = [];

        while (next && pageCount < maxPages) {
          const res = await apiFetchJson(next, { auth: isAuthenticated });
          const batch = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
          acc.push(...batch);
          next = res?.next || null;
          pageCount += 1;
        }

        if (!cancelled) setItems(acc);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, apiParams]);

  const points = useMemo(() => {
    const out = [];
    for (const it of items || []) {
      const lat = toNumberOrNull(it?.latitude);
      const lng = toNumberOrNull(it?.longitude);
      if (lat == null || lng == null) continue;
      out.push({
        id: it.id,
        title: it.title,
        lat,
        lng,
        price: it.price,
        currency: it.currency,
        governorate: it.governorate,
        city: it.city,
        neighborhood: it.neighborhood,
      });
    }
    return out;
  }, [items]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return items?.find((x) => Number(x?.id) === Number(selectedId)) || null;
  }, [items, selectedId]);

  const [selectedDetail, setSelectedDetail] = useState(null);
  const [selectedDetailLoading, setSelectedDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      if (!selectedId) {
        setSelectedDetail(null);
        return;
      }
      setSelectedDetailLoading(true);
      try {
        const d = await api.listing(selectedId, { auth: isAuthenticated });
        if (cancelled) return;
        setSelectedDetail(d);
      } catch {
        if (cancelled) return;
        setSelectedDetail(null);
      } finally {
        if (!cancelled) setSelectedDetailLoading(false);
      }
    }
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedId, isAuthenticated]);

  const selectedImages = useMemo(() => {
    const imgs = selectedDetail?.images;
    if (!Array.isArray(imgs)) return [];
    return imgs.slice(0, 6);
  }, [selectedDetail?.images]);

  const selectedDescription = useMemo(() => {
    const d = String(selectedDetail?.description || '').trim();
    if (!d) return '';
    const max = 260;
    if (d.length <= max) return d;
    return `${d.slice(0, max)}…`;
  }, [selectedDetail?.description]);

  const missingCoordsCount = (items?.length || 0) - points.length;

  const bounds = useMemo(() => {
    if (!points.length) return null;
    const b = latLngBounds(points.map((p) => [p.lat, p.lng]));
    return b;
  }, [points]);

  const defaultCenter = useMemo(() => {
    if (points.length) return [points[0].lat, points[0].lng];
    return [0, 0];
  }, [points]);

  const layoutClass =
    dir === 'rtl'
      ? 'grid gap-4 md:gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_360px] md:items-start'
      : 'grid gap-4 md:gap-6 md:grid-cols-[360px_minmax(0,2fr)_minmax(0,1fr)] md:items-start';

  return (
    <Flex direction="column" gap="4">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading size="5">{t('map_title')}</Heading>
        <Link to={sp.toString() ? `/listings?${sp.toString()}` : '/listings'} className="inline-block">
          <Button variant="secondary">{t('back_to_listings')}</Button>
        </Link>
      </Flex>

      {error ? (
        <Callout.Root color="red" variant="surface">
          <Callout.Text>
            {error instanceof ApiError ? error.message : String(error)}
          </Callout.Text>
        </Callout.Root>
      ) : null}

      <div className={layoutClass}>
        <div className="self-start">
          <ListingsFiltersSidebar
            t={t}
            locale={locale}
            sp={sp}
            params={params}
            cats={cats}
            govs={govs}
            cities={cities}
            neighborhoods={neighborhoods}
            uniqueAttrDefs={uniqueAttrDefs}
            attrLabel={attrLabel}
            searchDraft={searchDraft}
            setSearchDraft={setSearchDraft}
            setParam={setParam}
            classNames={{ filtersWrapClass, filterSectionClass, filterControlClass }}
          />
        </div>

        <div>
          {loading ? (
            <Card>
              <CardBody>
                <Text size="2" color="gray">{t('loading')}</Text>
              </CardBody>
            </Card>
          ) : null}

          {!loading && !points.length ? (
            <Callout.Root variant="surface">
              <Callout.Text>{t('map_no_coords')}</Callout.Text>
            </Callout.Root>
          ) : null}

          {!loading && points.length ? (
            <Card>
              <CardBody>
                <Box className="overflow-hidden rounded-md border border-[var(--gray-a5)]">
                  <MapContainer
                    center={defaultCenter}
                    zoom={11}
                    style={{ height: 520, width: '100%' }}
                    scrollWheelZoom
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <FitToBounds bounds={bounds} />

                    {points.map((p) => (
                      <CircleMarker
                        key={p.id}
                        center={[p.lat, p.lng]}
                        radius={Number(selectedId) === Number(p.id) ? 9 : 7}
                        pathOptions={{
                          color: Number(selectedId) === Number(p.id) ? 'var(--accent-10)' : 'var(--accent-9)',
                          fillColor: Number(selectedId) === Number(p.id) ? 'var(--accent-10)' : 'var(--accent-9)',
                          fillOpacity: 0.9,
                        }}
                        eventHandlers={{
                          click: () => setSelectedId(p.id),
                        }}
                      >
                        <Popup>
                          <div style={{ minWidth: 180 }}>
                            <div style={{ fontWeight: 600, marginBottom: 6 }}>{p.title || t('listing_number', { id: p.id })}</div>
                            <div style={{ marginBottom: 8, color: 'var(--gray-11)' }}>
                              {(p.governorate?.name_ar || p.governorate?.name_en || '') +
                                (p.city ? ` · ${p.city?.name_ar || p.city?.name_en}` : '') +
                                (p.neighborhood ? ` · ${p.neighborhood?.name_ar || p.neighborhood?.name_en}` : '')}
                            </div>
                            <button
                              type="button"
                              style={{ textDecoration: 'underline', color: 'var(--accent-11)' }}
                              onClick={() => setSelectedId(p.id)}
                            >
                              {t('map_show_in_panel')}
                            </button>
                          </div>
                        </Popup>
                      </CircleMarker>
                    ))}
                  </MapContainer>
                </Box>

                {missingCoordsCount > 0 ? (
                  <Text size="1" color="gray" mt="3" as="div">
                    {t('map_missing_coords', { count: missingCoordsCount })}
                  </Text>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div>
          <Card>
            <CardBody>
              <Flex direction="column" gap="3">
                <Heading size="3">{t('map_selected_title')}</Heading>
                {!selected ? (
                  <Text size="2" color="gray">{t('map_select_prompt')}</Text>
                ) : (
                  <>
                    <Flex gap="3" align="start">
                      <ListingThumbnail
                        src={selected.thumbnail}
                        alt={selected.title || ''}
                        className="h-20 w-20 rounded-lg border-[var(--gray-a6)]"
                        placeholder={t('detail_noImages')}
                      />
                      <Flex direction="column" gap="1" style={{ minWidth: 0, flex: 1 }}>
                        <Text as="div" size="3" style={{ fontWeight: 600, wordBreak: 'break-word' }}>
                          {selected.title || t('listing_number', { id: selected.id })}
                        </Text>
                        {selected.price != null ? (
                          <Text as="div" size="2" color="gray">
                            {formatMoney(selected.price, selected.currency)}
                          </Text>
                        ) : null}
                        <Flex align="center" gap="2" justify="end">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="px-2"
                            onClick={() => toggleWatchCard(selected.id)}
                            title={watchedIds.has(Number(selected.id)) ? t('watch_remove') : t('watch_add')}
                            aria-label={watchedIds.has(Number(selected.id)) ? t('watch_remove') : t('watch_add')}
                          >
                            <Icon icon={watchedIds.has(Number(selected.id)) ? EyeOff : Eye} size={16} />
                          </Button>
                          <FavoriteButton listingId={selected.id} />
                        </Flex>
                      </Flex>
                    </Flex>

                    <Text size="2" color="gray">
                      {(selected.governorate?.name_ar || selected.governorate?.name_en || '') +
                        (selected.city ? ` · ${selected.city?.name_ar || selected.city?.name_en}` : '') +
                        (selected.neighborhood ? ` · ${selected.neighborhood?.name_ar || selected.neighborhood?.name_en}` : '')}
                    </Text>

                    {selectedDetailLoading ? (
                      <Text size="2" color="gray">{t('loading')}</Text>
                    ) : selectedDetail ? (
                      <>
                        {selectedImages.length ? (
                          <Grid columns={{ initial: '3' }} gap="2">
                            {selectedImages.map((img) => (
                              <div key={img.id} className="overflow-hidden rounded-md border border-[var(--gray-a5)] bg-[var(--color-panel-solid)]">
                                <img
                                  src={normalizeMediaUrl(img.image)}
                                  alt={img.alt_text || ''}
                                  className="h-16 w-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ))}
                          </Grid>
                        ) : null}

                        {selectedDescription ? (
                          <Text size="2" color="gray">
                            {selectedDescription}
                          </Text>
                        ) : null}
                      </>
                    ) : null}

                    <Link to={`/listings/${selected.id}`} className="inline-block">
                      <Button>{t('map_show_details')}</Button>
                    </Link>
                  </>
                )}
              </Flex>
            </CardBody>
          </Card>
        </div>
      </div>
    </Flex>
  );
}
