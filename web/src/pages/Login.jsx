import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Flex, Heading, Link as RTLink, Text } from '@radix-ui/themes';
import { KeyRound, LogIn, User } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { InlineError } from '../ui/InlineError';
import { useI18n } from '../i18n/i18n';

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const { t } = useI18n();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login({ username, password });
      toast.push({ title: t('login') });
      const next = loc.state?.from || '/listings';
      nav(next);
    } catch (e2) {
      setError(e2);
      toast.push({ title: t('auth_login_title'), description: String(e2.message || e2), variant: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <Flex direction="column" gap="2">
          <Heading size="5">{t('auth_login_title')}</Heading>
          <Text size="2" color="gray">
            {t('auth_noAccount')}{' '}
            <RTLink asChild underline="always" highContrast>
              <Link to="/register">{t('register')}</Link>
            </RTLink>
          </Text>
        </Flex>
      </CardHeader>
      <CardBody>
        <InlineError error={error} />
        <form className="space-y-5" onSubmit={onSubmit}>
          <div>
            <Flex align="center" gap="2" mb="1">
              <Icon icon={User} size={16} className="text-[var(--gray-11)]" aria-label="" />
              <Text as="div" size="2" color="gray">
                {t('auth_username')}
              </Text>
            </Flex>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </div>
          <div>
            <Flex align="center" gap="2" mb="1">
              <Icon icon={KeyRound} size={16} className="text-[var(--gray-11)]" aria-label="" />
              <Text as="div" size="2" color="gray">
                {t('auth_password')}
              </Text>
            </Flex>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="pt-1">
            <Button type="submit" disabled={busy || !username || !password} className="w-full">
              {busy ? (
                t('loading')
              ) : (
                <Flex align="center" justify="center" gap="2">
                  <Icon icon={LogIn} size={16} />
                  <Text as="span" size="2">
                    {t('login')}
                  </Text>
                </Flex>
              )}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
