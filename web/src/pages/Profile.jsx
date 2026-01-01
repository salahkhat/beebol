import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Flex, Heading, Text } from '@radix-ui/themes';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/i18n';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { InlineError } from '../ui/InlineError';
import { User } from 'lucide-react';
import { normalizeMediaUrl } from '../lib/mediaUrl';

export default function ProfilePage() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const { t } = useI18n();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.userProfile(id);
        if (!mounted) return;
        setProfile(res);
      } catch (e) {
        if (!mounted) return;
        setProfile(null);
        setError(e);
      } finally {
        setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, [id, reloadNonce]);

  const avatarUrl = profile?.avatar_thumbnail || profile?.avatar_medium || profile?.avatar || null;

  function socialTypeLabel(type) {
    const raw = String(type || '').trim();
    if (!raw) return t('social_link');
    const key = `social_${raw.toLowerCase()}`;
    const translated = t(key);
    return translated === key ? raw : translated;
  }

  if (loading) {
    return (
      <Flex direction="column" gap="4">
        <Card>
          <CardBody>
            <Skeleton className="h-40 w-full" />
            <Flex align="center" gap="4" mt="3">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Skeleton className="h-5 w-48" />
                <div className="mt-2">
                  <Skeleton className="h-4 w-36" />
                </div>
              </div>
            </Flex>
          </CardBody>
        </Card>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex direction="column" gap="4">
        <InlineError error={error} onRetry={() => setReloadNonce((n) => n + 1)} />
        <EmptyState icon={User}>{t('unexpected_error')}</EmptyState>
      </Flex>
    );
  }

  if (!profile) {
    return (
      <EmptyState icon={User}>{t('notFound')}</EmptyState>
    );
  }

  return (
    <Flex direction="column" gap="4">
      <Card>
        <CardBody>
          <Flex align="center" justify="between" gap="4" wrap="wrap">
            <Flex align="center" gap="4" style={{ minWidth: 0, flex: 1 }}>
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-[var(--gray-a5)] bg-[var(--color-panel-solid)]">
                {avatarUrl ? (
                  <img src={normalizeMediaUrl(avatarUrl)} alt="avatar" className="h-20 w-20 object-cover" />
                ) : (
                  <div className="h-20 w-20 bg-[var(--gray-a3)]" />
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <Heading size="4" style={{ wordBreak: 'break-word' }}>
                  {profile.display_name || t('account')}
                </Heading>
                <Flex align="center" gap="2" wrap="wrap" mt="2">
                  {profile.seller_rating != null ? <Badge>⭐ {profile.seller_rating}</Badge> : null}
                  <Badge>{t('seller_listings_count', { count: profile.listings_count })}</Badge>
                </Flex>
              </div>
            </Flex>

            {isAuthenticated && user && Number(user.id) === Number(profile.user_id) ? (
              <Link to="/profile/edit">
                <Button variant="secondary">{t('profile_edit_button')}</Button>
              </Link>
            ) : null}
          </Flex>
        </CardBody>
      </Card>

      {Array.isArray(profile.social_links) && profile.social_links.length ? (
        <Card>
          <CardHeader>
            <Heading size="3">{t('profile_social_title')}</Heading>
          </CardHeader>
          <CardBody>
            <Flex gap="2" wrap="wrap">
              {profile.social_links
                .filter((s) => s && s.url)
                .map((s, i) => (
                  <Button key={i} asChild variant="secondary" size="sm">
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {socialTypeLabel(s.type)}
                    </a>
                  </Button>
                ))}
            </Flex>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <Heading size="3">{t('profile_listings_title')}</Heading>
        </CardHeader>
        <CardBody>
          <Text size="2" color="gray">
            {t('profile_listings_placeholder')}
          </Text>
        </CardBody>
      </Card>
    </Flex>
  );
}