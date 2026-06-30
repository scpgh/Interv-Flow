import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';

export default function DashboardNavbar({ activeTab, setActiveTab }) {
  const navigate = useNavigate();
  const activeTabRef = useRef(null);
  const streakWrapperRef = useRef(null);
  const avatarWrapperRef = useRef(null);

  const [userName, setUserName] = useState('Alex');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isStreakOpen, setIsStreakOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [navPillStyle, setNavPillStyle] = useState({ opacity: 0, left: 0, width: 0 });

  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('intervflow_notifications');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: 'init-1', title: 'ATS Resume Evals', message: 'Your resume scored 87%! Added 12 keywords for Kubernetes.', icon: 'verified', iconColor: 'text-primary' },
      { id: 'init-2', title: 'Day 15 Challenge', message: 'Streak maintained! Day 15 unlocked successfully.', icon: 'local_fire_department', iconColor: 'text-amber-400' },
    ];
  });

  useEffect(() => {
    localStorage.setItem('intervflow_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    const handleNewNotification = (e) => {
      if (e.detail) {
        setNotifications(prev => [
          {
            id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: e.detail.title,
            message: e.detail.message,
            icon: e.detail.icon || 'notifications',
            iconColor: e.detail.iconColor || 'text-primary'
          },
          ...prev
        ]);
      }
    };
    window.addEventListener('add-intervflow-notification', handleNewNotification);
    return () => {
      window.removeEventListener('add-intervflow-notification', handleNewNotification);
    };
  }, []);

  // ── Nav pill ──────────────────────────────────────────────────────
  const syncPill = useCallback(() => {
    if (activeTabRef.current) {
      setNavPillStyle({
        opacity: 1,
        left: activeTabRef.current.offsetLeft,
        width: activeTabRef.current.offsetWidth,
      });
    }
  }, []);

  useEffect(() => {
    syncPill();
    const t = setTimeout(syncPill, 100);
    window.addEventListener('resize', syncPill);
    return () => { window.removeEventListener('resize', syncPill); clearTimeout(t); };
  }, [activeTab, syncPill]);

  // ── Load user ─────────────────────────────────────────────────────
  const [userRole, setUserRole] = useState('USER');
  const [viewMode, setViewMode] = useState(() => {
    return sessionStorage.getItem('activeViewMode') || 
           ((sessionStorage.getItem('userRole') === 'RECRUITER') ? 'recruiter' : 'candidate');
  });

  const switchToCandidate = () => {
    sessionStorage.setItem('activeViewMode', 'candidate');
    setViewMode('candidate');
    navigate('/dashboard');
  };

  const switchToRecruiter = () => {
    sessionStorage.setItem('activeViewMode', 'recruiter');
    setViewMode('recruiter');
    navigate('/recruiter/dashboard');
  };

  useEffect(() => {
    if (sessionStorage.getItem('isAuthenticated') !== 'true') { navigate('/login'); return; }
    const name = sessionStorage.getItem('userName');
    if (name) setUserName(name);
    const cachedRole = sessionStorage.getItem('userRole') || sessionStorage.getItem('adminRole');
    if (cachedRole) {
      setUserRole(cachedRole);
    }

    const email = sessionStorage.getItem('userEmail');
    if (email) {
      // Fetch fresh profile details from server to catch upgrades
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/user/profile?email=${encodeURIComponent(email)}`)
        .then(res => res.json())
        .then(async data => {
          if (data.success && data.user) {
            const dbRole = data.user.role || 'USER';
            const localRole = sessionStorage.getItem('userRole');
            if (dbRole !== localRole) {
              console.log(`[Navbar Sync] Upgraded userRole from ${localRole} to ${dbRole}!`);
              sessionStorage.setItem('userRole', dbRole);
              setUserRole(dbRole);

              // Force update View Mode
              if (dbRole === 'RECRUITER') {
                sessionStorage.setItem('activeViewMode', 'recruiter');
                setViewMode('recruiter');
                // Trigger Recruiter approved notification
                window.dispatchEvent(new CustomEvent('add-intervflow-notification', {
                  detail: {
                    title: 'Recruiter Access Approved!',
                    message: 'Your recruiter onboarding request has been successfully approved by the admin.',
                    icon: 'verified',
                    iconColor: 'text-emerald-400'
                  }
                }));
              } else if (dbRole === 'ADMIN') {
                // Keep active view mode for admin (don't force override)
              } else {
                sessionStorage.setItem('activeViewMode', 'candidate');
                setViewMode('candidate');
              }

              // Sync Firebase client custom claims token by forcing refresh
              try {
                const currentUser = auth.currentUser;
                if (currentUser) {
                  const token = await currentUser.getIdToken(true);
                  sessionStorage.setItem('idToken', token);
                }
              } catch (e) {
                console.warn("Could not force refresh firebase token on claims sync:", e.message);
              }
            }
          }
        })
        .catch(err => console.warn("Failed to check active profile role updates:", err));
    }
  }, [navigate]);

  const [streakCount, setStreakCount] = useState(0);
  const [userXP, setUserXP] = useState(750);

  useEffect(() => {
    const loadCachedXP = () => {
      const cachedXP = localStorage.getItem('intervflow_user_xp');
      if (cachedXP) {
        setUserXP(parseInt(cachedXP, 10));
      }
    };
    loadCachedXP();
    window.addEventListener('storage', loadCachedXP);
    window.addEventListener('intervflow-xp-update', loadCachedXP);
    return () => {
      window.removeEventListener('storage', loadCachedXP);
      window.removeEventListener('intervflow-xp-update', loadCachedXP);
    };
  }, []);

  // ── Load streak dynamically based on user usage ───────────────────
  useEffect(() => {
    const fetchStreak = async () => {
      const email = sessionStorage.getItem('userEmail');
      if (!email) return;

      // Helper to get date string relative to today
      const getDateOffsetStr = (offset) => {
        const d = new Date();
        d.setDate(d.getDate() - offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      const todayStr = getDateOffsetStr(0);

      // Check cache first to avoid fetching on tab changes
      const cachedCount = sessionStorage.getItem('user_streak_count');
      const cachedDate = sessionStorage.getItem('user_streak_last_fetched');
      const cachedEmail = sessionStorage.getItem('user_streak_email');

      if (cachedCount !== null && cachedDate === todayStr && cachedEmail === email) {
        setStreakCount(parseInt(cachedCount, 10));
        return;
      }

      try {
        const res = await fetch(`http://localhost:5000/api/interview/sessions?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.sessions)) {
          const uniqueDates = new Set();
          data.sessions.forEach(s => {
            const dateVal = s.completedAt || s.startTime;
            if (dateVal) {
              const d = new Date(dateVal);
              const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              uniqueDates.add(dateStr);
            }
          });

          const yesterdayStr = getDateOffsetStr(1);

          let currentStreak = 0;
          let referenceDateStr = "";

          if (uniqueDates.has(todayStr)) {
            currentStreak = 1;
            referenceDateStr = todayStr;
          } else if (uniqueDates.has(yesterdayStr)) {
            currentStreak = 1;
            referenceDateStr = yesterdayStr;
          }

          if (currentStreak > 0) {
            let offset = 1;
            if (referenceDateStr === yesterdayStr) {
              offset = 2;
            }
            while (true) {
              const prevDateStr = getDateOffsetStr(offset);
              if (uniqueDates.has(prevDateStr)) {
                currentStreak++;
                offset++;
              } else {
                break;
              }
            }
          }

          setStreakCount(currentStreak);

          // Save to cache
          sessionStorage.setItem('user_streak_count', String(currentStreak));
          sessionStorage.setItem('user_streak_last_fetched', todayStr);
          sessionStorage.setItem('user_streak_email', email);
        }
      } catch (err) {
        console.error("Failed to fetch streak:", err);
      }
    };

    if (sessionStorage.getItem('isAuthenticated') === 'true') {
      fetchStreak();
    }
  }, []);

  // ── Close on outside click ────────────────────────────────────────
  useEffect(() => {
    const onDown = (e) => {
      if (streakWrapperRef.current && !streakWrapperRef.current.contains(e.target)) setIsStreakOpen(false);
      if (avatarWrapperRef.current && !avatarWrapperRef.current.contains(e.target)) setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────
  const handleExitImpersonation = () => {
    const adminEmail = sessionStorage.getItem('adminEmail');
    const adminName = sessionStorage.getItem('adminName');
    const adminRole = sessionStorage.getItem('adminRole');

    if (adminEmail) {
      sessionStorage.setItem('userEmail', adminEmail);
      sessionStorage.setItem('userName', adminName);
      sessionStorage.setItem('userRole', adminRole);
    }

    sessionStorage.removeItem('impersonatedUser');
    sessionStorage.removeItem('adminEmail');
    sessionStorage.removeItem('adminName');
    sessionStorage.removeItem('adminRole');

    window.location.href = '/admin';
  };

  const handleSignOut = () => { sessionStorage.clear(); navigate('/'); };
  const clearNotifications = (e) => { e.stopPropagation(); setNotifications([]); };
  const dismissNotification = (id, e) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleTabClick = (tab) => {
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
    if (tab === 'recruiter_dashboard') navigate('/recruiter/dashboard');
    else if (tab === 'resume') navigate('/resume-analyzer');
    else if (tab === 'practice') navigate('/practice');
    else if (tab === 'community') navigate('/community');
    else if (tab === 'jobs') navigate('/jobs');
    else if (tab === 'analytics') navigate('/analytics');
    else { navigate('/dashboard'); if (setActiveTab) setActiveTab(tab); }
  };


  const tabCls = (tab) =>
    `relative z-10 text-sm px-4 py-1.5 rounded-full transition-colors duration-200 cursor-pointer border-none bg-transparent ${
      activeTab === tab ? 'text-primary font-bold bg-primary/10 border border-primary/20' : 'text-on-surface-variant hover:text-white'
    }`;

  const mTabCls = (tab) =>
    `w-full text-left text-xs py-3 px-4 rounded-xl border-none bg-transparent cursor-pointer transition-colors ${
      activeTab === tab ? 'text-[#b4c5ff] font-bold bg-[#b4c5ff]/10 border border-[#b4c5ff]/20' : 'text-on-surface-variant hover:text-white hover:bg-white/5'
    }`;

  const tabs = viewMode === 'recruiter'
    ? [
        { key: 'recruiter_dashboard', label: 'Recruiter Dashboard' },
        { key: 'community', label: 'Community' }
      ]
    : [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'practice',  label: 'Practice' },
        { key: 'jobs',      label: 'Apply Jobs' },
        { key: 'resume',    label: 'Resume Analyser' },
        { key: 'analytics', label: 'Analytics' },
        { key: 'community', label: 'Community' },
      ];

  return (
    <header
      style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }}
      className="border-b border-white/10 bg-[#09090b]/80 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
    >
      <div className="flex items-center justify-between px-6 py-3 w-full max-w-[1400px] mx-auto">

        {/* ── Left: Logo + Nav ── */}
        <div className="flex items-center gap-6 min-w-0">
          <Link to="/" className="font-bold tracking-tight text-white flex items-center gap-2 flex-shrink-0">
            <img src="/intervflow_logo.png" alt="IntervFlow" className="h-8 w-8 object-contain" />
            <span>IntervFlow</span>
          </Link>

          {/* Desktop nav pill */}
          <nav
            className="relative hidden md:flex items-center gap-1 p-1 bg-white/[0.02] border border-white/[0.04] rounded-full"
            onMouseLeave={syncPill}
          >
            <div
              className="absolute top-1/2 -translate-y-1/2 h-[80%] bg-white/[0.07] rounded-full transition-all duration-300 ease-out pointer-events-none"
              style={{ left: navPillStyle.left, width: navPillStyle.width, opacity: navPillStyle.opacity }}
            />
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                ref={activeTab === key ? activeTabRef : null}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  setNavPillStyle({ opacity: 1, left: el.offsetLeft, width: el.offsetWidth });
                }}
                onClick={() => handleTabClick(key)}
                className={tabCls(key)}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Right: Streak + Avatar + Hamburger ── */}
        <div className="flex items-center gap-3 flex-shrink-0">

          {/* Direct Navbar Admin Dashboard Button */}
          {userRole === 'ADMIN' && (
            <button
              onClick={() => navigate('/admin')}
              className="bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 font-bold py-1.5 px-3.5 rounded-full text-[10px] transition-colors cursor-pointer flex items-center gap-1.5 border border-amber-400/20 shadow-md flex-shrink-0"
            >
              <span className="material-symbols-outlined text-[14px]">admin_panel_settings</span>
              Admin Dashboard
            </button>
          )}

          {/* Recruiter / Candidate Mode Switcher Toggle */}
          {(userRole === 'RECRUITER' || userRole === 'ADMIN') && (
            <button
              onClick={viewMode === 'recruiter' ? switchToCandidate : switchToRecruiter}
              className={`font-bold py-1.5 px-3.5 rounded-full text-[10px] transition-all cursor-pointer flex items-center gap-1.5 border shadow-md flex-shrink-0 ${
                viewMode === 'recruiter'
                  ? 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">
                {viewMode === 'recruiter' ? 'person' : 'work'}
              </span>
              {viewMode === 'recruiter' ? 'Switch to Candidate' : 'Switch to Recruiter'}
            </button>
          )}

          {/* Direct Navbar Exit Impersonation Button */}
          {sessionStorage.getItem('impersonatedUser') && (
            <button
              onClick={handleExitImpersonation}
              className="bg-amber-500 hover:bg-amber-600 text-black font-bold py-1.5 px-3.5 rounded-full text-[10px] transition-colors cursor-pointer flex items-center gap-1 shadow-md border-none flex-shrink-0"
            >
              <span className="material-symbols-outlined text-[14px]">logout</span>
              Exit Impersonation
            </button>
          )}

          {/* Streak — isolated wrapper for popup */}
          <div className="relative" ref={streakWrapperRef}>
            <div
              onMouseEnter={() => setIsStreakOpen(true)}
              onMouseLeave={() => setIsStreakOpen(false)}
              className="px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-all select-none"
            >
              <span className="text-sm">🔥</span>
              <span className="text-xs text-primary font-bold">{streakCount} {streakCount === 1 ? 'Day' : 'Days'}</span>
            </div>

            {isStreakOpen && (
              <div
                onMouseEnter={() => setIsStreakOpen(true)}
                onMouseLeave={() => setIsStreakOpen(false)}
                className="absolute top-[calc(100%+8px)] right-0 w-64 p-3 rounded-xl border border-white/10 flex flex-col gap-2 text-left shadow-2xl bg-[#09090b] backdrop-blur-2xl"
                style={{ zIndex: 9999 }}
              >
                <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
                  <span className="text-xs font-bold text-white">
                    {streakCount > 0 ? '⚡ Streak Active!' : '🔥 Start Practicing!'}
                  </span>
                  <span className="text-[10px] text-primary">Day {streakCount}/30</span>
                </div>
                
                {/* Dynamic XP display and Level Progress Bar */}
                <div className="flex flex-col gap-1 text-[10px] font-mono text-[#ddb7ff] bg-[#ddb7ff]/5 border border-[#ddb7ff]/10 rounded px-2.5 py-2 my-1.5">
                  <div className="flex justify-between items-center">
                    <span>Current Experience</span>
                    <span className="font-bold">✨ {userXP} XP</span>
                  </div>
                  <div className="w-full bg-white/15 h-1.5 rounded-full overflow-hidden mt-1.5">
                    <div className="bg-[#ddb7ff] h-full transition-all duration-300" style={{ width: `${((userXP % 1000) / 1000) * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-[8px] text-on-surface-variant/60 font-mono mt-0.5">
                    <span>Level {Math.floor(userXP / 1000) + 1}</span>
                    <span>{userXP % 1000} / 1000 XP for Lvl {Math.floor(userXP / 1000) + 2}</span>
                  </div>
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  {streakCount > 0 
                    ? `You are on a ${streakCount}-day practice streak! Keep preparing daily to stay sharp.` 
                    : "Complete a mock interview session today to start your consistency streak!"}
                </p>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full transition-all duration-300" style={{ width: `${Math.min((streakCount / 30) * 100, 100)}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Avatar — isolated wrapper for dropdown */}
          <div className="relative" ref={avatarWrapperRef}>
            <button
              onClick={() => setIsDropdownOpen((o) => !o)}
              className="relative flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer p-0"
              style={{ lineHeight: 0 }}
            >
              <div className="h-9 w-9 rounded-full overflow-hidden border-2 border-primary/50 hover:border-primary transition-all shadow-[0_0_10px_rgba(37,99,235,0.2)]">
                <img
                  alt="User"
                  className="w-full h-full object-cover"
                  src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23374151'/%3E%3Cstop offset='100%25' style='stop-color:%231f2937'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' fill='url(%23g)'/%3E%3Ccircle cx='50' cy='36' r='16' fill='%239ca3af'/%3E%3Cellipse cx='50' cy='80' rx='28' ry='20' fill='%239ca3af'/%3E%3C/svg%3E"
                />
              </div>
              {notifications.length > 0 && (
                <>
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-[#09090b] animate-ping pointer-events-none" />
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-[#09090b] pointer-events-none" />
                </>
              )}
            </button>

            {isDropdownOpen && (
              <div
                className="absolute top-[calc(100%+8px)] right-0 w-80 rounded-2xl border border-white/10 p-4 flex flex-col gap-4 shadow-2xl bg-[#09090b] backdrop-blur-2xl"
                style={{ zIndex: 9999 }}
              >
                {/* Notifications header */}
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-red-400 text-sm animate-bounce">notifications_active</span>
                    Notifications ({notifications.length})
                  </span>
                  {notifications.length > 0 && (
                    <button className="text-[10px] text-primary hover:underline cursor-pointer border-none bg-transparent" onClick={clearNotifications}>
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Notification list */}
                <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1 hide-scrollbar">
                  {notifications.length > 0 ? notifications.map((n) => (
                    <div key={n.id} className="flex items-start justify-between gap-2.5 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5 group/notif relative text-left">
                      <div className="flex items-start gap-2.5">
                        <span className={`material-symbols-outlined ${n.iconColor || 'text-primary'} text-[18px] mt-0.5 shrink-0`}>{n.icon || 'notifications'}</span>
                        <div>
                          <p className="text-xs font-semibold text-white">{n.title}</p>
                          <p className="text-[10px] text-on-surface-variant leading-relaxed">{n.message}</p>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => dismissNotification(n.id, e)} 
                        className="material-symbols-outlined text-[14px] text-on-surface-variant/40 hover:text-red-400 cursor-pointer border-none bg-transparent self-start pt-0.5 transition-all opacity-0 group-hover/notif:opacity-100 shrink-0"
                        title="Dismiss"
                      >
                        close
                      </button>
                    </div>
                  )) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <span className="material-symbols-outlined text-on-surface-variant/40 text-4xl mb-2">notifications_off</span>
                      <p className="text-xs text-on-surface-variant/60 font-medium">All caught up!</p>
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10" />

                {/* User Info & Impersonation Badge */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 px-3 py-2 bg-white/5 rounded-xl border border-white/5">
                    <div className="h-8 w-8 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center font-bold text-primary text-xs flex-shrink-0">
                      {userName[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{userName}</p>
                      <p className="text-[10px] text-on-surface-variant truncate">{sessionStorage.getItem('userEmail')}</p>
                    </div>
                  </div>
                  {sessionStorage.getItem('impersonatedUser') && (
                    <div className="flex flex-col gap-1.5 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <div className="flex items-center gap-1.5 text-amber-300 text-[10px] font-semibold">
                        <span className="material-symbols-outlined text-xs text-amber-400">visibility</span>
                        <span>Viewing As Impersonated User</span>
                      </div>
                      <button
                        onClick={handleExitImpersonation}
                        className="w-full text-center py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg text-[9px] border-none transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-xs">logout</span>
                        Exit Impersonation
                      </button>
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10" />

                {/* Actions */}
                <div className="flex flex-col gap-1.5">
                  {userRole === 'ADMIN' && (
                    <button onClick={() => { navigate('/admin'); setIsDropdownOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 transition-all border border-amber-400/20 cursor-pointer">
                      <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>Admin Dashboard
                    </button>
                  )}
                  {(userRole === 'RECRUITER' || userRole === 'ADMIN') && (
                    <button
                      onClick={() => {
                        if (viewMode === 'recruiter') switchToCandidate();
                        else switchToRecruiter();
                        setIsDropdownOpen(false);
                      }}
                      className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                        viewMode === 'recruiter'
                          ? 'text-[#ddb7ff] bg-[#ddb7ff]/10 hover:bg-[#ddb7ff]/20 border-[#ddb7ff]/20'
                          : 'text-primary bg-primary/10 hover:bg-primary/20 border-primary/20'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {viewMode === 'recruiter' ? 'person' : 'work'}
                      </span>
                      Switch to {viewMode === 'recruiter' ? 'Candidate Portal' : 'Recruiter Portal'}
                    </button>
                  )}
                  <button onClick={() => { navigate('/billing#profile'); setIsDropdownOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-white/5 hover:text-white transition-all cursor-pointer border-none bg-transparent">
                    <span className="material-symbols-outlined text-[18px]">person</span>Profile Settings
                  </button>
                  <button onClick={() => { navigate('/billing'); setIsDropdownOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-white/5 hover:text-white transition-all cursor-pointer border-none bg-transparent">
                    <span className="material-symbols-outlined text-[18px]">credit_card</span>Billing &amp; Subscriptions
                  </button>
                  <button onClick={() => { handleSignOut(); }} className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-all cursor-pointer border-none bg-transparent">
                    <span className="material-symbols-outlined text-[18px]">logout</span>Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Hamburger (mobile) */}
          <button
            onClick={() => setIsMobileMenuOpen((o) => !o)}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/5 border-none bg-transparent cursor-pointer text-white"
          >
            <span className="material-symbols-outlined text-[24px]">{isMobileMenuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-[#09090b]/98 backdrop-blur-2xl px-6 py-4 flex flex-col gap-2">
          {(userRole === 'RECRUITER' || userRole === 'ADMIN') && (
            <button
              onClick={viewMode === 'recruiter' ? switchToCandidate : switchToRecruiter}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                viewMode === 'recruiter'
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {viewMode === 'recruiter' ? 'person' : 'work'}
              </span>
              Switch to {viewMode === 'recruiter' ? 'Candidate View' : 'Recruiter View'}
            </button>
          )}
          {tabs.map(({ key, label }) => (
            <button key={key} onClick={() => handleTabClick(key)} className={mTabCls(key)}>
              {label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
