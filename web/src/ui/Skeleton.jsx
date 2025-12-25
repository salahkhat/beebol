import { cn } from './cn';

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('bb-skeleton rounded-md', className)}
      {...props}
    />
  );
}
