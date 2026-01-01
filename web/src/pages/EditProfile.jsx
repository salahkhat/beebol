import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Flex, Heading, Text, Button } from '@radix-ui/themes';
import { api } from '../lib/api';

export default function EditProfilePage() {
  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState(null);
  const [socialLinks, setSocialLinks] = useState([]);
  const [fetchError, setFetchError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setFetchError(false);
      try {
        const res = await api.meProfile();
        if (!mounted) return;
        if (res) {
          setProfile(res);
          setDisplayName(res.display_name || '');
          setBio(res.bio || '');
          setSocialLinks(Array.isArray(res.social_links) ? res.social_links : []);
        }
      } catch (e) {
        // Mark fetch error and continue to avoid crashes
        console.error('Failed to fetch meProfile', e);
        setFetchError(true);
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
      await api.updateMeProfile({ display_name: displayName, bio, social_links: socialLinks });
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
      // upload cover if present
      if (coverFile) {
        await api.uploadCover(coverFile);
        setCoverFile(null);
        if (coverPreviewUrl) {
          URL.revokeObjectURL(coverPreviewUrl);
          setCoverPreviewUrl(null);
        }
      }
      alert('Profile updated');
      navigate(`/profile/${res.user_id}`);
    } catch (err) {
      alert('Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Container><Text>Loading…</Text></Container>;
  if (fetchError) return <Container><Text>An error occurred loading your profile — try reloading the page.</Text></Container>;

  return (
    <Container>
      <form onSubmit={onSave} className="py-6">
        <Heading size="4">Edit profile</Heading>

        <div className="mt-4">
          <label className="block text-sm font-medium">Avatar</label>
          <div className="mt-2 flex items-center gap-4">
            <div className="h-20 w-20 rounded-full overflow-hidden bg-[var(--gray-a3)]">
              {previewUrl ? (
                // preview from selected file
                <img src={previewUrl} alt="preview" className="h-20 w-20 object-cover" />
              ) : profile?.avatar_medium ? (
                <img src={profile.avatar_medium} alt="avatar" className="h-20 w-20 object-cover" />
              ) : (
                <div className="h-20 w-20" />
              )}
            </div>
            <div>
              <input name="avatar" type="file" accept="image/*" onChange={onFileChange} />
              <div className="mt-2 text-sm text-gray-500">Max size 5MB. JPG/PNG recommended.</div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium">Cover</label>
          <div className="mt-2">
            <div className="w-full h-40 rounded overflow-hidden bg-[var(--gray-a3)]">
              {coverPreviewUrl ? (
                <img src={coverPreviewUrl} alt="cover-preview" className="w-full h-full object-cover" />
              ) : profile?.cover_medium ? (
                <img src={profile.cover_medium} alt="cover" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full" />
              )}
            </div>
            <div className="mt-2">
              <input name="cover" type="file" accept="image/*" onChange={(e) => {
                const f = e.target.files && e.target.files[0];
                if (!f) return;
                setCoverFile(f);
                const url = URL.createObjectURL(f);
                setCoverPreviewUrl(url);
              }} />
              <div className="mt-2 text-sm text-gray-500">Max size 8MB. Wide images recommended (1200×400).</div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium">Social links</label>
          <div className="mt-2 space-y-2">
            {socialLinks.map((s, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select value={(s && s.type) || ''} onChange={(e) => {
                  const copy = [...socialLinks];
                  copy[idx] = { ...copy[idx], type: e.target.value };
                  setSocialLinks(copy);
                }} className="rounded border px-2 py-1">
                  <option value="">Type</option>
                  <option value="twitter">Twitter</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="website">Website</option>
                </select>
                <input value={s.url || ''} onChange={(e) => {
                  const copy = [...socialLinks];
                  copy[idx] = { ...copy[idx], url: e.target.value };
                  setSocialLinks(copy);
                }} placeholder="https://..." className="flex-1 rounded border px-2 py-1" />
                <button type="button" className="text-red-600" onClick={() => {
                  const copy = [...socialLinks];
                  copy.splice(idx, 1);
                  setSocialLinks(copy);
                }}>Remove</button>
              </div>
            ))}

            <div>
              <button type="button" className="rounded border px-3 py-1" onClick={() => setSocialLinks([...socialLinks, { type: '', url: '' }])}>Add link</button>
              <div className="mt-1 text-sm text-gray-500">Add links to social profiles or a personal website.</div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium">Display name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium">Bio</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2 h-28" />
        </div>

        <div className="mt-6">
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Container>
  );
}
