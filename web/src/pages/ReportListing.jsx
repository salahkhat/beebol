import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Flex, Heading, Text } from '@radix-ui/themes';
import { AlertTriangle } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { InlineError } from '../ui/InlineError';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';
import { useI18n } from '../i18n/i18n';

const REASONS = ['spam', 'scam', 'prohibited', 'duplicate', 'other'];

export function ReportListingPage() {
  const { t } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const listingId = useMemo(() => {
    const raw = sp.get('listing');
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [sp]);

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [reason, setReason] = useState('spam');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!listingId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await api.listing(listingId, { auth: true });
        if (!cancelled) setListing(res);
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
  }, [listingId]);

  async function submit() {
    if (!listingId) return;
    setSubmitting(true);
    try {
      await api.createReport({ listing: listingId, reason, message: String(message || '').trim() });
      toast.push({ title: t('report_title'), description: t('report_submitted') });
      nav(`/listings/${listingId}`);
    } catch (e) {
      toast.push({
        title: t('report_title'),
        description: e instanceof ApiError ? e.message : String(e),
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!listingId) {
    return (
      <Card>
        <CardHeader>
          <Flex align="center" gap="2">
            <Icon icon={AlertTriangle} size={18} />
            <Heading size="4">{t('report_title')}</Heading>
          </Flex>
        </CardHeader>
        <CardBody>
          <Text size="2" color="gray">{t('report_missing_listing')}</Text>
          <div className="mt-3">
            <Link to="/listings" style={{ textDecoration: 'none' }}>
              <Button variant="secondary">{t('nav_listings')}</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Flex direction="column" gap="4">
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading size="5">{t('report_title')}</Heading>
        <Link to={`/listings/${listingId}`} style={{ textDecoration: 'none' }}>
          <Button variant="secondary">{t('back')}</Button>
        </Link>
      </Flex>

      <Card>
        <CardHeader>
          <Text size="2" color="gray">{t('report_for_listing')}</Text>
          {loading ? (
            <Skeleton className="mt-2 h-5 w-64" />
          ) : listing ? (
            <Link to={`/listings/${listingId}`} style={{ textDecoration: 'none' }}>
              <Text weight="bold" size="3" style={{ wordBreak: 'break-word' }}>{listing.title || t('listing_number', { id: listingId })}</Text>
            </Link>
          ) : null}
        </CardHeader>
        <CardBody>
          <InlineError error={error instanceof ApiError ? error : error} />

          <Flex direction="column" gap="3">
            <Box>
              <Text size="2" color="gray">{t('report_reason')}</Text>
              <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`report_reason_${r}`)}
                  </option>
                ))}
              </Select>
            </Box>

            <Box>
              <Text size="2" color="gray">{t('report_details')}</Text>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} />
            </Box>

            <Flex align="center" gap="2" wrap="wrap">
              <Button onClick={submit} disabled={submitting}>
                {submitting ? t('submitting') : t('submit')}
              </Button>
              <Link to={`/listings/${listingId}`} style={{ textDecoration: 'none' }}>
                <Button variant="secondary">{t('cancel')}</Button>
              </Link>
            </Flex>
          </Flex>
        </CardBody>
      </Card>
    </Flex>
  );
}
