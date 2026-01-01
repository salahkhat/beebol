import { Select as RTSelect } from '@radix-ui/themes';
import { Children, isValidElement } from 'react';
import { cn } from './cn';

function optionsFromChildren(children) {
  const out = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    // We only support the usage pattern in this app: <Select><option .../></Select>
    if (child.type === 'option') {
      out.push({ value: child.props.value, label: child.props.children });
    }
  });
  return out;
}

export function Select({ className, children, value, onChange, disabled, onBlur, onFocus }) {
  const EMPTY_VALUE = '__rt_empty__';

  const opts = optionsFromChildren(children);
  const placeholder = opts.find((o) => o.value === '')?.label;
  const items = opts.filter((o) => o.value !== '');

  const hasPlaceholder = Boolean(placeholder);
  const rtValue = value === '' || value == null ? (hasPlaceholder ? EMPTY_VALUE : undefined) : String(value);

  function handleValueChange(v) {
    if (v === EMPTY_VALUE) {
      onChange?.({ target: { value: '' } });
      return;
    }
    onChange?.({ target: { value: v } });
  }

  return (
    <RTSelect.Root value={rtValue} onValueChange={handleValueChange} disabled={disabled}>
      <RTSelect.Trigger
        className={cn('w-full', className)}
        placeholder={placeholder}
        onBlur={onBlur}
        onFocus={onFocus}
      />
      <RTSelect.Content>
        {placeholder ? (
          <RTSelect.Item value={EMPTY_VALUE}>
            {placeholder}
          </RTSelect.Item>
        ) : null}
        {items.map((o) => (
          <RTSelect.Item key={String(o.value)} value={String(o.value)}>
            {o.label}
          </RTSelect.Item>
        ))}
      </RTSelect.Content>
    </RTSelect.Root>
  );
}
