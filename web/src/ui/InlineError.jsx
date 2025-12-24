import { Callout, Flex, Text } from '@radix-ui/themes';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Icon } from './Icon';
import { Button } from './Button';
import { useI18n } from '../i18n/i18n';

export function InlineError({ error, onRetry }) {
  const { t } = useI18n();
  if (!error) return null;

  const message = String(error?.message || error);

  return (
    <Callout.Root color="red" variant="surface">
      <Callout.Text>
        <Flex align="start" justify="between" gap="3" wrap="wrap">
          <Flex align="center" gap="2" style={{ minWidth: 0, flex: 1 }}>
            <Icon icon={AlertTriangle} size={16} className="text-[var(--red-11)]" aria-label="" />
            <span style={{ wordBreak: 'break-word' }}>{message}</span>
          </Flex>

          {onRetry ? (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              <Flex align="center" gap="2">
                <Icon icon={RefreshCcw} size={14} />
                <Text as="span" size="2">
                  {t('retry')}
                </Text>
              </Flex>
            </Button>
          ) : null}
        </Flex>
      </Callout.Text>
    </Callout.Root>
  );
}
