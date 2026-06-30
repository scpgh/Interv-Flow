import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DashboardNavbar from '../components/DashboardNavbar';
import { auth } from '../firebase';

export default function AdminUserInspect() {
  const { email } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [bonusXpInput, setBonusXpInput] = useState('');
  const [savingXp, setSavingXp] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const freshToken = await user.getIdToken(true);
          sessionStorage.setItem('idToken', freshToken);
        } catch (e) {
          console.error("Error refreshing token on AuthState change:", e);
        }
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Helper: Get fresh authorization headers
  const getAuthHeaders = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const freshToken = await currentUser.getIdToken(true);
        sessionStorage.setItem('idToken', freshToken);
        return { 'Authorization': `Bearer ${freshToken}`, 'Content-Type': 'application/json' };
      }
    } catch (e) {
      console.warn('Token refresh failed:', e.message);
    }
    const cached = sessionStorage.getItem('idToken') || '';
    return { 'Authorization': `Bearer ${cached}`, 'Content-Type': 'application/json' };
  };

  useEffect(() => {
    const fetchCandidateDetails = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(email)}`, {
          headers: await getAuthHeaders()
        });
        if (res.status === 401 || res.status === 403) {
          navigate('/dashboard');
          return;
        }
        const data = await res.json();
        if (data.success) {
          setUser(data.user);
        } else {
          setErrorMsg(data.error || 'Failed to load user details.');
        }
      } catch (err) {
        console.error(err);
        setErrorMsg('Network error loading candidate profile.');
      } finally {
        setLoading(false);
      }
    };

    if (email && authReady) {
      fetchCandidateDetails();
    }
  }, [email, navigate, authReady]);

  // Sync bonusXp input when user loads
  useEffect(() => {
    if (user) setBonusXpInput(String(user.bonusXp || 0));
  }, [user]);

  const handleSaveBonusXp = async () => {
    const val = parseInt(bonusXpInput, 10);
    if (isNaN(val) || val < 0) {
      setErrorMsg('XP must be a non-negative number.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    setSavingXp(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(user.email)}`, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ bonusXp: val })
      });
      const data = await res.json();
      if (data.success) {
        setUser(prev => ({ ...prev, bonusXp: val }));
        setSuccessMsg(`Bonus XP updated to ${val} XP.`);
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setErrorMsg(data.error || 'Failed to update XP.');
        setTimeout(() => setErrorMsg(''), 4000);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error saving XP.');
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setSavingXp(false);
    }
  };

  const handleToggleUserArchive = async () => {
    if (!user) return;
    const nextActiveState = !user.isActive;
    if (!window.confirm(`Are you sure you want to ${nextActiveState ? 'restore' : 'soft-delete (archive)'} this candidate?`)) return;
    
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(user.email)}`, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ isActive: nextActiveState })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Candidate status toggled to ${nextActiveState ? 'Active' : 'Archived'}.`);
        setUser(prev => ({ ...prev, isActive: nextActiveState }));
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setErrorMsg(data.error || 'Failed to toggle archive state.');
        setTimeout(() => setErrorMsg(''), 4000);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error archiving user.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleStartImpersonate = async () => {
    if (!user) return;
    if (!window.confirm(`Start troubleshooting? You will browse the platform as ${user.name} (${user.email}).`)) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/impersonate`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ email: user.email })
      });
      const data = await res.json();
      if (data.success) {
        // Store admin original details for restoration later
        sessionStorage.setItem('adminEmail', sessionStorage.getItem('userEmail') || 'admin@intervflow.com');
        sessionStorage.setItem('adminName', sessionStorage.getItem('userName') || 'Admin');
        sessionStorage.setItem('adminRole', sessionStorage.getItem('userRole') || 'ADMIN');

        // Set impersonated details
        sessionStorage.setItem('impersonatedUser', data.impersonatedUser.email);
        sessionStorage.setItem('userEmail', data.impersonatedUser.email);
        sessionStorage.setItem('userName', data.impersonatedUser.name);
        sessionStorage.setItem('userDomain', data.impersonatedUser.domain);
        sessionStorage.setItem('userRole', 'USER'); // set to user to check flows
        sessionStorage.setItem('onboardingCompleted', String(data.impersonatedUser.onboardingCompleted));

        // Redirect to user's dashboard view
        window.location.href = '/dashboard';
      } else {
        setErrorMsg(data.error || 'Failed to launch impersonation session.');
        setTimeout(() => setErrorMsg(''), 4000);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error initiating View As User.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  return (
    <div className="bg-[#09090b] text-[#e5e1e4] min-h-screen flex flex-col relative pt-16 font-body-md">
      {/* Background atmosphere glow */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-radial-gradient"></div>

      <DashboardNavbar activeTab="admin" />

      {/* Dynamic Flash Banners */}
      {errorMsg && (
        <div className="fixed top-24 right-6 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 text-sm z-50 animate-bounce">
          <span className="material-symbols-outlined text-lg">error</span>
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="fixed top-24 right-6 bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2 text-sm z-50 animate-pulse">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          <span>{successMsg}</span>
        </div>
      )}

      <main className="flex-grow max-w-[1000px] w-full mx-auto px-6 py-8 z-10 relative">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-on-surface-variant font-mono">Loading Candidate Record...</p>
          </div>
        ) : !user ? (
          <div className="glass-panel p-8 rounded-2xl border border-white/5 text-center flex flex-col items-center gap-4">
            <span className="material-symbols-outlined text-red-400 text-5xl">person_off</span>
            <h2 className="text-lg font-bold text-white">Candidate Not Found</h2>
            <p className="text-xs text-on-surface-variant max-w-sm leading-relaxed">The user record you are attempting to inspect does not exist or has been deleted.</p>
            <Link to="/admin?tab=users" className="btn-primary py-2 px-6 text-xs font-bold">
              Back to Dashboard
            </Link>
          </div>
        ) : (
          <div 
            style={{ backgroundColor: '#09090b', border: '1px solid rgba(255, 255, 255, 0.08)' }}
            className="p-6 md:p-8 rounded-2xl shadow-2xl relative min-h-[500px] text-left flex flex-col gap-6 animate-in fade-in duration-200"
          >
            {/* Header sub-navbar bar */}
            <div className="flex justify-between items-center border-b border-white/10 pb-4 flex-wrap gap-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-400">shield_person</span>
                Candidate Profile Inspector
              </h3>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleUserArchive}
                  className={`py-1.5 px-4 text-xs font-bold flex items-center gap-1.5 border rounded-full transition-all cursor-pointer ${
                    user.isActive !== false
                      ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                      : 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{user.isActive !== false ? 'archive' : 'unarchive'}</span>
                  {user.isActive !== false ? 'Archive Candidate' : 'Restore Candidate'}
                </button>
                <button
                  onClick={() => navigate('/admin?tab=users')}
                  className="btn-secondary py-1.5 px-4 text-xs font-bold flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  Back to Candidates
                </button>
              </div>
            </div>

            {/* Candidate Identity block */}
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
              <div className="h-16 w-16 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center font-bold text-[#b4c5ff] text-xl">
                {user.name ? user.name[0]?.toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-white text-md">{user.name}</h4>
                <p className="text-xs text-on-surface-variant font-mono truncate">{user.email}</p>
              </div>
            </div>

            {/* Profile fields list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div className="flex flex-col gap-1 bg-white/5 p-3 rounded-lg border border-white/5">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Access level role</span>
                <span className="text-xs text-white font-mono">{user.role || 'USER'}</span>
              </div>

              <div className="flex flex-col gap-1 bg-white/5 p-3 rounded-lg border border-white/5">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Domain Preference</span>
                <span className="text-xs text-white">{user.domain ? user.domain.toUpperCase() : 'SWE'}</span>
              </div>

              <div className="flex flex-col gap-1 bg-white/5 p-3 rounded-lg border border-white/5">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Experience Level</span>
                <span className="text-xs text-white">{user.experienceYears || '0 Yrs (Fresher / Student)'}</span>
              </div>

              <div className="flex flex-col gap-1 bg-white/5 p-3 rounded-lg border border-white/5">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Highest Education</span>
                <span className="text-xs text-white">{user.highestEducation || 'Not provided'}</span>
              </div>

              <div className="flex flex-col gap-1 bg-white/5 p-3 rounded-lg border border-white/5 col-span-1 sm:col-span-2">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Dream Company focus</span>
                <span className="text-xs text-white">{user.dreamCompany || 'Not provided'}</span>
              </div>

              <div className="flex flex-col gap-1 bg-white/5 p-3 rounded-lg border border-white/5">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">ATS Score</span>
                <span className="text-xs text-amber-400 font-bold font-mono">{user.atsScore ? `${user.atsScore}%` : 'Not evaluated'}</span>
              </div>

              <div className="flex flex-col gap-1 bg-white/5 p-3 rounded-lg border border-white/5">
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Role Match Score</span>
                <span className="text-xs text-purple-400 font-bold font-mono">{user.roleMatch ? `${user.roleMatch}%` : 'Not evaluated'}</span>
              </div>

            </div>

            {/* ── Bonus XP Editor ── */}
            <div className="bg-[#818cf8]/5 border border-[#818cf8]/20 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#818cf8] text-lg">military_tech</span>
                <span className="text-xs font-bold text-white uppercase tracking-wider">Bonus XP Override</span>
                <span className="ml-auto text-[10px] text-on-surface-variant font-mono bg-white/5 px-2 py-0.5 rounded-full">
                  Current: {user.bonusXp || 0} XP
                </span>
              </div>
              <p className="text-[10px] text-on-surface-variant leading-relaxed">
                Manually assign bonus XP to this user. This is added on top of their earned XP from sessions, posts, and challenge completions. The global multiplier does <em>not</em> apply to bonus XP.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={bonusXpInput}
                  onChange={(e) => setBonusXpInput(e.target.value)}
                  className="bg-[#131315]/80 border border-outline-variant rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#818cf8] w-36 font-mono"
                  placeholder="e.g. 500"
                />
                <button
                  onClick={handleSaveBonusXp}
                  disabled={savingXp}
                  className="btn-primary py-2.5 px-5 text-xs font-bold flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {savingXp ? (
                    <><div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />Saving...</>
                  ) : (
                    <><span className="material-symbols-outlined text-[15px]">save</span>Set XP</>
                  )}
                </button>
                <button
                  onClick={() => setBonusXpInput('0')}
                  className="py-2.5 px-4 text-xs font-bold text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 rounded-full transition-all"
                >
                  Reset
                </button>
              </div>
            </div>

            <hr className="border-white/10" />

            {/* Links */}
            <div className="flex flex-col gap-2 text-left">
              <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Social Portfolios</span>
              <div className="flex flex-col gap-1.5 font-mono text-xs">
                {user.linkedinUrl ? (
                  <a href={user.linkedinUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1.5 w-max">
                    <span className="material-symbols-outlined text-[16px]">link</span>LinkedIn Profile
                  </a>
                ) : <span className="text-on-surface-variant/40">LinkedIn not linked</span>}
                {user.githubUrl ? (
                  <a href={user.githubUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1.5 w-max">
                    <span className="material-symbols-outlined text-[16px]">link</span>GitHub Portfolio
                  </a>
                ) : <span className="text-on-surface-variant/40">GitHub not linked</span>}
              </div>
            </div>

            <div className="flex gap-3 mt-4 flex-wrap">
              <button
                onClick={handleStartImpersonate}
                className="btn-primary py-2.5 px-5 flex items-center justify-center gap-2 text-xs font-bold"
              >
                <span className="material-symbols-outlined text-md">visibility</span>
                View Dashboard As User
              </button>
              <button
                onClick={() => navigate('/admin?tab=users')}
                className="btn-secondary py-2.5 px-5 text-xs font-bold"
              >
                Close Profile View
              </button>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
