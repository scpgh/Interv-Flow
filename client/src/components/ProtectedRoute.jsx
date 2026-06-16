import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, requireOnboarding = true }) {
  const isLoggedIn = sessionStorage.getItem('isAuthenticated') === 'true';

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (requireOnboarding) {
    const isOnboarded = sessionStorage.getItem('onboardingCompleted') === 'true';
    if (!isOnboarded) {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return children;
}
