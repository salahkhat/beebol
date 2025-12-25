import { Box, Dialog as RTDialog } from '@radix-ui/themes';

export function Dialog({ open, onOpenChange, title, description, children, footer, maxWidth = '480px' }) {
  return (
    <RTDialog.Root open={open} onOpenChange={onOpenChange}>
      <RTDialog.Content maxWidth={maxWidth} className="bb-popover">
        {title ? <RTDialog.Title>{title}</RTDialog.Title> : null}
        {description ? <RTDialog.Description>{description}</RTDialog.Description> : null}

        <Box mt="3">{children}</Box>
        {footer ? <Box mt="3">{footer}</Box> : null}
      </RTDialog.Content>
    </RTDialog.Root>
  );
}
