import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { Button } from './Button';
import { Icon } from './Icon';
import { isFavorite, onFavoritesChange, toggleFavorite } from '../lib/favorites';
import { useI18n } from '../i18n/i18n';

export function FavoriteButton({ listingId, size = 'sm' }) {
  const { t } = useI18n();
  const id = Number(listingId);
  const [fav, setFav] = useState(() => (Number.isFinite(id) ? isFavorite(id) : false));

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    setFav(isFavorite(id));
    return onFavoritesChange(() => setFav(isFavorite(id)));
  }, [id]);

  if (!Number.isFinite(id)) return null;

  return (
    <Button
      type="button"
      size={size}
      variant="ghost"
      onClick={(e) => {
        e.preventDefault();
        toggleFavorite(id);
        setFav(isFavorite(id));
      }}
      aria-pressed={fav}
      title={fav ? t('favorite_remove') : t('favorite_add')}
    >
      <Icon
        icon={Heart}
        size={16}
        className={fav ? 'text-[var(--red-11)]' : 'text-[var(--gray-11)]'}
        style={fav ? { fill: 'currentColor' } : undefined}
        aria-label=""
      />
    </Button>
  );
}
