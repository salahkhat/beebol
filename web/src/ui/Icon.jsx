import { forwardRef } from 'react';
import clsx from 'clsx';

/**
 * Small wrapper around lucide-react icons.
 * Usage: <Icon icon={Search} />
 */
export const Icon = forwardRef(function Icon(
  { icon: IconComponent, size = 16, className, 'aria-label': ariaLabel, ...props },
  ref,
) {
  if (!IconComponent) return null;

  return (
    <IconComponent
      ref={ref}
      size={size}
      className={clsx('shrink-0', className)}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      {...props}
    />
  );
});

Icon.displayName = 'Icon';
