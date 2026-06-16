import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';

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

  const [notifications, setNotifications] = useState([
    { id: 1, title: 'ATS Resume Evals', message: 'Your resume scored 87%! Added 12 keywords for Kubernetes.', icon: 'verified', iconColor: 'text-primary' },
    { id: 2, title: 'Google Meet Setup', message: 'Mock session scheduled with Mentor Clara (NoSQL Lead).', icon: 'video_call', iconColor: 'text-secondary' },
    { id: 3, title: 'Day 15 Challenge', message: 'Streak maintained! Day 15 unlocked successfully.', icon: 'local_fire_department', iconColor: 'text-amber-400' },
  ]);

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
  useEffect(() => {
    if (sessionStorage.getItem('isAuthenticated') !== 'true') { navigate('/login'); return; }
    const name = sessionStorage.getItem('userName');
    if (name) setUserName(name);
  }, [navigate]);

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
  const handleSignOut = () => { sessionStorage.clear(); navigate('/'); };
  const clearNotifications = (e) => { e.stopPropagation(); setNotifications([]); };

  const handleTabClick = (tab) => {
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
    if (tab === 'resume') navigate('/resume-analyzer');
    else if (tab === 'practice') navigate('/practice');
    else if (tab === 'community') navigate('/community');
    else if (tab === 'booking') navigate('/billing#bookings');
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

  const tabs = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'practice',  label: 'Practice' },
    { key: 'booking',   label: 'Book Session' },
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

          {/* Streak — isolated wrapper for popup */}
          <div className="relative" ref={streakWrapperRef}>
            <div
              onMouseEnter={() => setIsStreakOpen(true)}
              onMouseLeave={() => setIsStreakOpen(false)}
              className="px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-all select-none"
            >
              <span className="text-sm">🔥</span>
              <span className="text-xs text-primary font-bold">15 Days</span>
            </div>

            {isStreakOpen && (
              <div
                onMouseEnter={() => setIsStreakOpen(true)}
                onMouseLeave={() => setIsStreakOpen(false)}
                className="absolute top-[calc(100%+8px)] right-0 w-64 p-3 rounded-xl border border-white/10 flex flex-col gap-2 text-left shadow-2xl bg-[#09090b] backdrop-blur-2xl"
                style={{ zIndex: 9999 }}
              >
                <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
                  <span className="text-xs font-bold text-white">⚡ Streak Active!</span>
                  <span className="text-[10px] text-primary">Day 15/30</span>
                </div>
                <p className="text-[11px] text-on-surface-variant">You are in the top 5% of candidate performers this month. Keep it going!</p>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full w-[50%]" />
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
                <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
                  {notifications.length > 0 ? notifications.map((n) => (
                    <div key={n.id} className="flex items-start gap-2.5 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-white/5">
                      <span className={`material-symbols-outlined ${n.iconColor} text-[18px] mt-0.5`}>{n.icon}</span>
                      <div>
                        <p className="text-xs font-medium text-white">{n.title}</p>
                        <p className="text-[10px] text-on-surface-variant leading-relaxed">{n.message}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <span className="material-symbols-outlined text-on-surface-variant/40 text-4xl mb-2">notifications_off</span>
                      <p className="text-xs text-on-surface-variant/60 font-medium">All caught up!</p>
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10" />

                {/* Actions */}
                <div className="flex flex-col gap-1.5">
                  <button onClick={() => { navigate('/dashboard'); setIsDropdownOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold text-[#ddb7ff] bg-[#ddb7ff]/10 hover:bg-[#ddb7ff]/20 transition-all border border-[#ddb7ff]/20 cursor-pointer">
                    <span className="material-symbols-outlined text-[18px]">verified_user</span>Switch to Mentor Portal
                  </button>
                  <button onClick={() => { navigate('/dashboard'); setIsDropdownOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-white/5 hover:text-white transition-all cursor-pointer border-none bg-transparent">
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
