import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import LoginPage         from './pages/Login/LoginPage';
import DashboardPage     from './pages/Dashboard/DashboardPage';
import FaultsPage        from './pages/Faults/FaultsPage';
import JobsPage          from './pages/Jobs/JobsPage';
import UsersPage         from './pages/Users/UsersPage';
import BranchesPage      from './pages/Branches/BranchesPage';
import InventoryPage     from './pages/Inventory/InventoryPage';
import VehiclesPage      from './pages/Vehicles/VehiclesPage';
import PaymentsPage      from './pages/Payments/PaymentsPage';
import KpiPage           from './pages/KPI/KpiPage';
import NotificationsPage from './pages/Notifications/NotificationsPage';
import AIDashboardPage   from './pages/AI/AIDashboardPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>

          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/*
            ── KEY FIX ──────────────────────────────────────────────────────
            Layout uses <Outlet />, so ALL protected pages MUST be declared
            as CHILD routes of the Layout route — NOT as siblings.
            The old pattern <Layout><Page/></Layout> bypasses <Outlet /> and
            causes the content area to stay blank on every navigation click.
            ─────────────────────────────────────────────────────────────────
          */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* Available to all authenticated roles */}
            <Route path="/dashboard"     element={<DashboardPage />} />
            <Route path="/faults"        element={<FaultsPage />} />
            <Route path="/jobs"          element={<JobsPage />} />
            <Route path="/inventory"     element={<InventoryPage />} />
            <Route path="/vehicles"      element={<VehiclesPage />} />
            <Route path="/kpi"           element={<KpiPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />

            {/* Admin + Super Admin only */}
            <Route path="/ai-dashboard" element={
              <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
                <AIDashboardPage />
              </ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
                <UsersPage />
              </ProtectedRoute>
            } />
            <Route path="/payments" element={
              <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
                <PaymentsPage />
              </ProtectedRoute>
            } />

            {/* Super Admin only */}
            <Route path="/branches" element={
              <ProtectedRoute roles={['SUPER_ADMIN']}>
                <BranchesPage />
              </ProtectedRoute>
            } />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />

        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;