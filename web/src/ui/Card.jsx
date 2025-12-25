import { Box, Card as RTCard } from '@radix-ui/themes';
import { cn } from './cn';

export function Card({ className, ...props }) {
  return <RTCard size="2" className={cn('bb-card w-full', className)} {...props} />;
}

export function CardHeader({ className, ...props }) {
  return (
    <Box
      p={{ initial: '3', sm: '4' }}
      className={cn('border-b border-[var(--gray-a5)]', className)}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }) {
  return <Box p={{ initial: '3', sm: '4' }} className={className} {...props} />;
}
