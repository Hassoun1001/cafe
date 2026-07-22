import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { StudyAuthProvider, useStudyAuth } from './lib/studyAuth';
import { Layout } from './layout/Layout';
import { StudyLayout } from './layout/StudyLayout';
import { UnifiedLoginPage } from './pages/UnifiedLoginPage';
import { Spinner } from './components/ui';

const PosPage = lazy(() => import('./pages/PosPage').then((m) => ({ default: m.PosPage })));
const TablesPage = lazy(() => import('./pages/TablesPage').then((m) => ({ default: m.TablesPage })));
const WarehousePage = lazy(() => import('./pages/WarehousePage').then((m) => ({ default: m.WarehousePage })));
const TrackerPage = lazy(() => import('./pages/TrackerPage').then((m) => ({ default: m.TrackerPage })));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage').then((m) => ({ default: m.EmployeesPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const BoardPage = lazy(() => import('./pages/study/BoardPage').then((m) => ({ default: m.BoardPage })));
const HistoryPage = lazy(() => import('./pages/study/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const StudySettingsPage = lazy(() => import('./pages/study/StudySettingsPage').then((m) => ({ default: m.StudySettingsPage })));

function ProtectedLayout() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout />;
}

function StudyProtectedLayout() {
  const { isAuthenticated } = useStudyAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <StudyLayout />;
}

// Settings is reachable by ADMIN, or by a STAFF account granted at least one
// permission (every current permission key leads to a control that lives
// somewhere on this page) — this is UI-level convenience (the backend
// independently rejects every ungranted request regardless), but it keeps a
// STAFF account with zero permissions from landing on an empty-looking page.
function CafeSettingsGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, permissions } = useAuth();
  if (!isAdmin && permissions.length === 0) return <Navigate to="/pos" replace />;
  return <>{children}</>;
}

function StudySettingsGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, permissions } = useStudyAuth();
  if (!isAdmin && permissions.length === 0) return <Navigate to="/study/board" replace />;
  return <>{children}</>;
}

// The Cafe and Study apps are two independent systems sharing one deploy —
// separate auth contexts, separate route trees, and neither can
// authenticate against the other. They share one login page
// (UnifiedLoginPage, mounted at the top level below) where the user picks
// which system to sign into before entering a username/password.
function CafeApp() {
  return (
    <Routes>
      <Route element={<ProtectedLayout />}>
        <Route index element={<Navigate to="pos" replace />} />
        <Route
          path="pos"
          element={
            <Suspense fallback={<Spinner />}>
              <PosPage />
            </Suspense>
          }
        />
        <Route
          path="tables"
          element={
            <Suspense fallback={<Spinner />}>
              <TablesPage />
            </Suspense>
          }
        />
        <Route
          path="warehouse"
          element={
            <Suspense fallback={<Spinner />}>
              <WarehousePage />
            </Suspense>
          }
        />
        <Route
          path="tracker"
          element={
            <Suspense fallback={<Spinner />}>
              <TrackerPage />
            </Suspense>
          }
        />
        <Route
          path="employees"
          element={
            <Suspense fallback={<Spinner />}>
              <EmployeesPage />
            </Suspense>
          }
        />
        <Route
          path="reports"
          element={
            <Suspense fallback={<Spinner />}>
              <ReportsPage />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <CafeSettingsGuard>
              <Suspense fallback={<Spinner />}>
                <SettingsPage />
              </Suspense>
            </CafeSettingsGuard>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function StudyApp() {
  return (
    <Routes>
      <Route element={<StudyProtectedLayout />}>
        <Route index element={<Navigate to="board" replace />} />
        <Route
          path="board"
          element={
            <Suspense fallback={<Spinner />}>
              <BoardPage />
            </Suspense>
          }
        />
        <Route
          path="history"
          element={
            <Suspense fallback={<Spinner />}>
              <HistoryPage />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <StudySettingsGuard>
              <Suspense fallback={<Spinner />}>
                <StudySettingsPage />
              </Suspense>
            </StudySettingsGuard>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/study" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <StudyAuthProvider>
        <Routes>
          <Route path="/login" element={<UnifiedLoginPage />} />
          <Route path="/study/*" element={<StudyApp />} />
          <Route path="/*" element={<CafeApp />} />
        </Routes>
      </StudyAuthProvider>
    </AuthProvider>
  );
}
