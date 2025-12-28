import { DropdownMenu } from '@radix-ui/themes';

export function Dropdown({ trigger, children, ...rootProps }) {
  return (
    <DropdownMenu.Root {...rootProps}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Content className="bb-popover">{children}</DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

export function DropdownItem(props) {
  return <DropdownMenu.Item {...props} />;
}

export function DropdownSeparator() {
  return <DropdownMenu.Separator />;
}
