import { ImageOff } from 'lucide-react';
import { cn } from './cn';
import { Icon } from './Icon';

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
  const containerClassName = cn(
    'shrink-0 overflow-hidden rounded-md border border-[var(--gray-a5)] bg-[var(--color-panel-solid)]',
    className,
  );

  const content = src ? (
    <img
      src={src}
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

  if (src && onClick) {
    return (
      <button type="button" className={containerClassName} onClick={onClick} aria-label={ariaLabel}>
        {content}
      </button>
    );
  }

  return (
    <div
      className={containerClassName}
      role={src ? undefined : 'img'}
      aria-label={src ? undefined : ariaLabel || placeholder}
    >
      {content}
    </div>
  );
}
