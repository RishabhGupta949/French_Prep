
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { LearningPathPage } from './features/learning-path/LearningPathPage';
import { LessonPage } from './features/lesson/LessonPage';
import { LessonResultsPage } from './features/lesson/LessonResultsPage';
import { useAuthStore } from './features/auth/authStore';

function AuthenticatedRoute() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function OnboardingRoute() {
  const { isOnboarded } = useAuthStore();

  if (isOnboarded) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

function CompletedOnboardingRoute() {
  const { isOnboarded } = useAuthStore();

  if (!isOnboarded) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}

function PublicRoute() {
  const { isAuthenticated, isOnboarded } = useAuthStore();

  if (isAuthenticated) {
    return (
      <Navigate
        to={isOnboarded ? '/dashboard' : '/onboarding'}
        replace
      />
    );
  }

  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* All authenticated routes */}
      <Route element={<AuthenticatedRoute />}>
        <Route element={<Layout />}>

          {/* Users who haven't completed onboarding */}
          <Route element={<OnboardingRoute />}>
            <Route
              path="/onboarding"
              element={<OnboardingPage />}
            />
          </Route>

          {/* Users who have completed onboarding */}
          <Route element={<CompletedOnboardingRoute />}>
            <Route
              path="/dashboard"
              element={<DashboardPage />}
            />

            <Route
              path="/learning-path"
              element={<LearningPathPage />}
            />

            <Route
              path="/lesson/:lessonId"
              element={<LessonPage />}
            />

            <Route
              path="/lesson/:lessonId/results"
              element={<LessonResultsPage />}
            />

            

            <Route
              path="/"
              element={<Navigate to="/dashboard" replace />}
            />
          </Route>

        </Route>
      </Route>

      {/* Unknown routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
