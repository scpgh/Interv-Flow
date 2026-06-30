import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import DashboardNavbar from '../components/DashboardNavbar';
import Footer from '../components/Footer';

export default function RecruiterApplication() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const auth = sessionStorage.getItem('isAuthenticated') === 'true';
    setIsLoggedIn(auth);
    if (auth) {
      setEmail(sessionStorage.getItem('userEmail') || '');
      setName(sessionStorage.getItem('userName') || '');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
      navigate('/login', { state: { from: '/apply-recruiter' } });
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/user/recruiter/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, name, company, reason }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit recruiter application.');
      }

      setSuccess(true);
      if (window.addIntervflowNotification) {
        window.addIntervflowNotification(
          'Onboarding Request Submitted',
          'Your recruiter verification request has been successfully queued for Administrator review.',
          'info',
          'text-[#818cf8]'
        );
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col font-body-md">
      {isLoggedIn ? <DashboardNavbar activeTab="" /> : <Navbar />}

      <main className="flex-1 flex items-center justify-center px-4 py-28 bg-radial-gradient">
        <div className="w-full max-w-xl p-8 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/20 rounded-full blur-3xl pointer-events-none" />

          {success ? (
            <div className="text-center py-12 flex flex-col items-center gap-4">
              <span className="material-symbols-outlined text-6xl text-emerald-400 animate-pulse">verified</span>
              <h2 className="text-2xl font-bold">Application Received!</h2>
              <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">
                Thank you for applying to become an IntervFlow Recruiter. Your application has been logged for review. An administrator will review your account soon.
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                className="mt-6 px-6 py-3 bg-[#1e1b4b] hover:bg-[#1e1b4b]/80 border border-[#818cf8]/30 rounded-xl font-bold text-xs text-white hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-black/40 cursor-pointer"
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6 text-left">
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                  Apply for Recruiter Access
                </h1>
                <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                  Post customized mock interviews, list job descriptions, and inspect candidate performance pipelines.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-xs text-red-400">
                  {errorMsg}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Full Name</label>
                <input
                  type="text"
                  required
                  disabled={isLoggedIn}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-primary transition-all disabled:opacity-50"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Work Email Address</label>
                <input
                  type="email"
                  required
                  disabled={isLoggedIn}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-primary transition-all disabled:opacity-50"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Company Name</label>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Stripe, Google, etc."
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-primary transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Why do you want recruiter access?</label>
                <textarea
                  required
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Tell us about the roles you want to recruit and evaluate..."
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-primary transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#1e1b4b] hover:bg-[#1e1b4b]/80 border border-[#818cf8]/30 rounded-xl font-bold text-xs text-white hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-black/40"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isLoggedIn ? (
                  'Submit Recruiter Application'
                ) : (
                  'Log In to Apply'
                )}
              </button>
            </form>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
