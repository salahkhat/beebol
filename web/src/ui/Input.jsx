import { TextField } from '@radix-ui/themes';
import { cn } from './cn';

export function Input({ className, ...props }) {
  return (
    <TextField.Root
      size="3"
      radius="large"
      className={cn('w-full', className)}
      {...props}
    />
  );
}
