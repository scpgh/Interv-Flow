import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, requireOnboarding = true, adminOnly = false }) {
  const isLoggedIn = sessionStorage.getItem('isAuthenticated') === 'true';

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly) {
    const role = sessionStorage.getItem('userRole');
    const adminRole = sessionStorage.getItem('adminRole');
    if (role !== 'ADMIN' && adminRole !== 'ADMIN') {
      return <Navigate to="/dashboard" replace />;
    }
  }

  if (requireOnboarding) {
    const isOnboarded = sessionStorage.getItem('onboardingCompleted') === 'true';
    if (!isOnboarded) {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return children;
}
