import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardNavbar from '../components/DashboardNavbar';
import Footer from '../components/Footer';
import Chatbot from '../components/Chatbot';

export default function Billing() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('billing'); // 'billing' | 'bookings' | 'profile' | 'preferences'
  const [currentPlan, setCurrentPlan] = useState('Pro Plus'); // 'Basic' | 'Pro' | 'Pro Plus'
  const [selectedMentor, setSelectedMentor] = useState('clara'); // 'clara' | 'sarah' | 'devore'
  const [selectedSlot, setSelectedSlot] = useState('slot-1'); // 'slot-1' | 'slot-2' | 'slot-3'
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [simulatedRzp, setSimulatedRzp] = useState(null);

  // Profile Form States
  const [profileName, setProfileName] = useState(sessionStorage.getItem('userName') || '');
  const [profileEmail, setProfileEmail] = useState(sessionStorage.getItem('userEmail') || '');
  const [profileDomain, setProfileDomain] = useState(sessionStorage.getItem('userDomain') || 'swe');
  const [profileExperience, setProfileExperience] = useState(sessionStorage.getItem('userExperience') || '0 Yrs');
  const [profileEducation, setProfileEducation] = useState(sessionStorage.getItem('userEducation') || '');
  const [profileDreamCompany, setProfileDreamCompany] = useState(sessionStorage.getItem('userTargetCompany') || '');
  const [profileLinkedIn, setProfileLinkedIn] = useState(sessionStorage.getItem('userLinkedIn') || '');
  const [profileGitHub, setProfileGitHub] = useState(sessionStorage.getItem('userGitHub') || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Preference Form States
  const [prefDifficulty, setPrefDifficulty] = useState(localStorage.getItem('intervflow_pref_difficulty') || 'adaptive');
  const [prefStyle, setPrefStyle] = useState(localStorage.getItem('intervflow_pref_style') || 'standard');
  const [prefTheme, setPrefTheme] = useState(localStorage.getItem('intervflow_pref_theme') || 'dark');
  const [prefLanguage, setPrefLanguage] = useState(localStorage.getItem('intervflow_pref_language') || 'python');
  const [prefEmailReminders, setPrefEmailReminders] = useState(localStorage.getItem('intervflow_pref_email_reminders') !== 'false');
  const [prefWeeklyTips, setPrefWeeklyTips] = useState(localStorage.getItem('intervflow_pref_weekly_tips') !== 'false');

  // Account Deletion States
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Pre-loaded schedule records
  const [scheduledSessions, setScheduledSessions] = useState([
    {
      id: 'sess-1',
      title: 'L6 Systems Mock — Clara Lin',
      meta: 'Wednesday, Jun 3 at 5:30 PM (Google Meet Session)',
      status: 'Live Rec Setup',
      mentorName: 'Clara Lin',
      mentorInitials: 'MC',
      mentorColor: 'from-red-600 to-red-800',
      isCompleted: false,
    },
    {
      id: 'sess-2',
      title: 'STAR Behavioral Mock — Sarah Jenkins',
      meta: 'Monday, May 25 at 3:00 PM (L6 Leadership Alignment)',
      status: 'Completed',
      mentorName: 'Sarah Jenkins',
      mentorInitials: 'MS',
      mentorColor: 'from-amber-600 to-amber-800',
      isCompleted: true,
    }
  ]);

  const [plans, setPlans] = useState({
    Basic: { price: 0, jobApplicationsLimit: 3, aiMocksLimit: 3 },
    Pro: { price: 299, jobApplicationsLimit: 15, aiMocksLimit: 15 },
    ProPlus: { price: 999, jobApplicationsLimit: 99999, aiMocksLimit: 99999 }
  });
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [userRecord, setUserRecord] = useState(null);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    setLoadingPlans(true);
    const email = sessionStorage.getItem('userEmail');
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      const plansRes = await fetch(`${API_URL}/api/billing/plans`);
      const plansData = await plansRes.json();
      if (plansData.success) {
        setPlans(plansData.plans);
      }

      if (email) {
        const userRes = await fetch(`${API_URL}/api/user/profile?email=${encodeURIComponent(email)}`);
        const userData = await userRes.json();
        if (userData.success) {
          setUserRecord(userData.user);
          setCurrentPlan((userData.user.subscription && userData.user.subscription.plan) || 'Basic');
        }
      }
    } catch (err) {
      console.error("Error loading billing details:", err);
    } finally {
      setLoadingPlans(false);
    }
  };

  // Set active tab based on window hash or location state
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#profile' || location.state?.activeTab === 'profile') {
      setActiveTab('profile');
    } else if (hash === '#preferences' || location.state?.activeTab === 'preferences') {
      setActiveTab('preferences');
    } else {
      setActiveTab('billing');
    }
  }, [location]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim()) {
      alert("Name cannot be empty.");
      return;
    }
    setIsSavingProfile(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/user/profile/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: profileEmail,
          name: profileName,
          domain: profileDomain,
          experienceYears: profileExperience,
          highestEducation: profileEducation,
          dreamCompany: profileDreamCompany,
          linkedinUrl: profileLinkedIn,
          githubUrl: profileGitHub
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        sessionStorage.setItem('userName', data.user.name);
        sessionStorage.setItem('userDomain', data.user.domain);
        sessionStorage.setItem('userExperience', data.user.experienceYears || '');
        sessionStorage.setItem('userEducation', data.user.highestEducation || '');
        sessionStorage.setItem('userTargetCompany', data.user.dreamCompany || '');
        sessionStorage.setItem('userLinkedIn', data.user.linkedinUrl || '');
        sessionStorage.setItem('userGitHub', data.user.githubUrl || '');
        
        showToast("Profile settings updated successfully!");
      } else {
        alert(data.error || "Failed to update profile settings.");
      }
    } catch (err) {
      console.error(err);
      alert("Error occurred while saving profile settings.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePreferences = () => {
    localStorage.setItem('intervflow_pref_difficulty', prefDifficulty);
    localStorage.setItem('intervflow_pref_style', prefStyle);
    localStorage.setItem('intervflow_pref_theme', prefTheme);
    localStorage.setItem('intervflow_pref_language', prefLanguage);
    localStorage.setItem('intervflow_pref_email_reminders', String(prefEmailReminders));
    localStorage.setItem('intervflow_pref_weekly_tips', String(prefWeeklyTips));
    
    showToast("Preferences saved successfully!");
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setIsDeletingAccount(true);
    try {
      const email = sessionStorage.getItem('userEmail');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/user/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Account and data permanently deleted.");
        sessionStorage.clear();
        localStorage.clear();
        setTimeout(() => {
          navigate('/');
        }, 1500);
      } else {
        alert(data.error || "Failed to delete account.");
      }
    } catch (err) {
      console.error(err);
      alert("Error occurred while deleting account.");
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    }
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleUpgrade = async (planName) => {
    if (planName === 'Basic') {
      if (!window.confirm("Are you sure you want to downgrade to the Basic plan? Your credits will be reset to Basic limits.")) return;
      
      const email = sessionStorage.getItem('userEmail');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      try {
        const res = await fetch(`${API_URL}/api/billing/verify-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            planName: 'Basic',
            razorpayOrderId: `cancel_${Date.now()}`,
            razorpayPaymentId: `cancel_pay_${Date.now()}`
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast("Successfully downgraded plan to Basic!");
          fetchBillingData();
        }
      } catch (err) {
        console.error(err);
        alert("Failed to cancel subscription.");
      }
      return;
    }

    const email = sessionStorage.getItem('userEmail');
    if (!email) {
      alert("Please log in to upgrade your subscription plan.");
      navigate('/signin');
      return;
    }

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      const orderRes = await fetch(`${API_URL}/api/billing/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planName })
      });
      const orderData = await orderRes.json();
      if (!orderData.success) {
        alert(orderData.error || "Failed to create checkout order.");
        return;
      }

      if (orderData.keyId === "rzp_test_mock_keys") {
        setSimulatedRzp({
          planName,
          orderId: orderData.orderId,
          amount: orderData.amount,
          keyId: orderData.keyId,
          handler: async function (response) {
            try {
              const verifyRes = await fetch(`${API_URL}/api/billing/verify-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email,
                  planName,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature
                })
              });
              const verifyData = await verifyRes.json();
              if (verifyData.success) {
                showToast(`Congratulations! You have successfully upgraded to ${planName}!`);
                fetchBillingData();
              } else {
                alert(verifyData.error || "Payment verification failed.");
              }
            } catch (verifyErr) {
              console.error("Signature verification request failed:", verifyErr);
              alert("Error verifying payment signature. Please contact support.");
            }
          }
        });
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        alert("Razorpay payment gateway failed to load. Please check your network connection.");
        return;
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "IntervFlow AI",
        description: `${planName} Subscription Purchase`,
        order_id: orderData.orderId,
        handler: async function (response) {
          try {
            const verifyRes = await fetch(`${API_URL}/api/billing/verify-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email,
                planName,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              showToast(`Congratulations! You have successfully upgraded to ${planName}!`);
              fetchBillingData();
            } else {
              alert(verifyData.error || "Payment verification failed.");
            }
          } catch (verifyErr) {
            console.error("Signature verification request failed:", verifyErr);
            alert("Error verifying payment signature. Please contact support.");
          }
        },
        prefill: {
          name: sessionStorage.getItem('userName') || '',
          email: email
        },
        theme: {
          color: "#818cf8"
        }
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.open();
    } catch (err) {
      console.error("Upgrade trigger failed:", err);
      alert("Error initializing checkout pipeline.");
    }
  };

  const handleConfirmAllocation = () => {
    // Add a new session dynamically
    const mentorInfo = mentors[selectedMentor];
    const slotInfo = slots[selectedMentor].find(s => s.id === selectedSlot);

    if (!slotInfo) return;

    const newSession = {
      id: `sess_${Date.now()}`,
      title: `${mentorInfo.roleFocus} Mock — ${mentorInfo.name}`,
      meta: `${slotInfo.time} (Google Meet Session)`,
      status: 'Live Rec Setup',
      mentorName: mentorInfo.name,
      mentorInitials: mentorInfo.initials,
      mentorColor: selectedMentor === 'clara' ? 'from-red-600 to-red-800' : selectedMentor === 'sarah' ? 'from-amber-600 to-amber-800' : 'from-blue-600 to-blue-800',
      isCompleted: false,
    };

    setScheduledSessions([newSession, ...scheduledSessions]);
    setShowSuccessModal(true);
  };

  const mentors = {
    clara: {
      name: 'Clara Lin',
      title: 'L6 Support Lead',
      roleFocus: 'L6 Systems Mock',
      company: 'NoSQL & Infra Lead at Stripe',
      rating: '⭐ 4.90',
      bio: 'Specialist in large-scale DynamoDB pipelines, consistent hashing partition mappings, and team alignment metrics.',
      initials: 'MC',
    },
    sarah: {
      name: 'Sarah Jenkins',
      title: 'ML Systems Lead',
      roleFocus: 'STAR Behavioral Mock',
      company: 'Principal ML Pipelines Architect at Razorpay',
      rating: '⭐ 4.95',
      bio: 'Specialist in distributed ML ingest feature store partitioning and STAR behavioral scaling strategies.',
      initials: 'MS',
    },
    devore: {
      name: 'Devore Chen',
      title: 'L6 Frontend',
      roleFocus: 'L6 Frontend Mock',
      company: 'Senior Fullstack Lead at Google',
      rating: '⭐ 4.92',
      bio: 'Specialist in highly responsive frontend layouts, interactive dashboard views, and mock screener calibrations.',
      initials: 'DC',
    }
  };

  const slots = {
    clara: [
      { id: 'slot-1', time: 'Wednesday, Jun 3 — 5:30 PM', label: 'Fast Match' },
      { id: 'slot-2', time: 'Friday, Jun 5 — 10:00 AM', label: 'Standard' },
      { id: 'slot-3', time: 'Saturday, Jun 6 — 2:00 PM', label: 'Standard' },
    ],
    sarah: [
      { id: 'slot-1', time: 'Monday, Jun 8 — 11:30 AM', label: 'Fast Match' },
      { id: 'slot-2', time: 'Wednesday, Jun 10 — 4:00 PM', label: 'Standard' },
      { id: 'slot-3', time: 'Thursday, Jun 11 — 1:00 PM', label: 'Standard' },
    ],
    devore: [
      { id: 'slot-1', time: 'Tuesday, Jun 9 — 2:30 PM', label: 'Fast Match' },
      { id: 'slot-2', time: 'Friday, Jun 12 — 9:00 AM', label: 'Standard' },
      { id: 'slot-3', time: 'Saturday, Jun 13 — 6:00 PM', label: 'Standard' },
    ]
  };

  return (
    <div className="bg-[#09090b] text-[#e5e1e4] min-h-screen flex flex-col pt-16 relative overflow-x-hidden font-body-md">
      <div className="bg-glow"></div>
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 glass-panel border border-[#818cf8]/40 bg-[#1e1b4b]/90 px-6 py-3.5 rounded-2xl flex items-center gap-2 shadow-[0_0_30px_rgba(129,140,248,0.3)] animate-bounce">
          <span className="material-symbols-outlined text-primary text-xl">verified</span>
          <span className="text-xs text-white font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Nav */}
      <DashboardNavbar activeTab="booking" />

      <div className="flex flex-1 w-full max-w-[1400px] mx-auto px-margin-mobile md:px-margin-desktop py-10 z-10 gap-8">
        
        {/* Sidebar settings tab */}
        <aside className="w-64 hidden md:flex flex-col py-6 border-r border-white/5 pr-4 select-none shrink-0 text-left">
          <div className="mb-6">
            <span className="text-[10px] font-mono tracking-widest text-outline uppercase">Settings</span>
          </div>
          <nav className="flex flex-col gap-1">
            <button 
              onClick={() => { setActiveTab('profile'); navigate('/billing#profile'); }}
              className={`flex items-center gap-3 w-full text-left px-4 py-3 transition-all border-none cursor-pointer rounded-xl bg-transparent ${
                activeTab === 'profile' ? 'text-primary font-bold bg-white/5 border-r-2 border-primary' : 'text-on-surface-variant hover:text-primary hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">person</span>
              <span className="text-sm font-medium">Profile</span>
            </button>
            <button 
              onClick={() => { setActiveTab('preferences'); navigate('/billing#preferences'); }}
              className={`flex items-center gap-3 w-full text-left px-4 py-3 transition-all border-none cursor-pointer rounded-xl bg-transparent ${
                activeTab === 'preferences' ? 'text-primary font-bold bg-white/5 border-r-2 border-primary' : 'text-on-surface-variant hover:text-primary hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">settings</span>
              <span className="text-sm font-medium">Preferences</span>
            </button>
            {/* Bookings tab removed */}
            <button 
              onClick={() => { setActiveTab('billing'); navigate('/billing'); }}
              className={`flex items-center gap-3 w-full text-left px-4 py-3 transition-all border-none cursor-pointer rounded-xl ${
                activeTab === 'billing' ? 'text-primary font-bold bg-white/5 border-r-2 border-primary' : 'text-on-surface-variant hover:text-primary hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
              <span className="text-sm font-medium">Billing</span>
            </button>
          </nav>
          
          <div className="mt-auto pt-6 flex flex-col gap-4">
            <div className="glass-card p-4 rounded-xl">
              <p className="text-[9px] font-mono text-outline mb-2">JOB APPLICATIONS</p>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-2">
                <div 
                  className="h-full bg-primary transition-all duration-500" 
                  style={{ width: `${userRecord?.credits?.jobApplicationsLimit >= 9999 ? 100 : Math.min(100, ((userRecord?.credits?.jobApplicationsUsed || 0) / (userRecord?.credits?.jobApplicationsLimit || 3)) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] font-mono text-on-surface">
                {userRecord?.credits?.jobApplicationsUsed || 0} / {userRecord?.credits?.jobApplicationsLimit >= 9999 ? 'Unlimited' : userRecord?.credits?.jobApplicationsLimit || 3} Used
              </p>
            </div>

            <div className="glass-card p-4 rounded-xl">
              <p className="text-[9px] font-mono text-outline mb-2">ATS RESUME REVIEWS</p>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-2">
                <div 
                  className="h-full bg-secondary transition-all duration-500" 
                  style={{ width: `${userRecord?.credits?.atsAnalysesLimit >= 9999 ? 100 : Math.min(100, ((userRecord?.credits?.atsAnalysesUsed || 0) / (userRecord?.credits?.atsAnalysesLimit || 3)) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] font-mono text-on-surface">
                {userRecord?.credits?.atsAnalysesUsed || 0} / {userRecord?.credits?.atsAnalysesLimit >= 9999 ? 'Unlimited' : userRecord?.credits?.atsAnalysesLimit || 3} Used
              </p>
            </div>
          </div>
        </aside>

        {/* Main Panel Area */}
        <main className="flex-grow max-w-5xl text-left">
          
          {/* TAB 1: BILLING PANEL */}
          {activeTab === 'billing' && (
            <div className="space-y-10 animate-fade-in">
              {/* Hero header */}
              <section>
                <div className="glass-card p-8 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6 border border-white/8">
                  <div className="flex items-center gap-6 text-left">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                      <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    </div>
                    <div>
                      <h1 className="text-xl md:text-2xl text-on-surface font-bold">{currentPlan} Plan — Active</h1>
                      <p className="text-xs text-on-surface-variant mt-1">
                        {currentPlan === 'Basic' ? 'Lifetime free tier. Upgrade to access FAANG mentor sessions.' : 'Your premium subscription renews on January 14, 2025.'}
                      </p>
                    </div>
                  </div>
                  {currentPlan !== 'Basic' ? (
                    <button 
                      onClick={() => handleUpgrade('Basic')}
                      className="bg-white/5 border border-white/10 hover:bg-white/10 text-on-surface text-xs font-semibold px-6 py-2.5 rounded-xl transition-all cursor-pointer"
                    >
                      Cancel Subscription
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleUpgrade('Pro Plus')}
                      className="btn-primary text-xs font-bold px-6 py-2.5 cursor-pointer shadow-lg"
                    >
                      Activate Pro Plus
                    </button>
                  )}
                </div>
              </section>

              {/* Usage Metrics */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card p-6 rounded-xl border border-white/5 text-left">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-mono text-outline">AI MOCK INTERVIEWS</span>
                    <span className="text-[10px] font-mono text-primary font-bold">
                      {userRecord?.credits?.aiMocksUsed || 0} / {userRecord?.credits?.aiMocksLimit >= 9999 ? 'Unlimited' : userRecord?.credits?.aiMocksLimit || 3} Sessions
                    </span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-1000"
                      style={{ width: `${userRecord?.credits?.aiMocksLimit >= 9999 ? 100 : Math.min(100, ((userRecord?.credits?.aiMocksUsed || 0) / (userRecord?.credits?.aiMocksLimit || 3)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="glass-card p-6 rounded-xl border border-white/5 text-left">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-mono text-outline">ATS RESUME REVIEWS</span>
                    <span className="text-[10px] font-mono text-secondary font-bold">
                      {userRecord?.credits?.atsAnalysesUsed || 0} / {userRecord?.credits?.atsAnalysesLimit >= 9999 ? 'Unlimited' : userRecord?.credits?.atsAnalysesLimit || 3} Reviews
                    </span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-secondary transition-all duration-1000"
                      style={{ width: `${userRecord?.credits?.atsAnalysesLimit >= 9999 ? 100 : Math.min(100, ((userRecord?.credits?.atsAnalysesUsed || 0) / (userRecord?.credits?.atsAnalysesLimit || 3)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </section>

              {/* Available Plans */}
              <section>
                <h2 className="text-lg md:text-xl font-bold mb-6 text-on-surface">Available Plans</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Basic */}
                  <div className={`glass-card p-6 rounded-xl flex flex-col border transition-all ${
                    currentPlan === 'Basic' ? 'border-primary bg-primary/5' : 'border-white/5 bg-white/[0.02]'
                  }`}>
                    <div className="mb-6">
                      <span className="text-[10px] font-mono text-outline">BASIC</span>
                      <div className="flex items-baseline mt-2">
                        <span className="text-2xl font-bold font-headline-md">₹0</span>
                        <span className="text-on-surface-variant text-xs font-mono ml-1">/ lifetime</span>
                      </div>
                    </div>
                    <ul className="space-y-3.5 mb-6 flex-grow text-xs text-on-surface-variant">
                      <li className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                        <span>3 ATS Resume Analyses</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                        <span>3 AI Mock Interviews</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                        <span>Apply to 3 Jobs / month</span>
                      </li>
                    </ul>
                    {currentPlan === 'Basic' ? (
                      <button className="w-full py-2.5 rounded-xl border border-white/10 text-on-surface-variant bg-white/5 cursor-not-allowed text-xs font-bold">Current Plan</button>
                    ) : (
                      <button 
                        onClick={() => handleUpgrade('Basic')}
                        className="w-full py-2.5 rounded-xl border border-white/10 text-on-surface hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-xs font-bold cursor-pointer"
                      >
                        Downgrade to Basic
                      </button>
                    )}
                  </div>

                  {/* Pro */}
                  <div className={`glass-card p-6 rounded-xl flex flex-col border relative overflow-hidden transition-all ${
                    currentPlan === 'Pro' ? 'border-primary bg-primary/5 shadow-[0_0_20px_rgba(129,140,248,0.15)]' : 'border-white/10 bg-white/[0.02]'
                  }`}>
                    <div className="absolute top-3 right-3 bg-indigo-50 dark:bg-primary/25 text-indigo-900 dark:text-[#b4c5ff] px-2 py-0.5 rounded text-[8px] border border-indigo-200 dark:border-primary/30 font-bold uppercase">
                      {plans.Pro.jobApplicationsLimit >= 9999 ? 'Unlimited' : `${plans.Pro.jobApplicationsLimit} Applications`}
                    </div>
                    <div className="mb-6">
                      <span className="text-[10px] font-mono text-primary">PRO</span>
                      <div className="flex items-baseline mt-2">
                        <span className="text-2xl font-bold font-headline-md">₹{plans.Pro.price}</span>
                        <span className="text-on-surface-variant text-xs font-mono ml-1">/ month</span>
                      </div>
                    </div>
                    <ul className="space-y-3.5 mb-6 flex-grow text-xs text-on-surface">
                      <li className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                        <span>{plans.Pro.atsAnalysesLimit || 10} ATS Resume Reviews</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                        <span>{plans.Pro.aiMocksLimit || 15} AI Mock Interviews</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                        <span>Apply to {plans.Pro.jobApplicationsLimit || 15} Jobs / month</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                        <span>24/7 AI Doubt Tutor</span>
                      </li>
                    </ul>
                    {currentPlan === 'Pro' ? (
                      <button className="w-full py-2.5 rounded-xl border border-white/10 text-on-surface-variant bg-white/5 cursor-not-allowed text-xs font-bold">Current Plan</button>
                    ) : (
                      <button 
                        onClick={() => handleUpgrade('Pro')}
                        className="w-full py-2.5 rounded-xl btn-primary text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-lg cursor-pointer"
                      >
                        Upgrade to Pro
                      </button>
                    )}
                  </div>

                  {/* Pro Plus */}
                  <div className={`glass-card p-6 rounded-xl flex flex-col border relative overflow-hidden transition-all ${
                    currentPlan === 'Pro Plus' ? 'border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'border-white/10 bg-white/[0.02]'
                  }`}>
                    <div className="absolute top-3 right-3 bg-emerald-55 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded text-[8px] border border-emerald-22 dark:border-emerald-500/30 font-bold uppercase">
                      {plans.ProPlus.jobApplicationsLimit >= 9999 ? 'Unlimited' : `${plans.ProPlus.jobApplicationsLimit} Applications`}
                    </div>
                    <div className="mb-6">
                      <span className="text-[10px] font-mono text-emerald-800 dark:text-emerald-400 font-bold">PRO PLUS</span>
                      <div className="flex items-baseline mt-2">
                        <span className="text-2xl font-bold font-headline-md">₹{plans.ProPlus.price}</span>
                        <span className="text-on-surface-variant text-xs font-mono ml-1">/ month</span>
                      </div>
                    </div>
                    <ul className="space-y-3.5 mb-6 flex-grow text-xs text-on-surface">
                      <li className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
                        <span>{plans.ProPlus.atsAnalysesLimit >= 9999 ? <strong>Unlimited</strong> : <strong>{plans.ProPlus.atsAnalysesLimit}</strong>} ATS Evaluations</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
                        <span>{plans.ProPlus.aiMocksLimit >= 9999 ? <strong>Unlimited</strong> : <strong>{plans.ProPlus.aiMocksLimit}</strong>} AI Mock sessions</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
                        <span>{plans.ProPlus.jobApplicationsLimit >= 9999 ? <strong>Unlimited</strong> : <strong>{plans.ProPlus.jobApplicationsLimit}</strong>} Job Applications</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
                        <span>Priority recruiter matching</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
                        <span>24/7 AI Doubt Tutor</span>
                      </li>
                    </ul>
                    {currentPlan === 'Pro Plus' ? (
                      <button className="w-full py-2.5 rounded-xl border border-white/10 text-on-surface-variant bg-white/5 cursor-not-allowed text-xs font-bold">Current Plan</button>
                    ) : (
                      <button 
                        onClick={() => handleUpgrade('Pro Plus')}
                        className="w-full py-2.5 rounded-xl btn-primary text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-lg cursor-pointer"
                      >
                        Upgrade to Pro Plus
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {/* Payment Methods */}
              <section>
                <h2 className="text-lg font-bold mb-4 text-on-surface">Payment Method</h2>
                <div className="glass-card p-6 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4 border border-white/5 bg-white/[0.01]">
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-12 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <div className="flex gap-1">
                        <div className="w-3.5 h-3.5 rounded-full bg-red-500/80"></div>
                        <div className="w-3.5 h-3.5 rounded-full bg-orange-500/80 -ml-2"></div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-on-surface">Visa ending in 4242 (Stripe Sandbox Active)</p>
                      <p className="text-[10px] font-mono text-outline mt-0.5">Stripe Mock: 4242 4242 4242 4242</p>
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <button onClick={() => alert("Simulation: Stripe Sandbox billing updates are handled automatically.")} className="text-primary hover:underline font-mono bg-transparent border-none cursor-pointer">Update</button>
                    <span className="text-white/10">|</span>
                    <button onClick={() => alert("Simulation: Payment method remains linked to simulator accounts.")} className="text-on-surface-variant hover:text-white font-mono bg-transparent border-none cursor-pointer">Remove</button>
                  </div>
                </div>
              </section>

              {/* Billing History */}
              <section>
                <h2 className="text-lg font-bold mb-4 text-on-surface">Billing History</h2>
                <div className="glass-card rounded-xl overflow-hidden border border-white/5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/5 font-mono uppercase text-[10px] text-slate-600 dark:text-white bg-slate-100 dark:bg-white/5">
                          <th className="px-6 py-4">DATE</th>
                          <th className="px-6 py-4">DESCRIPTION</th>
                          <th className="px-6 py-4">AMOUNT</th>
                          <th className="px-6 py-4">STATUS</th>
                          <th className="px-6 py-4 text-right">RECEIPT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-on-surface-variant">
                        <tr className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4 font-mono">Jun 14, 2026</td>
                          <td className="px-6 py-4 font-medium text-on-surface">Pro Plus Subscription — Monthly</td>
                          <td className="px-6 py-4 font-mono">₹999.00</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-mono border border-emerald-500/20">Success</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => showToast("Downloading receipt invoice_jun2026.pdf...")} className="material-symbols-outlined text-[18px] text-on-surface-variant hover:text-primary transition-colors bg-transparent border-none cursor-pointer">download</button>
                          </td>
                        </tr>
                        <tr className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4 font-mono">May 14, 2026</td>
                          <td className="px-6 py-4 font-medium text-on-surface">Pro Plus Subscription — Monthly</td>
                          <td className="px-6 py-4 font-mono">₹999.00</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-mono border border-emerald-500/20">Success</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => showToast("Downloading receipt invoice_may2026.pdf...")} className="material-symbols-outlined text-[18px] text-on-surface-variant hover:text-primary transition-colors bg-transparent border-none cursor-pointer">download</button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB 2: BOOKINGS PANEL (REMOVED) */}

          {/* TAB 3: PROFILE PANEL */}
          {activeTab === 'profile' && (
            <div className="space-y-10 animate-fade-in text-left">
              <section className="glass-panel p-6 md:p-8 rounded-2xl border border-white/5 bg-white/[0.01]">
                <div className="border-b border-white/10 pb-4 mb-6">
                  <h2 className="text-lg md:text-xl font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-xl">person</span>
                    Profile Settings
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-1 font-body-md">
                    Update your target interview roles, experience levels, and contact handles. These changes will reflect in your mock simulations and global leaderboard standings.
                  </p>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-mono text-outline uppercase tracking-wider">Full Name</label>
                      <input 
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="Your Name"
                        className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary font-body-md animate-fade-in"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-mono text-outline uppercase tracking-wider flex items-center gap-1">
                        Email Address <span className="material-symbols-outlined text-[10px] text-on-surface-variant">lock</span>
                      </label>
                      <input 
                        type="text"
                        value={profileEmail}
                        disabled
                        className="bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-on-surface-variant cursor-not-allowed font-body-md"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-mono text-outline uppercase tracking-wider">Target Domain</label>
                      <select 
                        value={profileDomain}
                        onChange={(e) => setProfileDomain(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary font-body-md cursor-pointer"
                      >
                        <option value="swe">Software Engineering</option>
                        <option value="backend">Backend Engineering</option>
                        <option value="frontend">Frontend Engineering</option>
                        <option value="fullstack">Fullstack Engineering</option>
                        <option value="pm">Product Management</option>
                        <option value="devops">DevOps Engineering</option>
                        <option value="ml">Machine Learning Engineering</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-mono text-outline uppercase tracking-wider">Experience Level</label>
                      <select 
                        value={profileExperience}
                        onChange={(e) => setProfileExperience(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary font-body-md cursor-pointer"
                      >
                        <option value="0 Yrs">Entry Level (0-1 yrs)</option>
                        <option value="2.5 Yrs">Mid Level (2-4 yrs)</option>
                        <option value="5.5 Yrs">Senior Level (5+ yrs)</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-mono text-outline uppercase tracking-wider">Highest Education</label>
                      <input 
                        type="text"
                        value={profileEducation}
                        onChange={(e) => setProfileEducation(e.target.value)}
                        placeholder="e.g. B.Tech. Computer Science"
                        className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary font-body-md"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-mono text-outline uppercase tracking-wider">Dream Company</label>
                      <input 
                        type="text"
                        value={profileDreamCompany}
                        onChange={(e) => setProfileDreamCompany(e.target.value)}
                        placeholder="e.g. Google, Stripe"
                        className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary font-body-md"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-mono text-outline uppercase tracking-wider">LinkedIn Profile URL</label>
                      <input 
                        type="url"
                        value={profileLinkedIn}
                        onChange={(e) => setProfileLinkedIn(e.target.value)}
                        placeholder="e.g. https://linkedin.com/in/username"
                        className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary font-body-md"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-mono text-outline uppercase tracking-wider">GitHub Profile URL</label>
                      <input 
                        type="url"
                        value={profileGitHub}
                        onChange={(e) => setProfileGitHub(e.target.value)}
                        placeholder="e.g. https://github.com/username"
                        className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary font-body-md"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button 
                      type="submit"
                      disabled={isSavingProfile}
                      className="px-6 py-2.5 glow-button text-white font-bold text-xs border-none cursor-pointer flex items-center gap-2"
                    >
                      {isSavingProfile ? (
                        <>
                          <span className="material-symbols-outlined text-base animate-spin">sync</span>
                          Saving Changes...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-base">save</span>
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </section>

              {/* Danger Zone */}
              <section className="glass-panel p-6 md:p-8 rounded-2xl border border-red-500/20 bg-red-500/[0.01]">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="text-left">
                    <h3 className="text-sm font-bold text-red-400 flex items-center gap-1.5 font-headline-md">
                      <span className="material-symbols-outlined text-base text-red-500">warning</span>
                      Danger Zone
                    </h3>
                    <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed font-body-md">
                      Permanently delete your IntervFlow account and all associated mock interview histories, stats, and files. This action is irreversible.
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 hover:text-red-300 rounded-xl px-5 py-2.5 transition-all text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Delete Account
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* TAB 4: PREFERENCES PANEL */}
          {activeTab === 'preferences' && (
            <div className="space-y-10 animate-fade-in text-left">
              <section className="glass-panel p-6 md:p-8 rounded-2xl border border-white/5 bg-white/[0.01]">
                <div className="border-b border-white/10 pb-4 mb-6">
                  <h2 className="text-lg md:text-xl font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-xl">settings</span>
                    System Preferences
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-1 font-body-md">
                    Calibrate your AI interview difficulty levels, compiler themes, and notifications preferences.
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-mono text-outline uppercase tracking-wider">Prep Challenge Difficulty</label>
                      <select 
                        value={prefDifficulty}
                        onChange={(e) => setPrefDifficulty(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary font-body-md cursor-pointer"
                      >
                        <option value="easy">Easy (Fundamentals)</option>
                        <option value="medium">Medium (Standard LeetCode / Behavioral)</option>
                        <option value="hard">Hard (Advanced Staff / Systems Architect)</option>
                        <option value="adaptive">Adaptive Calibration (Recommended)</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-mono text-outline uppercase tracking-wider">AI Interviewer Tone Persona</label>
                      <select 
                        value={prefStyle}
                        onChange={(e) => setPrefStyle(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary font-body-md cursor-pointer"
                      >
                        <option value="friendly">Friendly &amp; Encouraging</option>
                        <option value="standard">Standard Technical Auditor (Objective)</option>
                        <option value="stress">High-Pressure Stress Simulation (FAANG Bar-Raiser)</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-mono text-outline uppercase tracking-wider">Workspace Code Editor Theme</label>
                      <select 
                        value={prefTheme}
                        onChange={(e) => setPrefTheme(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary font-body-md cursor-pointer"
                      >
                        <option value="dark">Dark / VSCode Classic</option>
                        <option value="monokai">Monokai Pro (High Contrast)</option>
                        <option value="light">Light Classic</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-mono text-outline uppercase tracking-wider">Default Programming Language</label>
                      <select 
                        value={prefLanguage}
                        onChange={(e) => setPrefLanguage(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary font-body-md cursor-pointer"
                      >
                        <option value="python">Python</option>
                        <option value="javascript">JavaScript (ES6)</option>
                        <option value="cpp">C++ (GCC 11)</option>
                        <option value="java">Java (JDK 17)</option>
                        <option value="go">Go (1.20)</option>
                      </select>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-5 space-y-4">
                    <span className="text-[10px] font-mono text-outline uppercase tracking-wider block">Notification Reminders</span>
                    <div className="space-y-3">
                      <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={prefEmailReminders}
                          onChange={(e) => setPrefEmailReminders(e.target.checked)}
                          className="mt-1 accent-primary rounded cursor-pointer w-4 h-4 shrink-0"
                        />
                        <div className="text-left">
                          <span className="text-xs text-on-surface font-medium block">Session Indicators</span>
                          <span className="text-[10px] text-on-surface-variant block mt-0.5 font-body-md">Receive session start indicators and calendar links via email.</span>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={prefWeeklyTips}
                          onChange={(e) => setPrefWeeklyTips(e.target.checked)}
                          className="mt-1 accent-primary rounded cursor-pointer w-4 h-4 shrink-0"
                        />
                        <div className="text-left">
                          <span className="text-xs text-on-surface font-medium block">Weekly Challenges Digest</span>
                          <span className="text-[10px] text-on-surface-variant block mt-0.5 font-body-md">Subscribe to weekly coding practice challenges and mock feedback collections.</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-white/5">
                    <button 
                      onClick={handleSavePreferences}
                      className="px-6 py-2.5 glow-button text-white font-bold text-xs border-none cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-base">save</span>
                      Save Preferences
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

        </main>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-sm w-full p-6 rounded-3xl border border-emerald-500/30 bg-[#09090b] text-center shadow-[0_0_50px_rgba(16,185,129,0.15)]">
            <span className="material-symbols-outlined text-5xl text-emerald-400 mb-3 bg-emerald-500/10 p-3 rounded-full inline-block">check_circle</span>
            <h3 className="text-white font-bold text-base mb-1">Mentor Session Confirmed!</h3>
            <p className="text-[11px] text-on-surface-variant leading-relaxed mb-4">
              Your FAANG mock simulation has been successfully locked in. A low-latency Google Meet invite has been scheduled and added to your calendar slots.
            </p>
            <button 
              onClick={() => { setShowSuccessModal(false); setActiveTab('bookings'); }}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer border-none transition-colors"
            >
              Return to Bookings
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in text-left">
          <div className="glass-card max-w-md w-full p-6 rounded-3xl border border-red-500/30 bg-[#09090b] shadow-[0_0_50px_rgba(239,68,68,0.15)]">
            <div className="flex items-center gap-3 mb-3 text-red-500">
              <span className="material-symbols-outlined text-4xl bg-red-500/10 p-2.5 rounded-full">warning</span>
              <div>
                <h3 className="text-white font-bold text-base">Delete Account Permanently?</h3>
                <p className="text-[9px] font-mono text-red-400">IRREVERSIBLE DATA PURGING</p>
              </div>
            </div>
            
            <p className="text-[11px] text-on-surface-variant leading-relaxed mb-4 font-body-md">
              Are you absolutely sure you want to delete your account? This will permanently erase your profile, XP status, mock interview session histories, and shared community posts. **This action is irreversible.**
            </p>
            
            <div className="mb-4">
              <label className="text-[10px] font-mono text-outline block mb-2">TYPE <strong className="text-white">DELETE</strong> TO CONFIRM:</label>
              <input 
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE here..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-red-500 font-body-md"
              />
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button 
                disabled={deleteConfirmText !== 'DELETE' || isDeletingAccount}
                onClick={handleDeleteAccount}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs cursor-pointer border-none transition-colors ${
                  deleteConfirmText === 'DELETE' 
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20' 
                    : 'bg-white/5 text-on-surface-variant/40 cursor-not-allowed'
                }`}
              >
                {isDeletingAccount ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulated Razorpay Sandbox Modal */}
      {simulatedRzp && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 z-[150] animate-fade-in">
          <div className="w-full max-w-[420px] bg-[#09090b]/95 text-white rounded-3xl overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 flex flex-col gap-2 relative border-b border-white/5 bg-black/25">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-bold tracking-widest text-[#818cf8] text-base">Razorpay</span>
                  <span className="bg-[#818cf8]/15 text-[#b4c5ff] px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider font-mono border border-[#818cf8]/25">SIMULATION</span>
                </div>
                <button 
                  onClick={() => setSimulatedRzp(null)}
                  className="bg-transparent border-none text-[#94a3b8] hover:text-white cursor-pointer hover:bg-white/5 p-1 rounded-full transition-colors flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-mono text-left">{simulatedRzp.orderId}</p>
              <div className="flex justify-between items-baseline mt-4 pt-1 text-left">
                <span className="text-xs text-slate-400">Upgrade Plan: <strong className="text-[#818cf8]">{simulatedRzp.planName}</strong></span>
                <span className="text-2xl font-bold font-mono text-white">₹{simulatedRzp.amount / 100}</span>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 flex flex-col gap-6 text-left">
              <div className="flex items-center gap-3 bg-[#1e1b4b]/20 border border-[#818cf8]/20 rounded-2xl p-4 text-xs text-[#b4c5ff]">
                <span className="material-symbols-outlined text-[#818cf8] text-lg shrink-0">info</span>
                <span>Active API keys are not detected in server env. Running local simulation sandbox.</span>
              </div>

              <div className="flex flex-col gap-2.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wide">Prefilled Details</label>
                <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex flex-col gap-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Name</span>
                    <span className="font-semibold text-white">{sessionStorage.getItem('userName') || 'Candidate'}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Email</span>
                    <span className="font-mono text-white">{sessionStorage.getItem('userEmail') || ''}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3.5 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    const paymentId = `pay_sim_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
                    const signature = `sig_sim_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
                    simulatedRzp.handler({
                      razorpay_order_id: simulatedRzp.orderId,
                      razorpay_payment_id: paymentId,
                      razorpay_signature: signature
                    });
                    setSimulatedRzp(null);
                  }}
                  className="w-full py-3.5 bg-[#1e1b4b] hover:bg-[#1e1b4b]/80 border border-[#818cf8]/35 text-white font-bold text-xs rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer text-center shadow-md"
                >
                  Simulate Successful Payment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    alert("Payment cancelled.");
                    setSimulatedRzp(null);
                  }}
                  className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs rounded-xl border border-red-500/20 transition-all active:scale-[0.99] cursor-pointer text-center"
                >
                  Simulate Payment Failure
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-black/25 border-t border-white/5 p-4 text-center flex items-center justify-center gap-1.5 text-[9px] text-[#e5e1e4]/40 font-mono">
              <span className="material-symbols-outlined text-xs">security</span>
              <span>Secured by Razorpay Simulator Engine</span>
            </div>
          </div>
        </div>
      )}

      <Chatbot />
      <Footer />
    </div>
  );
}
