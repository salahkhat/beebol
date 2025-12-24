import { Callout, Flex } from '@radix-ui/themes';
import { Icon } from './Icon';

export function EmptyState({ icon, children }) {
  return (
    <Callout.Root variant="surface">
      <Callout.Text>
        <Flex align="center" gap="2">
          {icon ? <Icon icon={icon} size={16} className="text-[var(--gray-11)]" aria-label="" /> : null}
          <span>{children}</span>
        </Flex>
      </Callout.Text>
    </Callout.Root>
  );
}
