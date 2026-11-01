/**
 * Application root: providers and routing.
 *
 * Route protection here is defence in depth and good UX — it stops a user seeing
 * a flash of a screen they cannot use. It is NOT the security boundary: every
 * endpoint enforces role and ownership server-side, and that is what actually
 * protects the data.
 *
 * Each role has its own route tree. A user who lands on another role's tree is
 * redirected to their own home rather than shown an error, because arriving there
 * is almost always a stale bookmark rather than an attack.
 */
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import { AuthProvider, useAuth } from './hooks/useAuth';
import { ApiError } from './lib/api';
import DashboardLayout from './layouts/DashboardLayout';
import { Spinner } from './components/ui';
import type { Role } from './types/api';

import Landing from './pages/public/Landing';
import HowItWorks from './pages/public/HowItWorks';
import LoginChooser, { AdminLogin, BusinessLogin, InvestorLogin } from './pages/public/Login';
import Register from './pages/public/Register';
import NotFound from './pages/public/NotFound';

// Business owner
import Dashboard from './pages/startup/Dashboard';
import BusinessProfilePage from './pages/startup/BusinessProfile';
import FundingRequirementPage from './pages/startup/FundingRequirement';
import ReadinessPage from './pages/startup/Readiness';
import SchemesPage from './pages/startup/Schemes';
import SchemeDetailPage from './pages/startup/SchemeDetail';
import RecommendationsPage from './pages/startup/Recommendations';
import ActionPlanPage from './pages/startup/ActionPlan';
import SavedPage from './pages/startup/Saved';
import SettingsPage from './pages/startup/Settings';
import ProposalsPage from './pages/startup/Proposals';
import ProposalDetailPage from './pages/startup/ProposalDetail';
import AssistantPage from './pages/startup/Assistant';

// Investor
import InvestorDashboardPage from './pages/investor/Dashboard';
import InvestorPreferencesPage from './pages/investor/Preferences';
import DiscoverPage from './pages/investor/Discover';
import InvestorMatchesPage from './pages/investor/Matches';
import InvestorBusinessDetailPage from './pages/investor/BusinessDetail';
import ShortlistPage from './pages/investor/Shortlist';
import InvestorSettingsPage from './pages/investor/Settings';

// Admin
import AdminDashboardPage from './pages/admin/Dashboard';
import { AdminSchemeDetailPage, AdminSchemesPage } from './pages/admin/Schemes';
import {
  AdminAuditPage,
  AdminDataQualityPage,
  AdminMatchingConfigPage,
  AdminRagPage,
  AdminUsersPage,
} from './pages/admin/Operations';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Retrying an auth, validation or not-found error only delays the real
        // message. Only transient failures are worth a second attempt.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

const HOME: Record<Role, string> = { STARTUP: '/app', INVESTOR: '/investor', ADMIN: '/admin' };

function FullPageSpinner() {
  return (
    <div className="h-screen flex items-center justify-center">
      <Spinner label="Loading FundBridge…" />
    </div>
  );
}

/** Requires a session, and optionally a specific role. */
function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, initialising } = useAuth();
  const location = useLocation();

  // Waiting for the first /auth/me response. Redirecting here would bounce a
  // signed-in user to the login page on every refresh.
  if (initialising) return <FullPageSpinner />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Wrong role: send them to their own home rather than showing an error.
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={HOME[user.role]} replace />;
  }

  return <>{children}</>;
}

function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { user, initialising } = useAuth();
  if (initialising) return <FullPageSpinner />;
  if (user) return <Navigate to={HOME[user.role]} replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      {/* One portal per role, plus a chooser at /login. All three post to the
          same endpoint; the portal is presentation only, and the account's own
          role decides the destination. See pages/public/Login.tsx. */}
      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <LoginChooser />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/login/business"
        element={
          <RedirectIfAuthenticated>
            <BusinessLogin />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/login/investor"
        element={
          <RedirectIfAuthenticated>
            <InvestorLogin />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/login/admin"
        element={
          <RedirectIfAuthenticated>
            <AdminLogin />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuthenticated>
            <Register />
          </RedirectIfAuthenticated>
        }
      />

      {/* Business owner */}
      <Route
        path="/app"
        element={
          <RequireAuth roles={['STARTUP']}>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="profile" element={<BusinessProfilePage />} />
        <Route path="funding-requirement" element={<FundingRequirementPage />} />
        <Route path="readiness" element={<ReadinessPage />} />
        <Route path="schemes" element={<SchemesPage />} />
        <Route path="schemes/:id" element={<SchemeDetailPage />} />
        <Route path="recommendations" element={<RecommendationsPage />} />
        <Route path="proposals" element={<ProposalsPage />} />
        <Route path="proposals/:id" element={<ProposalDetailPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="action-plan" element={<ActionPlanPage />} />
        <Route path="saved" element={<SavedPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Investor */}
      <Route
        path="/investor"
        element={
          <RequireAuth roles={['INVESTOR']}>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<InvestorDashboardPage />} />
        <Route path="preferences" element={<InvestorPreferencesPage />} />
        <Route path="discover" element={<DiscoverPage />} />
        <Route path="matches" element={<InvestorMatchesPage />} />
        <Route path="businesses/:id" element={<InvestorBusinessDetailPage />} />
        <Route path="shortlist" element={<ShortlistPage />} />
        <Route path="settings" element={<InvestorSettingsPage />} />
      </Route>

      {/* Admin */}
      <Route
        path="/admin"
        element={
          <RequireAuth roles={['ADMIN']}>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="schemes" element={<AdminSchemesPage />} />
        <Route path="schemes/:id" element={<AdminSchemeDetailPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="data-quality" element={<AdminDataQualityPage />} />
        <Route path="rag" element={<AdminRagPage />} />
        <Route path="matching-config" element={<AdminMatchingConfigPage />} />
        <Route path="audit" element={<AdminAuditPage />} />
        {/* Administrators have no separate settings screen; the overview covers it. */}
        <Route path="settings" element={<Navigate to="/admin" replace />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
