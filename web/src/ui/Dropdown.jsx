import { DropdownMenu } from '@radix-ui/themes';

export function Dropdown({ trigger, children }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Content>{children}</DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

export function DropdownItem(props) {
  return <DropdownMenu.Item {...props} />;
}

export function DropdownSeparator() {
  return <DropdownMenu.Separator />;
}
