import { Badge as RTBadge } from '@radix-ui/themes';

export function Badge({ variant = 'default', ...props }) {
  if (variant === 'ok') return <RTBadge color="green" variant="soft" radius="full" {...props} />;
  if (variant === 'warn') return <RTBadge color="amber" variant="soft" radius="full" {...props} />;
  if (variant === 'danger') return <RTBadge color="red" variant="soft" radius="full" {...props} />;
  return <RTBadge color="gray" variant="soft" radius="full" {...props} />;
}
