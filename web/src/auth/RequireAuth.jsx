import { Navigate, useLocation } from 'react-router-dom';
import { Flex, Spinner, Text } from '@radix-ui/themes';
import { useAuth } from './AuthContext';
import { useI18n } from '../i18n/i18n';

function AuthGateLoading() {
  const { t } = useI18n();
  return (
    <Flex align="center" justify="center" direction="column" gap="3" py="7">
      <Spinner size="3" />
      <Text size="2" color="gray">
        {t('loading')}
      </Text>
    </Flex>
  );
}

export function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const loc = useLocation();

  if (loading) return <AuthGateLoading />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

export function RequireStaff({ children }) {
  const { isAuthenticated, isStaff, loading } = useAuth();
  const loc = useLocation();

  if (loading) return <AuthGateLoading />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (!isStaff) return <Navigate to="/listings" replace />;
  return children;
}
