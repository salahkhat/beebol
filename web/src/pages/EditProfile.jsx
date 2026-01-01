import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flex, Heading, Text } from '@radix-ui/themes';
import { api } from '../lib/api';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { InlineError } from '../ui/InlineError';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import { useI18n } from '../i18n/i18n';

export default function EditProfilePage() {
  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [socialLinks, setSocialLinks] = useState([]);
  const [fetchError, setFetchError] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useI18n();

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await api.meProfile();
        if (!mounted) return;
        if (res) {
          setProfile(res);
          setDisplayName(res.display_name || '');
          setSocialLinks(Array.isArray(res.social_links) ? res.social_links : []);
        }
      } catch (e) {
        // Mark fetch error and continue to avoid crashes
        console.error('Failed to fetch meProfile', e);
        setFetchError(e);
      } finally {
        setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function onFileChange(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setAvatarFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
  }

  async function onSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateMeProfile({ display_name: displayName, social_links: socialLinks });
      if (avatarFile) {
        await api.uploadAvatar(avatarFile);
      }
      // reload profile
      const res = await api.meProfile();
      setProfile(res);
      setAvatarFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      toast.push({ title: t('toast_saved') });
      navigate(`/profile/${res.user_id}`);
    } catch (err) {
      toast.push({ title: t('profile_save_failed'), description: String(err?.message || err), variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardBody>
          <Flex direction="column" gap="4">
            <div>
              <Skeleton className="h-4 w-32" />
              <div className="mt-2">
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div>
              <Skeleton className="h-4 w-24" />
              <Flex align="center" gap="4" mt="2">
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="h-10 w-40" />
              </Flex>
            </div>
            <div>
              <Skeleton className="h-4 w-28" />
              <div className="mt-2">
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </Flex>
        </CardBody>
      </Card>
    );
  }

  return (
    <Flex direction="column" gap="4" className="mx-auto max-w-2xl">
      <InlineError
        error={fetchError}
        onRetry={() => {
          // trigger a reload by mimicking initial mount behavior
          setLoading(true);
          setFetchError(null);
          api
            .meProfile()
            .then((res) => {
              setProfile(res || {});
              setDisplayName(res?.display_name || '');
              setSocialLinks(Array.isArray(res?.social_links) ? res.social_links : []);
            })
            .catch((e) => setFetchError(e))
            .finally(() => setLoading(false));
        }}
      />

      <form onSubmit={onSave}>
        <Card>
          <CardHeader>
            <Flex direction="column" gap="1">
              <Heading size="5">{t('profile_edit_title')}</Heading>
              <Text size="2" color="gray">
                {t('profile_edit_subtitle')}
              </Text>
            </Flex>
          </CardHeader>
          <CardBody>
            <Flex direction="column" gap="5">
              <div>
                <Text as="div" size="2" color="gray" className="mb-2">
                  {t('profile_display_name')}
                </Text>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>

              <div>
                <Text as="div" size="2" color="gray" className="mb-2">
                  {t('profile_avatar')}
                </Text>
                <Flex align="center" gap="4" wrap="wrap">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-[var(--gray-a5)] bg-[var(--color-panel-solid)]">
                    {previewUrl ? (
                      <img src={previewUrl} alt="preview" className="h-20 w-20 object-cover" />
                    ) : profile?.avatar_medium ? (
                      <img src={normalizeMediaUrl(profile.avatar_medium)} alt="avatar" className="h-20 w-20 object-cover" />
                    ) : (
                      <div className="h-20 w-20 bg-[var(--gray-a3)]" />
                    )}
                  </div>
                  <div style={{ minWidth: 240 }}>
                    <input name="avatar" type="file" accept="image/*" onChange={onFileChange} />
                    <Text as="div" size="2" color="gray" className="mt-2">
                      {t('profile_avatar_help')}
                    </Text>
                  </div>
                </Flex>
              </div>

              <div>
                <Text as="div" size="2" color="gray" className="mb-2">
                  {t('profile_social_links')}
                </Text>

                <Flex direction="column" gap="2">
                  {socialLinks.map((s, idx) => (
                    <Flex key={idx} gap="2" align="center" wrap="wrap">
                      <div className="w-full sm:w-[160px]">
                        <Select
                          value={String((s && s.type) || '')}
                          onChange={(e) => {
                            const copy = [...socialLinks];
                            copy[idx] = { ...copy[idx], type: e.target.value };
                            setSocialLinks(copy);
                          }}
                        >
                          <option value="">{t('profile_social_type')}</option>
                          <option value="twitter">{t('social_twitter')}</option>
                          <option value="facebook">{t('social_facebook')}</option>
                          <option value="instagram">{t('social_instagram')}</option>
                          <option value="website">{t('social_website')}</option>
                        </Select>
                      </div>

                      <div className="w-full sm:flex-1" style={{ minWidth: 240 }}>
                        <Input
                          value={s?.url || ''}
                          onChange={(e) => {
                            const copy = [...socialLinks];
                            copy[idx] = { ...copy[idx], url: e.target.value };
                            setSocialLinks(copy);
                          }}
                          placeholder="https://..."
                        />
                      </div>

                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          const copy = [...socialLinks];
                          copy.splice(idx, 1);
                          setSocialLinks(copy);
                        }}
                      >
                        {t('remove')}
                      </Button>
                    </Flex>
                  ))}

                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setSocialLinks([...socialLinks, { type: '', url: '' }])}
                    >
                      {t('profile_social_add_link')}
                    </Button>
                    <Text as="div" size="2" color="gray" className="mt-2">
                      {t('profile_social_help')}
                    </Text>
                  </div>
                </Flex>
              </div>

              <div className="pt-1">
                <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                  {saving ? t('saving') : t('save')}
                </Button>
              </div>
            </Flex>
          </CardBody>
        </Card>
      </form>
    </Flex>
  );
}
