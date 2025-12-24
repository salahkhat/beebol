import { cn } from './cn';

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('rounded-md bg-[var(--gray-a3)]', className)}
      {...props}
    />
  );
}
