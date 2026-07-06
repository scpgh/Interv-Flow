import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Navbar({ activeTab }) {
  const navigate = useNavigate();
  const activeTabRef = useRef(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [navPillStyle, setNavPillStyle] = useState({ opacity: 0, left: 0, width: 0 });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('intervflow_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('intervflow_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const syncPillToActive = () => {
    if (activeTabRef.current) {
      setNavPillStyle({
        opacity: 1,
        left: activeTabRef.current.offsetLeft,
        width: activeTabRef.current.offsetWidth,
      });
    } else {
      setNavPillStyle(prev => ({ ...prev, opacity: 0 }));
    }
  };

  useEffect(() => {
    syncPillToActive();
    window.addEventListener('resize', syncPillToActive);
    
    const timer = setTimeout(syncPillToActive, 100);
    
    return () => {
      window.removeEventListener('resize', syncPillToActive);
      clearTimeout(timer);
    };
  }, [activeTab]);

  const handleMouseEnter = (e) => {
    const el = e.currentTarget;
    setNavPillStyle({
      opacity: 1,
      left: el.offsetLeft,
      width: el.offsetWidth,
    });
  };

  const handleMouseLeave = () => {
    syncPillToActive();
  };

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('USER');

  useEffect(() => {
    setIsLoggedIn(sessionStorage.getItem('isAuthenticated') === 'true');
    const role = sessionStorage.getItem('userRole') || sessionStorage.getItem('adminRole');
    if (role) setUserRole(role);
  }, []);

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

  const handleSignOut = () => {
    sessionStorage.clear();
    setIsLoggedIn(false);
    navigate('/');
  };

  const handleDashboardClick = (e) => {
    e.preventDefault();
    const loggedIn = sessionStorage.getItem('isAuthenticated') === 'true';
    if (!loggedIn) {
      navigate('/login');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 w-[92%] max-w-container-max-width z-50 rounded-full border border-outline/10 bg-surface/80 backdrop-blur-xl px-6 py-2.5 flex justify-between items-center shadow-[0_10px_30px_rgba(0,0,0,0.1)] transition-all duration-300">
      <div className="flex items-center gap-8">
        <Link className="font-headline-md text-headline-md font-bold tracking-tight text-white flex items-center gap-2.5 cursor-pointer" to="/">
          <img src="/intervflow_logo.png" alt="IntervFlow Logo" className="h-8 w-8 object-contain" />
          <span className="text-white">IntervFlow</span>
        </Link>
        
        {/* Desktop Menu with hoverable Dropdowns */}
        <nav 
          className="relative hidden md:flex items-center gap-1 ml-4 p-1 bg-white/[0.02] border border-white/[0.04] rounded-full nav-pill-container"
          onMouseLeave={handleMouseLeave}
        >
          {/* Sliding Hover Pill Background */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 h-[80%] bg-white/[0.07] rounded-full transition-all duration-300 ease-out pointer-events-none nav-sliding-indicator"
            style={{
              left: `${navPillStyle.left}px`,
              width: `${navPillStyle.width}px`,
              opacity: navPillStyle.opacity,
            }}
          />

          {/* Dashboard Link */}
          <a
            href="/dashboard"
            ref={activeTab === 'dashboard' ? activeTabRef : null}
            onMouseEnter={handleMouseEnter}
            onClick={handleDashboardClick}
            className={`relative z-10 font-body-md text-body-md px-4 py-1.5 rounded-full transition-colors duration-200 cursor-pointer ${activeTab === 'dashboard' ? 'text-primary font-bold bg-primary/10 border border-primary/20' : 'text-on-surface-variant hover:text-white'}`}
          >
            Dashboard
          </a>

          {/* Use Cases Dropdown */}
          <div className="relative dropdown-parent group" onMouseEnter={handleMouseEnter}>
            <button className="relative z-10 font-body-md text-body-md text-on-surface-variant hover:text-white px-4 py-1.5 rounded-full transition-colors duration-200 flex items-center gap-1 focus:outline-none cursor-pointer bg-transparent border-none">
              Use Cases
              <span className="material-symbols-outlined text-[16px] transition-transform duration-300 group-hover:rotate-180">keyboard_arrow_down</span>
            </button>
            
            {/* Dropdown Menu Box */}
            <div className="absolute top-12 left-0 w-80 rounded-2xl glass-card border border-outline/10 p-4 dropdown-menu z-50 flex flex-col gap-3 bg-surface/95 backdrop-blur-2xl shadow-2xl">
              <Link to="/#simulator" className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-all group/item cursor-pointer">
                <span className="material-symbols-outlined text-primary text-lg mt-0.5 bg-primary/10 p-1.5 rounded-lg group-hover/item:bg-primary/20 transition-all">psychology</span>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover/item:text-primary transition-colors">AI Mock Interviews</h4>
                  <p className="text-[10px] text-on-surface-variant leading-relaxed">SDE, PM, Finance, and Consulting tracks with real-time voice analysis and filler word detection.</p>
                </div>
              </Link>
              <Link to="/resume-analyzer" className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-all group/item cursor-pointer">
                <span className="material-symbols-outlined text-[#ddb7ff] text-lg mt-0.5 bg-[#ddb7ff]/10 p-1.5 rounded-lg group-hover/item:bg-[#ddb7ff]/20 transition-all">description</span>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover/item:text-[#ddb7ff] transition-colors">Resume ATS Analyzer</h4>
                  <p className="text-[10px] text-on-surface-variant leading-relaxed">Upload your resume, get an ATS score, keyword gaps, and role-specific interview questions instantly.</p>
                </div>
              </Link>
              <Link to="/#pricing" className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-all group/item cursor-pointer">
                <span className="material-symbols-outlined text-emerald-400 text-lg mt-0.5 bg-emerald-500/10 p-1.5 rounded-lg group-hover/item:bg-emerald-500/20 transition-all">video_chat</span>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover/item:text-emerald-400 transition-colors">1:1 Expert Mentor Booking</h4>
                  <p className="text-[10px] text-on-surface-variant leading-relaxed">Book verified FAANG mentors on Google Meet. Your AI mock telemetry is shared before the session.</p>
                </div>
              </Link>
              <Link to="/#testimonials" className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-all group/item cursor-pointer">
                <span className="material-symbols-outlined text-amber-400 text-lg mt-0.5 bg-amber-400/10 p-1.5 rounded-lg group-hover/item:bg-amber-400/20 transition-all">groups</span>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover/item:text-amber-400 transition-colors">Community & Leaderboard</h4>
                  <p className="text-[10px] text-on-surface-variant leading-relaxed">Join weekly challenges, earn XP streaks, and compete on the global prep leaderboard.</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Pricing Link */}
          <Link 
            className={`relative z-10 font-body-md text-body-md px-4 py-1.5 rounded-full transition-colors duration-200 cursor-pointer ${activeTab === 'pricing' ? 'text-primary font-bold bg-primary/10 border border-primary/20' : 'text-on-surface-variant hover:text-white'}`}
            to="/#pricing"
            ref={activeTab === 'pricing' ? activeTabRef : null}
            onMouseEnter={handleMouseEnter}
            onClick={(e) => {
              const element = document.getElementById('pricing');
              if (element) {
                e.preventDefault();
                element.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            Pricing
          </Link>

          {/* Contact Link */}
          <Link 
            className={`relative z-10 font-body-md text-body-md px-4 py-1.5 rounded-full transition-colors duration-200 cursor-pointer ${activeTab === 'contact' ? 'text-primary font-bold bg-primary/10 border border-primary/20' : 'text-on-surface-variant hover:text-white'}`}
            to="/contact"
            ref={activeTab === 'contact' ? activeTabRef : null}
            onMouseEnter={handleMouseEnter}
          >
            Contact
          </Link>
        </nav>
      </div>
      
      <div className="flex items-center gap-3">
        {userRole === 'ADMIN' && (
          <button
            onClick={() => navigate('/admin')}
            className="hidden lg:flex bg-amber-50 dark:bg-amber-400/10 hover:bg-amber-100 dark:hover:bg-amber-400/20 text-amber-800 dark:text-amber-300 font-bold py-1.5 px-3.5 rounded-full text-[10px] transition-colors cursor-pointer items-center gap-1.5 border border-amber-200 dark:border-amber-400/20 shadow-md flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[14px]">admin_panel_settings</span>
            Admin Dashboard
          </button>
        )}

        {sessionStorage.getItem('impersonatedUser') && (
          <button
            onClick={handleExitImpersonation}
            className="hidden lg:flex bg-amber-500 hover:bg-amber-600 text-black font-bold py-1.5 px-3.5 rounded-full text-[10px] transition-colors cursor-pointer items-center gap-1 shadow-md border-none flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[14px]">logout</span>
            Exit Impersonation
          </button>
        )}

        {isLoggedIn ? (
          <>
            <button className="hidden sm:block text-on-surface-variant hover:text-white text-xs font-semibold px-4 py-2 cursor-pointer border-none bg-transparent" onClick={() => navigate('/dashboard')}>Dashboard</button>
            <button className="hidden sm:block btn-primary px-5 py-2 text-xs rounded-full text-white font-bold cursor-pointer" onClick={handleSignOut}>Sign Out</button>
          </>
        ) : (
          <>
            <button className="hidden sm:block text-on-surface-variant hover:text-white text-xs font-semibold px-4 py-2 cursor-pointer border-none bg-transparent" onClick={() => navigate('/login')}>Sign In</button>
            <button className="hidden sm:block btn-primary px-5 py-2 text-xs rounded-full text-white font-bold cursor-pointer" onClick={() => navigate('/signup')}>Get Started</button>
          </>
        )}
        
        {/* Luxury Light / Dark Mode Toggle Button */}
        <button
          onClick={toggleTheme}
          className="hidden sm:flex w-9 h-9 rounded-full items-center justify-center border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all cursor-pointer text-primary shrink-0"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <span className="material-symbols-outlined text-[18px]">
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
        
        {/* Hamburger Menu Toggle (Mobile only) */}
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden flex items-center justify-center p-2 rounded-full hover:bg-white/5 border-none bg-transparent cursor-pointer text-white ml-1"
        >
          <span className="material-symbols-outlined text-[24px]">
            {isMobileMenuOpen ? 'close' : 'menu'}
          </span>
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-[calc(100%+12px)] left-0 w-full bg-surface/98 backdrop-blur-2xl border border-outline/10 p-5 rounded-2xl flex flex-col gap-4 shadow-2xl animate-slideDown z-40 text-left">
          <nav className="flex flex-col gap-2">
            {/* Impersonation status */}
            {sessionStorage.getItem('impersonatedUser') && (
              <div className="flex flex-col gap-1.5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-2">
                <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-semibold">
                  <span className="material-symbols-outlined text-xs">visibility</span>
                  <span>Viewing As Impersonated User</span>
                </div>
                <button
                  onClick={handleExitImpersonation}
                  className="w-full text-center py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg text-[10px] border-none transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-xs">logout</span>
                  Exit Impersonation
                </button>
              </div>
            )}

            {/* Admin Dashboard */}
            {userRole === 'ADMIN' && (
              <button
                onClick={() => { navigate('/admin'); setIsMobileMenuOpen(false); }}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border bg-amber-400/10 border-amber-400/30 text-amber-300 hover:bg-amber-400/20 mb-2"
              >
                <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
                Admin Dashboard
              </button>
            )}

            <a 
              href="/dashboard"
              onClick={(e) => { e.preventDefault(); navigate('/dashboard'); setIsMobileMenuOpen(false); }}
              className={`w-full text-left font-body-md text-xs py-3 px-4 rounded-xl border-none bg-transparent cursor-pointer transition-colors ${activeTab === "dashboard" ? 'text-[#b4c5ff] font-bold bg-[#b4c5ff]/10 border border-[#b4c5ff]/20' : 'text-on-surface-variant hover:text-white hover:bg-white/5'}`}
            >
              Dashboard
            </a>
            <Link 
              to="/resume-analyzer"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`w-full text-left font-body-md text-xs py-3 px-4 rounded-xl border-none bg-transparent cursor-pointer transition-colors ${activeTab === "resume" ? 'text-[#b4c5ff] font-bold bg-[#b4c5ff]/10 border border-[#b4c5ff]/20' : 'text-on-surface-variant hover:text-white hover:bg-white/5'}`}
            >
              Resume ATS Analyzer
            </Link>
            <Link 
              to="/#pricing"
              onClick={(e) => { 
                setIsMobileMenuOpen(false);
                const element = document.getElementById('pricing');
                if (element) {
                  e.preventDefault();
                  element.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="w-full text-left font-body-md text-xs py-3 px-4 rounded-xl border-none bg-transparent cursor-pointer transition-colors text-on-surface-variant hover:text-white hover:bg-white/5"
            >
              Pricing
            </Link>
            <Link 
              to="/contact"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`w-full text-left font-body-md text-xs py-3 px-4 rounded-xl border-none bg-transparent cursor-pointer transition-colors ${activeTab === "contact" ? 'text-[#b4c5ff] font-bold bg-[#b4c5ff]/10 border border-[#b4c5ff]/20' : 'text-on-surface-variant hover:text-white hover:bg-white/5'}`}
            >
              Contact
            </Link>
            
            {/* Mobile Auth Actions */}
            <div className="border-t border-white/10 my-2 pt-2 flex flex-col gap-2">
              {isLoggedIn ? (
                <button className="w-full btn-primary py-3 text-xs font-bold rounded-xl" onClick={() => { handleSignOut(); setIsMobileMenuOpen(false); }}>Sign Out</button>
              ) : (
                <>
                  <button className="w-full btn-secondary py-3 text-xs font-bold rounded-xl" onClick={() => { navigate('/login'); setIsMobileMenuOpen(false); }}>Sign In</button>
                  <button className="w-full btn-primary py-3 text-xs font-bold rounded-xl" onClick={() => { navigate('/signup'); setIsMobileMenuOpen(false); }}>Get Started</button>
                </>
              )}
            </div>

            {/* Mobile Theme Toggle */}
            <div className="border-t border-white/10 my-2 pt-2 flex flex-col gap-2">
              <button
                onClick={() => { toggleTheme(); }}
                className="w-full py-3 px-4 rounded-xl border border-primary/20 bg-primary/5 text-primary text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                </span>
                <span>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
