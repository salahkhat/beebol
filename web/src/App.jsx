import { Suspense, lazy } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import './styles.css';

import { AppLayout } from './components/AppLayout';
import { RequireAuth, RequireStaff } from './auth/RequireAuth';
import { useI18n } from './i18n/i18n';
import { Callout, Flex, Spinner, Text } from '@radix-ui/themes';
import { Button } from './ui/Button';
import { ErrorBoundary } from './ui/ErrorBoundary';

const ListingsPage = lazy(() => import('./pages/Listings').then((m) => ({ default: m.ListingsPage })));
const ListingDetailPage = lazy(() => import('./pages/ListingDetail').then((m) => ({ default: m.ListingDetailPage })));
const LoginPage = lazy(() => import('./pages/Login').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/Register').then((m) => ({ default: m.RegisterPage })));
const CreateListingPage = lazy(() => import('./pages/CreateListing').then((m) => ({ default: m.CreateListingPage })));
const MyListingsPage = lazy(() => import('./pages/MyListings').then((m) => ({ default: m.MyListingsPage })));
const SellerProfilePage = lazy(() => import('./pages/SellerProfile').then((m) => ({ default: m.SellerProfilePage })));
const SavedSearchesPage = lazy(() => import('./pages/SavedSearches').then((m) => ({ default: m.SavedSearchesPage })));
const ReportListingPage = lazy(() => import('./pages/ReportListing').then((m) => ({ default: m.ReportListingPage })));
const CompareListingsPage = lazy(() => import('./pages/CompareListings').then((m) => ({ default: m.CompareListingsPage })));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboardPage })));
const AdminModerationPage = lazy(() => import('./pages/AdminModeration').then((m) => ({ default: m.AdminModerationPage })));
const ThreadsPage = lazy(() => import('./pages/Threads').then((m) => ({ default: m.ThreadsPage })));
const ThreadDetailPage = lazy(() => import('./pages/ThreadDetail').then((m) => ({ default: m.ThreadDetailPage })));

function RouteLoading() {
  const { t } = useI18n();
  return (
    <Flex align="center" gap="2" className="py-6">
      <Spinner size="2" />
      <Text size="2" color="gray">
        {t('loading')}
      </Text>
    </Flex>
  );
}

function withSuspense(el) {
  return <Suspense fallback={<RouteLoading />}>{el}</Suspense>;
}

function NotFound() {
  const { t } = useI18n();
  return (
    <Callout.Root variant="surface">
      <Callout.Text>{t('notFound')}</Callout.Text>
      <div className="mt-3">
        <Link to="/listings" className="inline-block">
          <Button variant="secondary">{t('nav_listings')}</Button>
        </Link>
      </div>
    </Callout.Root>
  );
}

export function App() {
  const { t } = useI18n();
  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <ErrorBoundary
              fallback={() => (
                <div className="min-h-screen bg-[var(--gray-1)]">
                  <div className="mx-auto w-full max-w-5xl px-4 py-10">
                    <Callout.Root color="red" variant="surface">
                      <Callout.Text>{t('unexpected_error')}</Callout.Text>
                    </Callout.Root>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          window.location.reload();
                        }}
                      >
                        {t('reload')}
                      </Button>
                      <Link to="/listings" className="inline-block">
                        <Button variant="secondary">{t('nav_listings')}</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            >
              <AppLayout />
            </ErrorBoundary>
          }
        >
          <Route path="/" element={<Navigate to="/listings" replace />} />
          <Route path="/listings" element={withSuspense(<ListingsPage />)} />
          <Route path="/listings/:id" element={withSuspense(<ListingDetailPage />)} />
          <Route path="/sellers/:id" element={withSuspense(<SellerProfilePage />)} />
          <Route path="/compare" element={withSuspense(<CompareListingsPage />)} />
          <Route path="/login" element={withSuspense(<LoginPage />)} />
          <Route path="/register" element={withSuspense(<RegisterPage />)} />

          <Route
            path="/create"
            element={
              <RequireAuth>
                {withSuspense(<CreateListingPage />)}
              </RequireAuth>
            }
          />
          <Route
            path="/my"
            element={
              <RequireAuth>
                {withSuspense(<MyListingsPage />)}
              </RequireAuth>
            }
          />
          <Route
            path="/saved-searches"
            element={
              <RequireAuth>
                {withSuspense(<SavedSearchesPage />)}
              </RequireAuth>
            }
          />
          <Route
            path="/reports/new"
            element={
              <RequireAuth>
                {withSuspense(<ReportListingPage />)}
              </RequireAuth>
            }
          />
          <Route
            path="/threads"
            element={
              <RequireAuth>
                {withSuspense(<ThreadsPage />)}
              </RequireAuth>
            }
          />
          <Route
            path="/threads/:id"
            element={
              <RequireAuth>
                {withSuspense(<ThreadDetailPage />)}
              </RequireAuth>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <RequireStaff>
                {withSuspense(<AdminDashboardPage />)}
              </RequireStaff>
            }
          />

          <Route
            path="/admin/moderation"
            element={
              <RequireStaff>
                {withSuspense(<AdminModerationPage />)}
              </RequireStaff>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
