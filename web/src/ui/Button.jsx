import { Button as RTButton } from '@radix-ui/themes';
import { forwardRef } from 'react';
import { cn } from './cn';

const sizeMap = { sm: '2', md: '3', lg: '4' };

export const Button = forwardRef(function Button({ variant = 'primary', size = 'md', ...props }, ref) {
  const { className, ...rest } = props;
  const common = {
    size: sizeMap[size] || '3',
    radius: 'large',
    ref,
    className: cn('bb-btn', className),
  };

  if (variant === 'secondary') {
    return <RTButton {...common} variant="surface" {...rest} />;
  }

  if (variant === 'danger') {
    return <RTButton {...common} color="red" variant="solid" {...rest} />;
  }

  if (variant === 'ghost') {
    return <RTButton {...common} variant="ghost" {...rest} />;
  }

  return <RTButton {...common} variant="solid" {...rest} />;
});

Button.displayName = 'Button';
