import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import ContactPage from './pages/ContactPage';
import Dashboard from './pages/Dashboard';
import ResumeAnalyzer from './pages/ResumeAnalyzer';
import Onboarding from './pages/Onboarding';
import PracticeSession from './pages/PracticeSession';
import PracticeFeedback from './pages/PracticeFeedback';
import ProtectedRoute from './components/ProtectedRoute';
import Community from './pages/Community';
import Billing from './pages/Billing';
import Analytics from './pages/Analytics';
import MaintenancePage from './pages/MaintenancePage';

// Lazy loaded Admin Dashboard
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminUserInspect = lazy(() => import('./pages/AdminUserInspect'));

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function App() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [statusChecked, setStatusChecked] = useState(false);

  useEffect(() => {
    // Poll maintenance status every 30 seconds
    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/status`);
        const data = await res.json();
        setMaintenanceMode(data.maintenance === true);
      } catch {
        // If server unreachable, don't block the app
        setMaintenanceMode(false);
      } finally {
        setStatusChecked(true);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Wait for the first status check before rendering
  if (!statusChecked) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#09090b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '36px', height: '36px',
          border: '2px solid rgba(255,255,255,0.1)',
          borderTopColor: '#818cf8',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Determine if the current user is an admin or moderator — they bypass maintenance
  const userRole = sessionStorage.getItem('userRole') || '';
  const adminRole = sessionStorage.getItem('adminRole') || '';
  const isPrivileged = userRole === 'ADMIN' || userRole === 'MODERATOR' || adminRole === 'ADMIN';

  // Show maintenance screen to regular (non-privileged) users
  if (maintenanceMode && !isPrivileged) {
    return <MaintenancePage />;
  }

  return (
    <Router>
      <Routes>
        {/* Root path loads the Landing Page */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Auth Routes */}
        <Route path="/login" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        
        {/* Contact */}
        <Route path="/contact" element={<ContactPage />} />

        {/* Authenticated Dashboard, Onboarding & Resume Analyser */}
        <Route path="/onboarding" element={
          <ProtectedRoute requireOnboarding={false}>
            <Onboarding />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/resume-analyzer" element={
          <ProtectedRoute>
            <ResumeAnalyzer />
          </ProtectedRoute>
        } />
        <Route path="/practice" element={
          <ProtectedRoute>
            <PracticeSession />
          </ProtectedRoute>
        } />
        <Route path="/practice/feedback/:sessionId" element={
          <ProtectedRoute>
            <PracticeFeedback />
          </ProtectedRoute>
        } />
        <Route path="/analytics" element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        } />
        <Route path="/community" element={
          <ProtectedRoute>
            <Community />
          </ProtectedRoute>
        } />
        <Route path="/billing" element={
          <ProtectedRoute>
            <Billing />
          </ProtectedRoute>
        } />

        {/* Protected Admin Portal */}
        <Route path="/admin" element={
          <ProtectedRoute adminOnly={true}>
            <Suspense fallback={
              <div className="min-h-screen bg-background text-on-background flex flex-col items-center justify-center gap-4 bg-radial-gradient">
                <div className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <div className="text-sm font-label-md text-on-surface-variant">Loading Admin Portal...</div>
              </div>
            }>
              <AdminDashboard />
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/admin/user/:email" element={
          <ProtectedRoute adminOnly={true}>
            <Suspense fallback={
              <div className="min-h-screen bg-background text-on-background flex flex-col items-center justify-center gap-4 bg-radial-gradient">
                <div className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <div className="text-sm font-label-md text-on-surface-variant">Loading User Profile...</div>
              </div>
            }>
              <AdminUserInspect />
            </Suspense>
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}