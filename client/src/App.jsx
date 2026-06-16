import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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

export default function App() {
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
      </Routes>
    </Router>
  );
}

  