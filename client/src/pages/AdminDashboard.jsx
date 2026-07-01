import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DashboardNavbar from '../components/DashboardNavbar';
import { auth } from '../firebase';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'overview';
  });
  
  // API state and loading
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Tab 1: Overview state
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsersCount: 0,
    archivedUsersCount: 0,
    totalSessions: 0,
    totalPosts: 0,
    avgAtsScore: 65,
    systemHealth: 'Healthy',
    apiMetrics: { uptime: 0, nodeVersion: '' }
  });
  const [recentActivity, setRecentActivity] = useState([]);
  
  // Tab 2: Users list & management state
  const [users, setUsers] = useState([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersSortBy, setUsersSortBy] = useState('createdAt');
  const [usersSortOrder, setUsersSortOrder] = useState('desc');
  const [editingUser, setEditingUser] = useState(null); // hold user object for edit modal
  const [createAccount, setCreateAccount] = useState(null); // null = closed, {} = open
  
  // Tab 3: Completed Mock Sessions state
  const [sessions, setSessions] = useState([]);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [sessionsTotalPages, setSessionsTotalPages] = useState(1);
  const [sessionsSearch, setSessionsSearch] = useState('');
  const [selectedSession, setSelectedSession] = useState(null); // hold session object for transcript modal
  
  // Tab 4: Forum Moderation state
  const [posts, setPosts] = useState([]);
  const [postsPage, setPostsPage] = useState(1);
  const [postsTotalPages, setPostsTotalPages] = useState(1);
  const [postsSearch, setPostsSearch] = useState('');
  
  // Tab 5: System settings state
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    globalXpMultiplier: 1.0,
    defaultAiModel: 'gpt-4o'
  });
  
  // Tab 6: Audit logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogsPage, setAuditLogsPage] = useState(1);
  const [auditLogsTotalPages, setAuditLogsTotalPages] = useState(1);
  const [auditLogsSearch, setAuditLogsSearch] = useState('');

  // Tab Recruiter Upgrade Requests state
  const [recruiterRequests, setRecruiterRequests] = useState([]);

  // Tab 1: System Activity Feed pagination state
  const [activityPage, setActivityPage] = useState(1);

  // Selected User details sidebar state
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  // Ref to always have the latest Firebase user available, even across async boundaries
  const authUserRef = useRef(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      authUserRef.current = firebaseUser;
      if (firebaseUser) {
        try {
          // Force-refresh once on auth state change to ensure fresh token in sessionStorage
          const freshToken = await firebaseUser.getIdToken(true);
          sessionStorage.setItem('idToken', freshToken);
        } catch (e) {
          console.error("Error refreshing token on AuthState change:", e);
        }
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Helper: Get authorization headers — uses Firebase SDK's auto-refresh (no double force-refresh)
  const getAuthHeaders = async () => {
    try {
      const user = authUserRef.current;
      if (user) {
        // getIdToken() (no 'true') uses cached token and only refreshes when actually expired
        const token = await user.getIdToken();
        return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
      }
    } catch (e) {
      console.warn("Token get failed, using sessionStorage fallback:", e.message);
    }
    const cached = sessionStorage.getItem('idToken') || '';
    return { 'Authorization': `Bearer ${cached}`, 'Content-Type': 'application/json' };
  };

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Flash messages helper
  const triggerMessage = (type, text) => {
    if (type === 'error') {
      setErrorMsg(text);
      setTimeout(() => setErrorMsg(''), 4000);
    } else {
      setSuccessMsg(text);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  // ── API Fetchers ───────────────────────────────────────────────────
  const fetchOverviewStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/stats`, { headers: await getAuthHeaders() });
      if (res.status === 401 || res.status === 403) {
        navigate('/dashboard');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setRecentActivity(data.recentActivity || []);
      } else {
        triggerMessage('error', data.error || 'Failed to fetch statistics.');
      }
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Network error loading overview analytics.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersList = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: usersPage,
        limit: 10,
        search: usersSearch,
        sortBy: usersSortBy,
        sortOrder: usersSortOrder
      });
      const res = await fetch(`${API_URL}/api/admin/users?${query.toString()}`, { headers: await getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
        setUsersTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Failed to load user accounts.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionsList = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: sessionsPage,
        limit: 10,
        search: sessionsSearch
      });
      const res = await fetch(`${API_URL}/api/admin/sessions?${query.toString()}`, { headers: await getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions);
        setSessionsTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Failed to load mock sessions list.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPostsList = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: postsPage,
        limit: 10,
        search: postsSearch
      });
      const res = await fetch(`${API_URL}/api/admin/posts?${query.toString()}`, { headers: await getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setPosts(data.posts);
        setPostsTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Failed to load community forum posts.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/settings`, { headers: await getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Failed to load system configurations.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: auditLogsPage,
        limit: 15,
        search: auditLogsSearch
      });
      const res = await fetch(`${API_URL}/api/admin/audit-logs?${query.toString()}`, { headers: await getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setAuditLogs(data.logs);
        setAuditLogsTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Failed to load audit records.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecruiterRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/recruiter/requests`, { headers: await getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setRecruiterRequests(data.requests || []);
      }
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Failed to load recruiter requests.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRecruiter = async (email, status) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/recruiter/approve`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ email, status })
      });
      const data = await res.json();
      if (data.success) {
        triggerMessage('success', `Recruiter upgrade request ${status} successfully.`);
        fetchRecruiterRequests();
      } else {
        triggerMessage('error', data.error || 'Failed to process recruiter request.');
      }
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Network error processing recruiter request.');
    }
  };

  // Effect to sync current active tab details
  useEffect(() => {
    if (!authReady) return;
    if (activeTab === 'overview') fetchOverviewStats();
    if (activeTab === 'users') fetchUsersList();
    if (activeTab === 'sessions') fetchSessionsList();
    if (activeTab === 'moderation') fetchPostsList();
    if (activeTab === 'settings') fetchSystemSettings();
    if (activeTab === 'audits') fetchAuditLogs();
    if (activeTab === 'recruiters') fetchRecruiterRequests();
  }, [activeTab, usersPage, usersSortBy, usersSortOrder, sessionsPage, postsPage, auditLogsPage, authReady]);

  // Effect for triggering delayed searches
  useEffect(() => {
    if (!authReady) return;
    const delayDebounce = setTimeout(() => {
      if (activeTab === 'users') { setUsersPage(1); fetchUsersList(); }
      if (activeTab === 'sessions') { setSessionsPage(1); fetchSessionsList(); }
      if (activeTab === 'moderation') { setPostsPage(1); fetchPostsList(); }
      if (activeTab === 'audits') { setAuditLogsPage(1); fetchAuditLogs(); }
    }, 450);
    return () => clearTimeout(delayDebounce);
  }, [usersSearch, sessionsSearch, postsSearch, auditLogsSearch, authReady]);

  // ── Mutations ──────────────────────────────────────────────────────
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(editingUser.email)}`, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify(editingUser)
      });
      const data = await res.json();
      if (data.success) {
        triggerMessage('success', `Candidate ${editingUser.email} profile updated successfully.`);
        setEditingUser(null);
        fetchUsersList();
      } else {
        triggerMessage('error', data.error || 'Failed to update candidate profile.');
      }
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Network error saving candidate update.');
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!createAccount) return;
    const { name, email, password, domain, role, experienceYears, highestEducation, dreamCompany } = createAccount;
    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      setCreateAccount(prev => ({ ...prev, _error: 'Name, email, and password are required.' }));
      return;
    }
    if (password.length < 6) {
      setCreateAccount(prev => ({ ...prev, _error: 'Password must be at least 6 characters.' }));
      return;
    }
    setCreateAccount(prev => ({ ...prev, _saving: true, _error: '' }));
    try {
      const res = await fetch(`${API_URL}/api/admin/users`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ name, email, password, domain, role, experienceYears, highestEducation, dreamCompany })
      });
      const data = await res.json();
      if (data.success) {
        triggerMessage('success', `Account for ${email} created successfully.`);
        setCreateAccount(null);
        fetchUsersList();
      } else {
        setCreateAccount(prev => ({ ...prev, _saving: false, _error: data.error || 'Failed to create account.' }));
      }
    } catch (err) {
      console.error(err);
      setCreateAccount(prev => ({ ...prev, _saving: false, _error: 'Network error creating account.' }));
    }
  };

  const handleToggleUserArchive = async (userRecord) => {
    try {
      const nextActiveState = !userRecord.isActive;
      const res = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(userRecord.email)}`, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ isActive: nextActiveState })
      });
      const data = await res.json();
      if (data.success) {
        triggerMessage('success', `User status toggled to ${nextActiveState ? 'Active' : 'Archived'}.`);
        fetchUsersList();
      } else {
        triggerMessage('error', data.error || 'Failed to toggle archive state.');
      }
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Network error archiving user.');
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm("Are you sure you want to delete this interview record? This action is logged.")) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: await getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        triggerMessage('success', 'Mock interview log deleted.');
        fetchSessionsList();
      } else {
        triggerMessage('error', data.error || 'Failed to delete session.');
      }
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Network error deleting session.');
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("Are you sure you want to remove this topic from the forum? This action is logged.")) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/posts/${postId}`, {
        method: 'DELETE',
        headers: await getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        triggerMessage('success', 'Forum post removed and moderated.');
        fetchPostsList();
      } else {
        triggerMessage('error', data.error || 'Failed to moderate post.');
      }
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Network error removing post.');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/admin/settings`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(settings)
      });
      if (res.status === 401) {
        triggerMessage('error', 'Session expired. Please sign in again.');
        setTimeout(() => navigate('/signin'), 1500);
        return;
      }
      const data = await res.json();
      if (data.success) {
        triggerMessage('success', 'System configurations saved successfully.');
        setSettings(data.settings);
      } else {
        triggerMessage('error', data.error || 'Failed to save settings.');
      }
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Network error updating settings.');
    }
  };

  const handleStartImpersonate = async (userRecord) => {
    if (!window.confirm(`Start troubleshooting? You will browse the platform as ${userRecord.name} (${userRecord.email}).`)) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/impersonate`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ email: userRecord.email })
      });
      const data = await res.json();
      if (data.success) {
        // Store admin original details for restoration later
        sessionStorage.setItem('adminEmail', sessionStorage.getItem('userEmail') || '');
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
        triggerMessage('error', data.error || 'Failed to launch impersonation session.');
      }
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Network error initiating View As User.');
    }
  };

  return (
    <div className="bg-[#09090b] text-[#e5e1e4] min-h-screen flex flex-col relative pt-16 font-body-md">
      {/* Guarantee responsive sidebar layout width on desktop */}
      <style>{`
        @media (min-width: 768px) {
          .admin-sidebar {
            width: 256px !important;
            min-width: 256px !important;
            max-width: 256px !important;
            flex-shrink: 0 !important;
          }
        }
      `}</style>

      {/* Background radial atmosphere glow */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-radial-gradient"></div>

      {/* Reusable Dashboard Header Navbar */}
      <DashboardNavbar activeTab="admin" />
      
      {/* Dynamic Flash Banner */}
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

      <div className="flex flex-1 pt-6 max-w-[1400px] mx-auto w-full px-6 z-10 relative flex-col md:flex-row gap-6">
        
        {/* ── Left Sidebar Nav ── */}
        <aside className="w-full admin-sidebar flex flex-col gap-4">
          <div className="glass-panel p-5 rounded-2xl flex flex-col gap-5 border border-white/5 shadow-xl">
            
            {/* Branding Header */}
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-amber-400 text-3xl font-bold bg-amber-400/10 p-2 rounded-xl border border-amber-400/20">admin_panel_settings</span>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide uppercase">Admin Portal</h2>
                <p className="text-[10px] text-on-surface-variant">Control Panel</p>
              </div>
            </div>

            <hr className="border-white/10" />

            {/* Menu Buttons */}
            <nav className="flex flex-col gap-1">
              {[
                { key: 'overview', label: 'System Overview', icon: 'monitoring' },
                { key: 'users', label: 'Candidate Accounts', icon: 'group' },
                { key: 'recruiters', label: 'Recruiter Requests', icon: 'verified' },
                { key: 'sessions', label: 'Completed Sessions', icon: 'record_voice_over' },
                { key: 'moderation', label: 'Forum Moderation', icon: 'forum' },
                { key: 'settings', label: 'Global Configurations', icon: 'settings' },
                { key: 'audits', label: 'Audit Logging', icon: 'history' }
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => {
                    setActiveTab(item.key);
                    navigate(`/admin?tab=${item.key}`, { replace: true });
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left text-xs font-semibold transition-all border-none bg-transparent cursor-pointer ${
                    activeTab === item.key
                      ? 'bg-amber-400/10 text-amber-300 border border-amber-400/20 shadow-md shadow-amber-400/5'
                      : 'text-on-surface-variant hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>

            <hr className="border-white/10" />

            {/* Exit Link */}
            <Link
              to="/dashboard"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs text-on-surface-variant hover:text-white transition-all hover:bg-white/5"
            >
              <span className="material-symbols-outlined text-[18px]">keyboard_backspace</span>
              Exit Dashboard
            </Link>
          </div>
        </aside>

        {/* ── Right Content Panels ── */}
        <main className="flex-grow min-w-0">
          <div className="glass-panel p-6 md:p-8 rounded-2xl border border-white/5 shadow-2xl relative min-h-[500px]">
              
              {/* Loading Indicator */}
              {loading && (
                <div className="absolute top-4 right-4 flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-[10px] text-on-surface-variant">
                  <div className="h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  Syncing...
                </div>
              )}

            {/* TAB 1: SYSTEM OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="flex flex-col gap-6">
                
                {/* Heading */}
                <div>
                  <h1 className="text-xl font-bold text-white">System Overview</h1>
                  <p className="text-xs text-on-surface-variant">Aggregated telemetry metrics and candidate engagement KPI cards.</p>
                </div>

                {/* KPI Card grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { title: 'Total Candidates', value: stats.totalUsers, desc: `${stats.activeUsersCount} Active / ${stats.archivedUsersCount} Archived`, icon: 'person', color: 'text-blue-400', bg: 'bg-blue-400/10' },
                    { title: 'Interviews Completed', value: stats.totalSessions, desc: 'Voice mock sessions run', icon: 'mic', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                    { title: 'Forum Discussions', value: stats.totalPosts, desc: 'Moderatable community topics', icon: 'chat', color: 'text-purple-400', bg: 'bg-purple-400/10' },
                    { title: 'Average ATS Score', value: `${stats.avgAtsScore}%`, desc: 'ATS parser evaluation baseline', icon: 'analytics', color: 'text-amber-400', bg: 'bg-amber-400/10' }
                  ].map((card, idx) => (
                    <div key={idx} className="glass-card p-4 rounded-xl border border-white/5 flex flex-col gap-3 transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-on-surface-variant">{card.title}</span>
                        <span className={`material-symbols-outlined ${card.color} ${card.bg} p-1.5 rounded-lg text-lg`}>{card.icon}</span>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white font-mono">{card.value}</div>
                        <div className="text-[10px] text-on-surface-variant font-mono mt-0.5">{card.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Second Metrics row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* System health glass card */}
                  <div className="glass-panel p-5 rounded-xl border border-white/5 flex flex-col gap-4 col-span-1">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Health &amp; Server Metrics</h3>
                    <div className="flex flex-col gap-3 font-mono text-xs">
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-on-surface-variant">System Status:</span>
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                          {stats.systemHealth}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-on-surface-variant">Server Uptime:</span>
                        <span className="text-white">{Math.floor(stats.apiMetrics.uptime / 3600)}h {Math.floor((stats.apiMetrics.uptime % 3600) / 60)}m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Environment Node:</span>
                        <span className="text-white">{stats.apiMetrics.nodeVersion || 'v20.10.0'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Activity log summary list */}
                  <div className="glass-panel p-5 rounded-xl border border-white/5 flex flex-col gap-4 lg:col-span-2">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">System Activity Feed</h3>
                    <div className="flex flex-col gap-2.5 pr-1 min-h-[360px]">
                      {(() => {
                        const totalActPages = Math.max(1, Math.ceil(recentActivity.length / 10));
                        const curActPage = Math.min(activityPage, totalActPages);
                        const dispActivities = recentActivity.slice((curActPage - 1) * 10, curActPage * 10);

                        return dispActivities.length > 0 ? dispActivities.map((activity, idx) => (
                          <div key={idx} className="flex items-start justify-between gap-3 text-xs py-2 border-b border-white/5">
                            <div className="flex items-start gap-2.5">
                              <span className={`material-symbols-outlined text-sm mt-0.5 ${
                                activity.type === 'user_signup' ? 'text-blue-400' :
                                activity.type === 'interview_complete' ? 'text-emerald-400' :
                                activity.type === 'post_create' ? 'text-purple-400' : 'text-amber-400'
                              }`}>
                                {activity.type === 'user_signup' ? 'person_add' :
                                 activity.type === 'interview_complete' ? 'mic' :
                                 activity.type === 'post_create' ? 'post_add' : 'security'}
                              </span>
                              <span className="text-on-surface-variant">{activity.message}</span>
                            </div>
                            <span className="font-mono text-[9px] text-on-surface-variant/60 flex-shrink-0 mt-0.5">
                              {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )) : (
                          <div className="text-center py-12 text-xs text-on-surface-variant font-mono">No recent operations logged.</div>
                        );
                      })()}
                    </div>

                    {/* Pagination for Activity Feed */}
                    {Math.ceil(recentActivity.length / 10) > 1 && (
                      <div className="flex justify-between items-center text-xs mt-auto pt-3 border-t border-white/5">
                        <span className="text-on-surface-variant font-mono">Page {Math.min(activityPage, Math.max(1, Math.ceil(recentActivity.length / 10)))} of {Math.max(1, Math.ceil(recentActivity.length / 10))}</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                            disabled={activityPage === 1}
                            className="bg-white/5 hover:bg-white/10 text-white font-semibold py-1 px-2.5 rounded-lg border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-[10px]"
                          >
                            Prev
                          </button>
                          <button
                            type="button"
                            onClick={() => setActivityPage(p => Math.min(Math.ceil(recentActivity.length / 10), p + 1))}
                            disabled={activityPage >= Math.ceil(recentActivity.length / 10)}
                            className="bg-white/5 hover:bg-white/10 text-white font-semibold py-1 px-2.5 rounded-lg border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-[10px]"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: CANDIDATE ACCOUNTS */}
            {activeTab === 'users' && (
              <div className="flex flex-col gap-6">
                
                {/* Heading & Search actions */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-white">Candidate Accounts</h1>
                    <p className="text-xs text-on-surface-variant">Search profiles, sync Firebase tokens, soft-delete records or view dashboard as candidate.</p>
                  </div>
                  
                  {/* Search input */}
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/70 text-sm pointer-events-none">search</span>
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={usersSearch}
                      onChange={(e) => setUsersSearch(e.target.value)}
                      style={{ paddingLeft: '38px' }}
                      className="bg-white/5 border border-white/10 rounded-xl py-2.5 pr-4 text-xs text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20 transition-all w-72"
                    />
                  </div>

                  {/* Create Account Button */}
                  <button
                    onClick={() => setCreateAccount({ name: '', email: '', password: '', domain: 'swe', role: 'USER', experienceYears: '', highestEducation: '', dreamCompany: '', _saving: false, _error: '' })}
                    className="flex items-center gap-2 bg-[#818cf8]/10 border border-[#818cf8]/30 hover:bg-[#818cf8]/20 text-[#818cf8] px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">person_add</span>
                    Create Account
                  </button>
                </div>

                {/* Users Table */}
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.01]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 font-bold text-white">
                        <th className="py-3 px-4">Candidate</th>
                        <th className="py-3 px-4">Role &amp; Domain</th>
                        <th className="py-3 px-4 font-mono">Experience &amp; Edu</th>
                        <th className="py-3 px-4">ATS / Match</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length > 0 ? users.map((user, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          
                          {/* Name / Email */}
                          <td className="py-3.5 px-4">
                            <div>
                              <div className="font-semibold text-white">{user.name}</div>
                              <div className="text-[10px] text-on-surface-variant font-mono">{user.email}</div>
                            </div>
                          </td>

                          {/* Role / Domain */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                user.role === 'ADMIN' ? 'bg-amber-400/10 text-amber-300 border border-amber-400/20' :
                                user.role === 'MODERATOR' ? 'bg-purple-400/10 text-purple-300 border border-purple-400/20' :
                                'bg-blue-400/10 text-blue-300 border border-blue-400/20'
                              }`}>
                                {user.role || 'USER'}
                              </span>
                              <span className="text-[10px] text-on-surface-variant">{user.domain ? user.domain.toUpperCase() : 'SWE'}</span>
                            </div>
                          </td>

                          {/* Exp & Education */}
                          <td className="py-3.5 px-4 font-mono text-[10px] text-on-surface-variant">
                            <div>{user.experienceYears || '0 Yrs'} exp</div>
                            <div className="truncate max-w-[120px]">{user.highestEducation || 'N/A'}</div>
                          </td>

                          {/* ATS Scores */}
                          <td className="py-3.5 px-4">
                            {user.atsScore ? (
                              <div className="flex items-center gap-1.5 font-mono text-[11px] text-white">
                                <span>🎯 {user.atsScore}%</span>
                                <span className="text-on-surface-variant/40">/</span>
                                <span>🤖 {user.roleMatch || 0}%</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-on-surface-variant italic">No evaluation</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${
                              user.isActive !== false
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {user.isActive !== false ? 'Active' : 'Archived'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => navigate(`/admin/user/${encodeURIComponent(user.email)}`)}
                                className="bg-transparent border-none text-on-surface-variant hover:text-white p-1 cursor-pointer flex items-center"
                                title="Inspect Profile"
                              >
                                <span className="material-symbols-outlined text-[16px]">info</span>
                              </button>
                              <button
                                onClick={() => setEditingUser({ ...user })}
                                className="bg-transparent border-none text-on-surface-variant hover:text-white p-1 cursor-pointer flex items-center"
                                title="Edit Candidate"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                              </button>
                              <button
                                onClick={() => handleToggleUserArchive(user)}
                                className={`bg-transparent border-none p-1 cursor-pointer flex items-center ${user.isActive !== false ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}`}
                                title={user.isActive !== false ? 'Soft-Delete (Archive)' : 'Restore User'}
                              >
                                <span className="material-symbols-outlined text-[16px]">{user.isActive !== false ? 'archive' : 'unarchive'}</span>
                              </button>
                              <button
                                onClick={() => handleStartImpersonate(user)}
                                className="bg-transparent border-none text-amber-400 hover:text-amber-300 p-1 cursor-pointer flex items-center"
                                title="View As User (Troubleshoot)"
                              >
                                <span className="material-symbols-outlined text-[16px]">visibility</span>
                              </button>
                            </div>
                          </td>

                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="6" className="text-center py-8 text-on-surface-variant font-mono">No candidate records found matching search query.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination footer */}
                {usersTotalPages > 1 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-on-surface-variant font-mono">Page {usersPage} of {usersTotalPages}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                        disabled={usersPage === 1}
                        className="bg-white/5 hover:bg-white/10 text-white font-semibold py-1.5 px-3 rounded-lg border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setUsersPage(p => Math.min(usersTotalPages, p + 1))}
                        disabled={usersPage === usersTotalPages}
                        className="bg-white/5 hover:bg-white/10 text-white font-semibold py-1.5 px-3 rounded-lg border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* TAB 3: COMPLETED MOCK SESSIONS */}
            {activeTab === 'sessions' && (
              <div className="flex flex-col gap-6">
                
                {/* Heading & Search actions */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-white">Completed Mock Sessions</h1>
                    <p className="text-xs text-on-surface-variant">View interview dialog logs, audio transcript audits, performance evaluations, and remove logs.</p>
                  </div>
                  
                  {/* Search input */}
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/70 text-sm pointer-events-none">search</span>
                    <input
                      type="text"
                      placeholder="Search email, job title, company..."
                      value={sessionsSearch}
                      onChange={(e) => setSessionsSearch(e.target.value)}
                      style={{ paddingLeft: '38px' }}
                      className="bg-white/5 border border-white/10 rounded-xl py-2.5 pr-4 text-xs text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20 transition-all w-72"
                    />
                  </div>
                </div>

                {/* Sessions Table */}
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.01]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 font-bold text-white">
                        <th className="py-3 px-4">Candidate Email</th>
                        <th className="py-3 px-4">Target Job Details</th>
                        <th className="py-3 px-4">Duration &amp; Date</th>
                        <th className="py-3 px-4">Evaluated Score</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.length > 0 ? sessions.map((s, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-4 font-mono">{s.userEmail || 'google.user@example.com'}</td>
                          <td className="py-3.5 px-4">
                            <div>
                              <div className="font-semibold text-white">{s.title}</div>
                              <div className="text-[10px] text-on-surface-variant">{s.company} ({s.mode ? s.mode.toUpperCase() : 'JD'} Mode)</div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[10px] text-on-surface-variant">
                            <div>🕒 {s.durationMinutes || 15} min</div>
                            <div>{s.completedAt ? new Date(s.completedAt).toLocaleDateString() : new Date(s.startTime).toLocaleDateString()}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            {s.report?.score ? (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                s.report.score >= 80 ? 'bg-green-500/10 text-green-400' :
                                s.report.score >= 60 ? 'bg-amber-500/10 text-amber-400' :
                                'bg-red-500/10 text-red-400'
                              }`}>
                                {s.report.score}% score
                              </span>
                            ) : (
                              <span className="text-[10px] text-on-surface-variant italic">Not analyzed</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedSession(s)}
                                className="bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 font-semibold py-1 px-2.5 rounded-lg border border-amber-400/20 text-[10px] cursor-pointer flex items-center gap-1 transition-all"
                              >
                                <span className="material-symbols-outlined text-[12px]">chat</span>
                                View Dialog
                              </button>
                              <button
                                onClick={() => handleDeleteSession(s.id)}
                                className="bg-transparent border-none text-red-400 hover:text-red-300 p-1 cursor-pointer flex items-center"
                                title="Delete Log"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="5" className="text-center py-8 text-on-surface-variant font-mono">No mock interview sessions recorded.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {sessionsTotalPages > 1 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-on-surface-variant font-mono">Page {sessionsPage} of {sessionsTotalPages}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSessionsPage(p => Math.max(1, p - 1))}
                        disabled={sessionsPage === 1}
                        className="bg-white/5 hover:bg-white/10 text-white font-semibold py-1.5 px-3 rounded-lg border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setSessionsPage(p => Math.min(sessionsTotalPages, p + 1))}
                        disabled={sessionsPage === sessionsTotalPages}
                        className="bg-white/5 hover:bg-white/10 text-white font-semibold py-1.5 px-3 rounded-lg border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* TAB 4: FORUM MODERATION */}
            {activeTab === 'moderation' && (
              <div className="flex flex-col gap-6">
                
                {/* Heading & Search actions */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-white">Community Forum Moderation</h1>
                    <p className="text-xs text-on-surface-variant">Audit posted community topics, check descriptions for guideline compliance, and moderate contents.</p>
                  </div>
                  
                  {/* Search input */}
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/70 text-sm pointer-events-none">search</span>
                    <input
                      type="text"
                      placeholder="Search author, titles, description..."
                      value={postsSearch}
                      onChange={(e) => setPostsSearch(e.target.value)}
                      style={{ paddingLeft: '38px' }}
                      className="bg-white/5 border border-white/10 rounded-xl py-2.5 pr-4 text-xs text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20 transition-all w-72"
                    />
                  </div>
                </div>

                {/* Posts Table */}
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.01]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 font-bold text-white">
                        <th className="py-3 px-4">Author</th>
                        <th className="py-3 px-4">Topic Title &amp; Description</th>
                        <th className="py-3 px-4">Stats &amp; Date</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {posts.length > 0 ? posts.map((p, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-white">{p.author}</td>
                          <td className="py-3.5 px-4">
                            <div className="max-w-[400px]">
                              <div className="font-bold text-white text-sm">{p.title}</div>
                              <p className="text-[11px] text-on-surface-variant leading-relaxed mt-1 line-clamp-2">{p.description}</p>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[10px] text-on-surface-variant">
                            <div>👍 {p.upvotes || 0} upvotes</div>
                            <div>💬 {p.comments?.length || 0} comments</div>
                            <div className="mt-1 text-[9px] text-on-surface-variant/60">{new Date(p.createdAt).toLocaleDateString()}</div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleDeletePost(p.id)}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold py-1.5 px-3 rounded-lg border border-red-500/20 text-[10px] cursor-pointer transition-all"
                            >
                              Remove Topic
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="4" className="text-center py-8 text-on-surface-variant font-mono">No community topics found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {postsTotalPages > 1 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-on-surface-variant font-mono">Page {postsPage} of {postsTotalPages}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPostsPage(p => Math.max(1, p - 1))}
                        disabled={postsPage === 1}
                        className="bg-white/5 hover:bg-white/10 text-white font-semibold py-1.5 px-3 rounded-lg border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setPostsPage(p => Math.min(postsTotalPages, p + 1))}
                        disabled={postsPage === postsTotalPages}
                        className="bg-white/5 hover:bg-white/10 text-white font-semibold py-1.5 px-3 rounded-lg border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* TAB 5: SYSTEM CONFIGURATIONS */}
            {activeTab === 'settings' && (
              <div className="flex flex-col gap-6">
                
                <div>
                  <h1 className="text-xl font-bold text-white">Global Configurations</h1>
                  <p className="text-xs text-on-surface-variant">Update active API parameters, toggle global system maintenance status, and scale XP awards.</p>
                </div>

                <form onSubmit={handleSaveSettings} className="glass-card p-6 rounded-xl border border-white/5 bg-[#18181b]/35 flex flex-col gap-6 max-w-xl text-left shadow-2xl">
                  
                  {/* Maintenance Switch */}
                  <div className="flex items-center justify-between bg-black/20 p-4 rounded-xl border border-white/5">
                    <div className="flex flex-col gap-0.5 text-left">
                      <label className="text-sm font-bold text-white flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-amber-400 text-lg">construction</span>
                        System Maintenance Mode
                      </label>
                      <span className="text-[10px] text-on-surface-variant leading-relaxed pr-6">Blocks standard client API endpoints with a scheduled maintenance warning. Active administrators bypass this restriction automatically.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettings(s => ({ ...s, maintenanceMode: !s.maintenanceMode }))}
                      style={{
                        backgroundColor: settings.maintenanceMode ? '#818cf8' : 'rgba(255,255,255,0.1)',
                        minWidth: '44px',
                        flexShrink: 0,
                      }}
                      className="relative w-11 h-6 rounded-full transition-all duration-200 flex items-center border-none p-0 cursor-pointer"
                    >
                      <span
                        style={{
                          transform: settings.maintenanceMode ? 'translateX(22px)' : 'translateX(3px)',
                          transition: 'transform 0.2s ease',
                        }}
                        className="w-[18px] h-[18px] bg-white rounded-full shadow-md block"
                      />
                    </button>
                  </div>

                  {/* XP Multiplier Slider */}
                  <div className="flex flex-col gap-2 text-left">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                        <span className="material-symbols-outlined text-[#818cf8] text-lg">military_tech</span>
                        Global XP Multiplier scale
                      </label>
                      <span className="text-xs font-bold text-[#818cf8] font-mono bg-[#818cf8]/10 border border-[#818cf8]/20 px-2.5 py-0.5 rounded-lg">
                        {settings.globalXpMultiplier.toFixed(1)}x multiplier
                      </span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant">Scales consistency experience awards on completing mock voice interviews and submitting critiques.</p>
                    <input
                      type="range"
                      min="0.5"
                      max="3.0"
                      step="0.1"
                      value={settings.globalXpMultiplier}
                      onChange={(e) => setSettings(s => ({ ...s, globalXpMultiplier: parseFloat(e.target.value) }))}
                      style={{ accentColor: '#fbbf24' }}
                      className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer mt-2"
                    />
                  </div>


                  {/* Save button */}
                  <button
                    type="submit"
                    className="btn-primary w-full py-3.5 px-6 rounded-2xl border-none transition-all duration-200 mt-2 flex items-center justify-center gap-2 cursor-pointer text-xs font-bold text-white tracking-wide hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <span className="material-symbols-outlined text-lg">save</span>
                    Save Server Configurations
                  </button>

                </form>

              </div>
            )}

            {/* TAB 6: AUDIT LOGGING */}
            {activeTab === 'audits' && (
              <div className="flex flex-col gap-6">
                
                {/* Heading & Search actions */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-white">System Audit Logging</h1>
                  </div>
                  
                  {/* Search input */}
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/70 text-sm pointer-events-none">search</span>
                    <input
                      type="text"
                      placeholder="Filter by admin, action, target..."
                      value={auditLogsSearch}
                      onChange={(e) => setAuditLogsSearch(e.target.value)}
                      style={{ paddingLeft: '38px' }}
                      className="bg-white/5 border border-white/10 rounded-xl py-2.5 pr-4 text-xs text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20 transition-all w-72"
                    />
                  </div>
                </div>

                {/* Compliance Warning Banner */}
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/10 text-red-400 px-3.5 py-2 rounded-lg text-[10px] font-semibold max-w-max self-start -mt-2">
                  <span className="material-symbols-outlined text-sm">gpp_maybe</span>
                  <span>Read-only cryptographic compliance trail. Modifications are strictly disabled.</span>
                </div>

                {/* Audit Logs Table */}
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.01]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 font-bold text-white">
                        <th className="py-3 px-4">Admin Email</th>
                        <th className="py-3 px-4">Action Event</th>
                        <th className="py-3 px-4">Target Item</th>
                        <th className="py-3 px-4">Details Summary</th>
                        <th className="py-3 px-4 font-mono">IP Address</th>
                        <th className="py-3 px-4">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.length > 0 ? auditLogs.map((log, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors font-mono text-[11px] text-on-surface-variant">
                          <td className="py-3.5 px-4 font-semibold text-white">{log.adminEmail}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${
                              log.action === 'IMPERSONATION_START' ? 'bg-amber-400/10 text-amber-300 border border-amber-400/20' :
                              log.action.includes('DELETE') ? 'bg-red-400/10 text-red-300 border border-red-400/20' :
                              log.action.includes('UPDATE') ? 'bg-blue-400/10 text-blue-300 border border-blue-400/20' :
                              'bg-white/10 text-white'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 truncate max-w-[120px]" title={log.target}>{log.target}</td>
                          <td className="py-3.5 px-4 max-w-[200px] truncate" title={JSON.stringify(log.details)}>
                            {JSON.stringify(log.details)}
                          </td>
                          <td className="py-3.5 px-4 text-on-surface-variant/70">{log.ip || '127.0.0.1'}</td>
                          <td className="py-3.5 px-4 text-on-surface-variant/70">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="6" className="text-center py-8 text-on-surface-variant font-mono">No system audit events recorded.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {auditLogsTotalPages > 1 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-on-surface-variant font-mono">Page {auditLogsPage} of {auditLogsTotalPages}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAuditLogsPage(p => Math.max(1, p - 1))}
                        disabled={auditLogsPage === 1}
                        className="bg-white/5 hover:bg-white/10 text-white font-semibold py-1.5 px-3 rounded-lg border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setAuditLogsPage(p => Math.min(auditLogsTotalPages, p + 1))}
                        disabled={auditLogsPage === auditLogsTotalPages}
                        className="bg-white/5 hover:bg-white/10 text-white font-semibold py-1.5 px-3 rounded-lg border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* TAB: RECRUITER REQUESTS */}
            {activeTab === 'recruiters' && (
              <div className="flex flex-col gap-6">
                <div>
                  <h1 className="text-xl font-bold text-white">Recruiter Upgrade Requests</h1>
                  <p className="text-xs text-on-surface-variant">Review and approve applications from candidates requesting Recruiter privileges.</p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.01]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 font-bold text-white">
                        <th className="py-3 px-4">Name</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Date Applied</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recruiterRequests.length > 0 ? recruiterRequests.map((req, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-white">{req.userName}</td>
                          <td className="py-3.5 px-4 font-mono text-on-surface-variant">{req.email}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${
                              req.status === 'approved' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                              req.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                              'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                            }`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-on-surface-variant font-mono">{new Date(req.createdAt).toLocaleDateString()}</td>
                          <td className="py-3.5 px-4 text-right">
                            {req.status === 'pending' && (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleApproveRecruiter(req.email, 'approved')}
                                  className="bg-green-500 hover:bg-green-600 text-black font-bold py-1 px-3 rounded-lg border-none text-[10px] cursor-pointer transition-all"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleApproveRecruiter(req.email, 'rejected')}
                                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold py-1 px-3 rounded-lg border border-red-500/30 text-[10px] cursor-pointer transition-all"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="5" className="text-center py-8 text-on-surface-variant font-mono">No recruiter requests found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </main>

      </div>

      {/* MODAL: CREATE NEW ACCOUNT */}
      {createAccount !== null && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div
            style={{ backgroundColor: '#09090b', border: '1px solid rgba(129,140,248,0.2)' }}
            className="w-full max-w-lg rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
          >
            <button
              onClick={() => setCreateAccount(null)}
              className="absolute top-4 right-4 bg-transparent border-none text-on-surface-variant hover:text-white cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>

            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-[#818cf8] text-xl">person_add</span>
              <h3 className="text-md font-bold text-white">Create New Account</h3>
            </div>

            <form onSubmit={handleCreateAccount} className="flex flex-col gap-4">

              {createAccount._error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-2.5 rounded-lg flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  {createAccount._error}
                </div>
              )}

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Full Name <span className="text-red-400">*</span></label>
                <input type="text" required placeholder="e.g. Jane Smith"
                  value={createAccount.name}
                  onChange={(e) => setCreateAccount(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-[#131315]/80 border border-outline-variant rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#818cf8] placeholder:text-white/20"
                />
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Email Address <span className="text-red-400">*</span></label>
                <input type="email" required placeholder="e.g. jane@company.com"
                  value={createAccount.email}
                  onChange={(e) => setCreateAccount(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-[#131315]/80 border border-outline-variant rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#818cf8] placeholder:text-white/20"
                />
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Password <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input
                    type={createAccount._showPw ? 'text' : 'password'}
                    required placeholder="Min 6 characters"
                    value={createAccount.password}
                    onChange={(e) => setCreateAccount(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-[#131315]/80 border border-outline-variant rounded-xl px-4 py-3 pr-10 text-xs text-white focus:outline-none focus:border-[#818cf8] placeholder:text-white/20"
                  />
                  <button type="button"
                    onClick={() => setCreateAccount(prev => ({ ...prev, _showPw: !prev._showPw }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-white bg-transparent border-none cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">{createAccount._showPw ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Domain</label>
                  <select value={createAccount.domain}
                    onChange={(e) => setCreateAccount(prev => ({ ...prev, domain: e.target.value }))}
                    className="w-full bg-[#131315]/80 border border-outline-variant rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#818cf8] cursor-pointer appearance-none"
                  >
                    <option className="bg-[#131315]" value="swe">SWE</option>
                    <option className="bg-[#131315]" value="frontend">Frontend</option>
                    <option className="bg-[#131315]" value="backend">Backend</option>
                    <option className="bg-[#131315]" value="fullstack">Fullstack</option>
                    <option className="bg-[#131315]" value="mobile">Mobile</option>
                    <option className="bg-[#131315]" value="pm">Product Manager</option>
                    <option className="bg-[#131315]" value="ds">Data Science</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Role</label>
                  <select value={createAccount.role}
                    onChange={(e) => setCreateAccount(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full bg-[#131315]/80 border border-outline-variant rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#818cf8] cursor-pointer appearance-none"
                  >
                    <option className="bg-[#131315]" value="USER">USER</option>
                    <option className="bg-[#131315]" value="RECRUITER">RECRUITER</option>
                    <option className="bg-[#131315]" value="MODERATOR">MODERATOR</option>
                    <option className="bg-[#131315]" value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Experience <span className="font-normal normal-case text-white/20">(optional)</span></label>
                  <input type="text" placeholder="e.g. 2 Yrs"
                    value={createAccount.experienceYears}
                    onChange={(e) => setCreateAccount(prev => ({ ...prev, experienceYears: e.target.value }))}
                    className="w-full bg-[#131315]/80 border border-outline-variant rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#818cf8] placeholder:text-white/20"
                  />
                </div>
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Dream Company <span className="font-normal normal-case text-white/20">(optional)</span></label>
                  <input type="text" placeholder="e.g. Google"
                    value={createAccount.dreamCompany}
                    onChange={(e) => setCreateAccount(prev => ({ ...prev, dreamCompany: e.target.value }))}
                    className="w-full bg-[#131315]/80 border border-outline-variant rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#818cf8] placeholder:text-white/20"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={createAccount._saving}
                  className="flex-1 bg-[#818cf8] hover:bg-[#818cf8]/80 text-[#09090b] font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {createAccount._saving ? (
                    <><div className="w-3.5 h-3.5 border-2 border-[#09090b]/30 border-t-[#09090b] rounded-full animate-spin" />Creating...</>
                  ) : (
                    <><span className="material-symbols-outlined text-[15px]">person_add</span>Create Account</>
                  )}
                </button>
                <button type="button" onClick={() => setCreateAccount(null)}
                  className="px-5 py-3 rounded-xl border border-white/10 text-xs text-on-surface-variant hover:text-white hover:bg-white/5 transition-all cursor-pointer font-bold"
                >
                  Cancel
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CANDIDATE DETAILS */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div 
            style={{ backgroundColor: '#09090b', border: '1px solid rgba(255, 255, 255, 0.08)' }}
            className="w-full max-w-lg rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
          >
            <button
              onClick={() => setEditingUser(null)}
              className="absolute top-4 right-4 bg-transparent border-none text-on-surface-variant hover:text-white cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>

            <h3 className="text-md font-bold text-white mb-4">Edit Candidate Account: <span className="text-amber-300 font-mono text-xs">{editingUser.email}</span></h3>
            
            <form onSubmit={handleUpdateUser} className="flex flex-col gap-4">
              
              {/* Full Name */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Candidate Name</label>
                <input
                  type="text"
                  required
                  value={editingUser.name || ''}
                  onChange={(e) => setEditingUser(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-[#131315]/80 border border-outline-variant rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#818cf8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Domain Preference */}
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Domain Preference</label>
                  <div className="relative flex items-center">
                    <select
                      value={editingUser.domain || ''}
                      onChange={(e) => setEditingUser(prev => ({ ...prev, domain: e.target.value }))}
                      className="w-full bg-[#131315]/80 border border-outline-variant rounded-xl pl-4 pr-10 py-3 text-xs text-white focus:outline-none focus:border-[#818cf8] cursor-pointer appearance-none"
                    >
                      <option className="bg-[#131315] text-white" value="swe">SWE</option>
                      <option className="bg-[#131315] text-white" value="frontend">Frontend</option>
                      <option className="bg-[#131315] text-white" value="backend">Backend</option>
                      <option className="bg-[#131315] text-white" value="fullstack">Fullstack</option>
                      <option className="bg-[#131315] text-white" value="mobile">Mobile</option>
                      <option className="bg-[#131315] text-white" value="devops">DevOps</option>
                      <option className="bg-[#131315] text-white" value="ml">Machine Learning</option>
                      <option className="bg-[#131315] text-white" value="ds">Data Science</option>
                      <option className="bg-[#131315] text-white" value="pm">Product Manager</option>
                      <option className="bg-[#131315] text-white" value="em">Engineering Manager</option>
                      <option className="bg-[#131315] text-white" value="design">UI/UX Design</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-3 pointer-events-none text-on-surface-variant text-lg">expand_more</span>
                  </div>
                </div>

                {/* Role Status */}
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Security Access Role</label>
                  <div className="relative flex items-center">
                    <select
                      value={editingUser.role || ''}
                      onChange={(e) => setEditingUser(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full bg-[#131315]/80 border border-outline-variant rounded-xl pl-4 pr-10 py-3 text-xs text-white focus:outline-none focus:border-[#818cf8] cursor-pointer appearance-none"
                    >
                      <option className="bg-[#131315] text-white" value="USER">USER</option>
                      <option className="bg-[#131315] text-white" value="RECRUITER">RECRUITER</option>
                      <option className="bg-[#131315] text-white" value="MODERATOR">MODERATOR</option>
                      <option className="bg-[#131315] text-white" value="ADMIN">ADMIN</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-3 pointer-events-none text-on-surface-variant text-lg">expand_more</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Experience */}
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Experience Level</label>
                  <input
                    type="text"
                    value={editingUser.experienceYears || ''}
                    onChange={(e) => setEditingUser(prev => ({ ...prev, experienceYears: e.target.value }))}
                    className="w-full bg-[#131315]/80 border border-outline-variant rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#818cf8]"
                    placeholder="e.g. 2.5 Yrs"
                  />
                </div>

                {/* Education */}
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Highest Education</label>
                  <input
                    type="text"
                    value={editingUser.highestEducation || ''}
                    onChange={(e) => setEditingUser(prev => ({ ...prev, highestEducation: e.target.value }))}
                    className="w-full bg-[#131315]/80 border border-outline-variant rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#818cf8]"
                    placeholder="e.g. B.S. Computer Science"
                  />
                </div>
              </div>

              {/* Dream Target Company */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Dream Company Focus</label>
                <input
                  type="text"
                  value={editingUser.dreamCompany || ''}
                  onChange={(e) => setEditingUser(prev => ({ ...prev, dreamCompany: e.target.value }))}
                  className="w-full bg-[#131315]/80 border border-outline-variant rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#818cf8]"
                  placeholder="e.g. Stripe / Google"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="btn-secondary py-2.5 px-6 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary py-2.5 px-6 text-xs font-bold"
                >
                  Apply Profile Changes
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW DIALOG TRANSCRIPTS */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div 
            style={{ backgroundColor: '#09090b', border: '1px solid rgba(255, 255, 255, 0.08)' }}
            className="w-full max-w-2xl h-[85vh] max-h-[700px] rounded-2xl p-6 shadow-[0_0_50px_rgba(37,99,235,0.15)] flex flex-col relative animate-in fade-in zoom-in-95 duration-200"
          >
            
            <button
              onClick={() => setSelectedSession(null)}
              className="absolute top-4 right-4 bg-transparent border-none text-on-surface-variant hover:text-white cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>

            <h3 className="text-md font-bold text-white mb-2 text-left">Completed Session Dialog Audit</h3>
            <p className="text-[10px] text-on-surface-variant font-mono mb-4 border-b border-white/10 pb-2 text-left">Session ID: {selectedSession.id} | Email: {selectedSession.userEmail || 'google.user@example.com'}</p>

            {/* Scrollable Modal Content container */}
            <div className="flex-grow flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar">
              
              {/* Dialogue bubbles wrapper */}
              <div 
                style={{ maxHeight: '350px' }}
                className="flex flex-col gap-3 bg-black/40 p-4 rounded-xl border border-white/5 overflow-y-auto custom-scrollbar"
              >
                {selectedSession.transcript && selectedSession.transcript.length > 0 ? selectedSession.transcript.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col gap-1 max-w-[85%] ${
                      item.sender === 'candidate' ? 'self-end items-end' : 'self-start items-start'
                    }`}
                  >
                    <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-wider">
                      {item.sender === 'candidate' ? 'Candidate' : 'Interviewer'}
                    </span>
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                      item.sender === 'candidate'
                        ? 'bg-[#1e1b4b] text-[#b4c5ff] rounded-tr-none border border-indigo-500/30'
                        : 'bg-white/5 text-white rounded-tl-none border border-white/10'
                    }`}>
                      {item.text}
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-xs text-on-surface-variant italic">No audio dialogue recorded for this session.</div>
                )}
              </div>

              {/* AI Performance Evaluation details */}
              {selectedSession.report && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2.5 text-left">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-emerald-400 text-sm">feedback</span>
                      AI Feedback Audit Report
                    </h4>
                    <span className="font-mono text-xs text-emerald-400 font-bold bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded">
                      Score: {selectedSession.report.score}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-[10px] font-mono text-on-surface-variant pb-2 border-b border-white/5">
                    <div>🕒 hesitation: {selectedSession.report.hesitationDuration || 'N/A'}</div>
                    <div> filler: {selectedSession.report.fillerWords || 0} words</div>
                    <div>🗣️ pace: {selectedSession.report.wpm || 0} WPM</div>
                  </div>
                  <div className="text-[11px] leading-relaxed text-on-surface-variant">
                    <p><strong>Correctness Audit:</strong> {selectedSession.report.correctnessFeedback}</p>
                    <p className="mt-1"><strong>Clarity Audit:</strong> {selectedSession.report.clarityFeedback}</p>
                  </div>
                </div>
              )}

            </div>

            <div className="flex justify-end mt-4 pt-3 border-t border-white/10">
              <button
                onClick={() => setSelectedSession(null)}
                className="btn-primary py-2.5 px-6 text-xs font-bold"
              >
                Close Dialog Log
              </button>
            </div>

          </div>
        </div>
      )}



    </div>
  );
}
