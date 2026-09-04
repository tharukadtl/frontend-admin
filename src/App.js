import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationSocketProvider } from './context/NotificationSocketContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import LoginPage         from './pages/Login/LoginPage';
import DashboardPage     from './pages/Dashboard/DashboardPage';
import FaultsPage        from './pages/Faults/FaultsPage';
import JobsPage          from './pages/Jobs/JobsPage';
import UsersPage         from './pages/Users/UsersPage';
import OpmcsPage         from './pages/Opmcs/OpmcsPage';
import WorkGroupsPage    from './pages/WorkGroups/WorkGroupsPage';
import InventoryPage     from './pages/Inventory/InventoryPage';
import VehiclesPage      from './pages/Vehicles/VehiclesPage';
import PaymentsPage      from './pages/Payments/PaymentsPage';
import KpiPage           from './pages/KPI/KpiPage';
import NotificationsPage from './pages/Notifications/NotificationsPage';
import AIDashboardPage      from './pages/AI/AIDashboardPage';
import ModelTrainingPage    from './pages/AI/ModelTrainingPage';
import ResourcePlanningPage from './pages/AI/ResourcePlanningPage';
import ReportsPage       from './pages/Reports/ReportsPage';
import ResourceAllocationPage from './pages/ResourceAllocation/ResourceAllocationPage';

function App() {
  return (
    <AuthProvider>
      <NotificationSocketProvider>
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
            <Route path="/reports" element={
              <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
                <ReportsPage />
              </ProtectedRoute>
            } />
            <Route path="/ai-dashboard" element={
              <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
                <AIDashboardPage />
              </ProtectedRoute>
            } />
            <Route path="/model-training" element={
              <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
                <ModelTrainingPage />
              </ProtectedRoute>
            } />
            <Route path="/resource-planning" element={
              <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
                <ResourcePlanningPage />
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
            {/* SRS 5.5.3 — OPMC pool -> Work Group allocation (Admin + Super Admin only) */}
            <Route path="/resource-allocation" element={
              <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
                <ResourceAllocationPage />
              </ProtectedRoute>
            } />
            {/* Critical #2 — SRS 5.5.6 Work Group creation/edit/reassignment of Team Lead */}
            <Route path="/work-groups" element={
              <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
                <WorkGroupsPage />
              </ProtectedRoute>
            } />

            {/* Super Admin only */}
            <Route path="/opmcs" element={
              <ProtectedRoute roles={['SUPER_ADMIN']}>
                <OpmcsPage />
              </ProtectedRoute>
            } />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />

        </Routes>
      </Router>
      </NotificationSocketProvider>
    </AuthProvider>
  );
}

export default App;