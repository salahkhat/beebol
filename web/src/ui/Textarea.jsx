import { TextArea } from '@radix-ui/themes';
import { cn } from './cn';

export function Textarea({ className, ...props }) {
  return <TextArea size="3" radius="large" className={cn('w-full', className)} {...props} />;
}
