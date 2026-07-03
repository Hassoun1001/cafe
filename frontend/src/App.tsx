import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Layout } from './layout/Layout';
import { LoginPage } from './pages/LoginPage';
import { Spinner } from './components/ui';

const PosPage = lazy(() => import('./pages/PosPage').then((m) => ({ default: m.PosPage })));
const TablesPage = lazy(() => import('./pages/TablesPage').then((m) => ({ default: m.TablesPage })));
const WarehousePage = lazy(() => import('./pages/WarehousePage').then((m) => ({ default: m.WarehousePage })));
const TrackerPage = lazy(() => import('./pages/TrackerPage').then((m) => ({ default: m.TrackerPage })));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage').then((m) => ({ default: m.EmployeesPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

function ProtectedLayout() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<Navigate to="/pos" replace />} />
        <Route
          path="/pos"
          element={
            <Suspense fallback={<Spinner />}>
              <PosPage />
            </Suspense>
          }
        />
        <Route
          path="/tables"
          element={
            <Suspense fallback={<Spinner />}>
              <TablesPage />
            </Suspense>
          }
        />
        <Route
          path="/warehouse"
          element={
            <Suspense fallback={<Spinner />}>
              <WarehousePage />
            </Suspense>
          }
        />
        <Route
          path="/tracker"
          element={
            <Suspense fallback={<Spinner />}>
              <TrackerPage />
            </Suspense>
          }
        />
        <Route
          path="/employees"
          element={
            <Suspense fallback={<Spinner />}>
              <EmployeesPage />
            </Suspense>
          }
        />
        <Route
          path="/reports"
          element={
            <Suspense fallback={<Spinner />}>
              <ReportsPage />
            </Suspense>
          }
        />
        <Route
          path="/settings"
          element={
            <Suspense fallback={<Spinner />}>
              <SettingsPage />
            </Suspense>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
