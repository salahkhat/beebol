import { ImageOff } from 'lucide-react';
import { cn } from './cn';
import { Icon } from './Icon';
import { normalizeMediaUrl } from '../lib/mediaUrl';

export function ListingThumbnail({
  src,
  alt = '',
  onClick,
  ariaLabel,
  placeholder = 'No image',
  className,
  imgClassName,
  loading = 'lazy',
}) {
  const normalizedSrc = normalizeMediaUrl(src);
  const containerClassName = cn(
    'shrink-0 overflow-hidden rounded-md border border-[var(--gray-a5)] bg-[var(--color-panel-solid)]',
    className,
  );

  const content = normalizedSrc ? (
    <img
      src={normalizedSrc}
      alt={alt}
      className={cn('h-full w-full object-cover', imgClassName)}
      loading={loading}
    />
  ) : (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center">
      <Icon icon={ImageOff} size={16} className="text-[var(--gray-11)]" aria-label="" />
      <span className="text-[10px] leading-tight text-[var(--gray-11)]">{placeholder}</span>
    </div>
  );

  if (normalizedSrc && onClick) {
    return (
      <button type="button" className={containerClassName} onClick={onClick} aria-label={ariaLabel}>
        {content}
      </button>
    );
  }

  return (
    <div
      className={containerClassName}
      role={normalizedSrc ? undefined : 'img'}
      aria-label={normalizedSrc ? undefined : ariaLabel || placeholder}
    >
      {content}
    </div>
  );
}
