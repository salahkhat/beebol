import { Button } from '../ui/Button';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { useI18n } from '../i18n/i18n';

export function LanguageSwitch() {
  const { locale, setLocale } = useI18n();

  const label = locale === 'ar' ? 'العربية' : 'English';

  return (
    <Dropdown
      trigger={<Button variant="secondary" size="sm">{label}</Button>}
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
