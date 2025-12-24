import { Button as RTButton } from '@radix-ui/themes';
import { forwardRef } from 'react';

const sizeMap = { sm: '2', md: '3', lg: '4' };

export const Button = forwardRef(function Button({ variant = 'primary', size = 'md', ...props }, ref) {
  const common = {
    size: sizeMap[size] || '3',
    radius: 'large',
    ref,
  };

  if (variant === 'secondary') {
    return <RTButton {...common} variant="surface" {...props} />;
  }

  if (variant === 'danger') {
    return <RTButton {...common} color="red" variant="solid" {...props} />;
  }

  if (variant === 'ghost') {
    return <RTButton {...common} variant="ghost" {...props} />;
  }

  return <RTButton {...common} variant="solid" {...props} />;
});

Button.displayName = 'Button';
