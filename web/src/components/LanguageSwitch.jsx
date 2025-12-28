import { Globe } from 'lucide-react';
import { Button } from '../ui/Button';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { Icon } from '../ui/Icon';
import { useI18n } from '../i18n/i18n';

export function LanguageSwitch() {
  const { locale, setLocale } = useI18n();

  const label = locale === 'ar' ? 'العربية' : 'English';
  const short = locale === 'ar' ? 'AR' : 'EN';

  return (
    <Dropdown
      py="2px"
      trigger={
        <Button
          variant="secondary"
          title={label}
          aria-label={label}
        >
          <span className="inline-flex items-center gap-2">
            <Icon icon={Globe} size={16} />
            <span className="text-xs font-medium tracking-wide">{short}</span>
          </span>
        </Button>
      }
    >
      <DropdownItem
        onSelect={(e) => {
          e.preventDefault();
          setLocale('ar');
        }}
      >
        العربية
      </DropdownItem>
      <DropdownItem
        onSelect={(e) => {
          e.preventDefault();
          setLocale('en');
        }}
      >
        English
      </DropdownItem>
    </Dropdown>
  );
}
