import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Container, Flex, Heading, Text, Button } from '@radix-ui/themes';
import { api } from '../lib/api';
import { ListingList } from './Listings';
import { useAuth } from '../auth/AuthContext';

export default function ProfilePage() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await api.userProfile(id);
        if (!mounted) return;
        setProfile(res);
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, [id]);

  if (loading) return <Container><Text>Loading…</Text></Container>;
  if (!profile) return <Container><Text>Not found</Text></Container>;

  return (
    <Container>
      <div className="py-6">
        <Flex align="center" gap="4">
          {profile.avatar_medium ? (
            <img src={profile.avatar_medium} alt="avatar" className="h-20 w-20 rounded-full object-cover" />
          ) : profile.avatar ? (
            <img src={profile.avatar} alt="avatar" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="h-20 w-20 rounded-full bg-[var(--gray-a3)]" />
          )}
          <div>
            <Heading size="4">{profile.display_name || 'Unnamed'}</Heading>
            <Text size="2" color="gray">{profile.seller_rating ? `⭐ ${profile.seller_rating}` : ''}</Text>
            <Text size="2" color="gray">{profile.listings_count} {profile.listings_count === 1 ? 'listing' : 'listings'}</Text>
            {isAuthenticated && user && Number(user.id) === Number(profile.user_id) ? (
              <div className="mt-2">
                <Link to="/profile/edit" className="inline-block">
                  <Button variant="secondary">Edit profile</Button>
                </Link>
              </div>
            ) : null}
          </div>
        </Flex>

        <div className="mt-4">
          <Heading size="5">About</Heading>
          <Text>{profile.bio}</Text>
        </div>

        {profile.social_links && profile.social_links.length ? (
          <div className="mt-4">
            <Heading size="5">Social</Heading>
            <div className="mt-2 flex flex-wrap gap-3">
              {profile.social_links.map((s, i) => (
                <a key={i} href={s.url} className="text-blue-600 underline" target="_blank" rel="noreferrer">{s.type || 'link'}</a>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6">
          <Heading size="5">Listings</Heading>
          <div className="mt-2">
            {/* TODO: reuse listings component or fetch listings by seller */}
            <Text size="2" color="gray">Listings will go here</Text>
          </div>
        </div>
      </div>
    </Container>
  );
}