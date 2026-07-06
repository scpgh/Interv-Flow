import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DashboardNavbar from '../components/DashboardNavbar';
import Footer from '../components/Footer';

const LOADING_MESSAGES = [
  "Establishing telemetry handshake with AI server...",
  "Parsing vocal speech patterns & average WPM pacing...",
  "Scanning transcript for verbal crutch/filler words...",
  "Evaluating technical correctness & clarity scores...",
  "Drafting ideal recommended formulations with Llama 3.3...",
  "Finalizing evaluation report cards..."
];

export default function PracticeFeedback() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [activeNavTab, setActiveNavTab] = useState("dashboard");

  // Loading and Error States
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  // Loaded Session Data
  const [session, setSession] = useState(null);
  const [report, setReport] = useState(null);

  // Prevent duplicate fetching in React StrictMode double-mount
  const fetchedSessionIdRef = useRef(null);

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 1300);
      return () => clearInterval(interval);
    }
  }, [loading]);

  useEffect(() => {
    // Invalidate streak cache to ensure a fresh value is fetched on navigation
    sessionStorage.removeItem('user_streak_count');
    sessionStorage.removeItem('user_streak_last_fetched');
    sessionStorage.removeItem('user_streak_email');

    if (!sessionId || fetchedSessionIdRef.current === sessionId) {
      return;
    }
    fetchedSessionIdRef.current = sessionId;

    const fetchReport = async () => {
      setLoading(true);
      setErrorMsg('');

      try {
        // 1. Check if the session is saved and has a report generated on the backend (with retry logic for database write delay)
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        let response;
        let data;
        let attempts = 0;
        const maxAttempts = 4;

        while (attempts < maxAttempts) {
          try {
            response = await fetch(`${API_URL}/api/interview/session/${sessionId}`);
            data = await response.json();
            if (response.ok) break;
          } catch (fetchErr) {
            console.warn("Fetch attempt failed:", fetchErr);
          }
          attempts++;
          if (attempts < maxAttempts) {
            console.log(`Session not written yet. Retrying fetch in 1.2 seconds (attempt ${attempts + 1}/${maxAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, 1200));
          }
        }

        if (!response || !response.ok) {
          throw new Error(data?.error || "Failed to load session details. The server database has not completed saving this session yet.");
        }

        const loadedSession = data.session;
        setSession(loadedSession);

        // 2. If a report is already generated and cached, load it
        if (loadedSession.report) {
          setReport(loadedSession.report);
          setLoading(false);
          return;
        }

        // 3. Otherwise, trigger report generation POST request to backend
        const reportResponse = await fetch(`${API_URL}/api/interview/report`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sessionId })
        });
        
        const reportData = await reportResponse.json();
        if (!reportResponse.ok) {
          throw new Error(reportData.error || "Failed to generate interview report.");
        }

        setReport(reportData.report);
        setSession(reportData.sessionDetails);
      } catch (err) {
        console.error("Report loader error:", err);
        setErrorMsg(err.message || "Failed to retrieve interview metrics.");
        // Clear ref on failure to allow retry
        fetchedSessionIdRef.current = null;
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      fetchReport();
    }
  }, [sessionId]);

  if (loading) {
    return (
      <div className="bg-[#09090b] text-[#e5e1e4] min-h-screen flex flex-col relative overflow-x-hidden pt-16 font-body-md">
        <div className="fixed inset-0 pointer-events-none z-0 bg-radial-gradient"></div>
        <DashboardNavbar activeTab={activeNavTab} setActiveTab={setActiveNavTab} />
        
        <div className="flex-grow w-full flex items-center justify-center p-6 z-10 relative">
          <div className="glass-card max-w-md w-full rounded-3xl p-10 bg-[#151518]/60 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center gap-8 text-center relative overflow-hidden">
            {/* Glowing Backdrop Aura */}
            <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-[#818cf8]/10 blur-[60px] pointer-events-none"></div>
            <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-[#a78bfa]/10 blur-[60px] pointer-events-none"></div>

            {/* Glowing Scanning Animation */}
            <div className="relative w-28 h-28 flex items-center justify-center">
              {/* Outer Pulsing Glow */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#818cf8]/10 to-[#a78bfa]/10 animate-ping" style={{ animationDuration: '1.5s' }}></div>
              {/* Mid Pulsing Circle */}
              <div className="absolute inset-3 rounded-full bg-gradient-to-r from-[#818cf8]/5 to-[#a78bfa]/5 animate-pulse" style={{ animationDuration: '2s' }}></div>
              {/* Core Scanner Ring */}
              <div className="absolute inset-6 rounded-full border border-dashed border-[#818cf8]/30 animate-spin" style={{ animationDuration: '6s' }}></div>
              {/* Spinning Accent Dots */}
              <div className="absolute inset-4 rounded-full border border-double border-transparent border-t-[#a78bfa]/40 border-b-[#818cf8]/40 animate-spin" style={{ animationDuration: '3s' }}></div>
              {/* Scanner Core Icon */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#818cf8] to-[#a78bfa] flex items-center justify-center shadow-[0_0_40px_rgba(129,140,248,0.4)] transform rotate-45">
                <span className="material-symbols-outlined text-black font-bold text-2xl -rotate-45 animate-pulse">insights</span>
              </div>
            </div>
            
            <div className="space-y-4 w-full">
              <div className="space-y-1">
                <p className="text-[10px] font-mono text-[#818cf8] uppercase tracking-widest font-bold">Diagnostics Active</p>
                <h3 className="text-white text-xl font-bold tracking-tight flex items-center justify-center gap-2">
                  Analyzing Interview
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#818cf8] animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#818cf8] animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#818cf8] animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </span>
                </h3>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden relative">
                <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[#818cf8] to-[#a78bfa] rounded-full animate-pulse animate-duration-1000" style={{ width: `${((loadingMsgIdx + 1) / LOADING_MESSAGES.length) * 100}%`, transition: 'width 0.5s ease-in-out' }}></div>
              </div>

              {/* Loading Message Container */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl py-3 px-4 min-h-[50px] flex items-center justify-center">
                <p className="text-xs text-on-surface-variant leading-relaxed font-mono text-center max-w-[280px]">
                  {LOADING_MESSAGES[loadingMsgIdx]}
                </p>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (errorMsg || !session || !report) {
    return (
      <div className="bg-[#09090b] text-[#e5e1e4] min-h-screen flex flex-col relative overflow-x-hidden pt-16 font-body-md text-left">
        <div className="fixed inset-0 pointer-events-none z-0 bg-radial-gradient"></div>
        <DashboardNavbar activeTab={activeNavTab} setActiveTab={setActiveNavTab} />
        
        <div className="flex-grow flex flex-col items-center justify-center gap-5 p-margin-desktop z-10 relative text-center">
          <span className="material-symbols-outlined text-red-400 text-5xl">warning</span>
          <div className="space-y-2 max-w-md">
            <h3 className="font-headline-md text-headline-md text-white font-bold">Failed to Load Feedback</h3>
            <p className="text-xs text-on-surface-variant">{errorMsg || "We were unable to retrieve telemetry details for this session ID."}</p>
          </div>
          <Link to="/practice" className="btn-primary px-6 py-3 rounded-xl text-xs font-bold text-white border-none mt-4">
            Return to Setup Workspace
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  // Circular progress parameter
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(report.score || 0, 100) / 100) * circumference;

  return (
    <div className="bg-[#09090b] text-[#e5e1e4] min-h-screen flex flex-col relative overflow-x-hidden pt-16 font-body-md text-left">
      <div className="fixed inset-0 pointer-events-none z-0 bg-radial-gradient"></div>

      <DashboardNavbar activeTab={activeNavTab} setActiveTab={setActiveNavTab} />

      {/* Main Container */}
      <main className="flex-grow max-w-[1400px] mx-auto w-full px-6 pt-2 pb-8 z-10 relative flex flex-col gap-8">
        
        {/* Header Title Section */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="text-[9px] text-emerald-400 uppercase tracking-widest font-mono font-bold">Audit Complete</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-white font-bold tracking-tight">Interview Performance Report</h1>
            <p className="text-xs text-on-surface-variant mt-1">
              Feedback session compiled on {new Date(session.completedAt).toLocaleString()} for {session.mode === 'jd' ? `"${session.title}" at ${session.company}` : "Resume-based Mock Interview"}.
            </p>
          </div>

          <button onClick={() => navigate('/practice')} className="btn-secondary px-5 py-3 rounded-xl text-xs font-bold text-white flex items-center gap-2 cursor-pointer border border-white/10">
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Start New Session
          </button>
        </section>

        {/* ── METRICS GRID & OVERALL SCORE PANEL ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          
          {/* Circular Score Widget */}
          <div className="glass-card rounded-2xl p-6 bg-[#18181b]/35 border border-white/10 flex flex-col items-center justify-center text-center gap-4 min-h-[260px] relative overflow-hidden group">
            <div className="absolute -right-16 -top-16 w-36 h-36 bg-[#818CF8]/5 rounded-full blur-2xl"></div>
            
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono font-bold">Overall Rating</p>
            
            {/* SVG Circle Loader */}
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                {/* Background Ring */}
                <circle 
                  cx="60" cy="60" r={radius} 
                  className="stroke-white/5 fill-transparent" 
                  strokeWidth="8"
                />
                {/* Foreground Ring */}
                <circle 
                  cx="60" cy="60" r={radius} 
                  className="stroke-primary fill-transparent transition-all duration-1000 ease-out" 
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              {/* Text Score Overlay */}
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-white font-mono">{report.score || 0}</span>
                <span className="text-[9px] text-on-surface-variant font-mono uppercase">out of 100</span>
              </div>
            </div>

            <p className="text-xs text-[#818CF8] font-bold font-mono">
              {report.score >= 85 ? '🌟 Outstanding Performance!' : report.score >= 70 ? '👍 Solid Delivery, Slight Gaps' : '⚠️ Refinement Recommended'}
            </p>
          </div>

          {/* Speech Telemetry Metrics */}
          <div className="md:col-span-2 glass-card rounded-2xl p-6 bg-[#18181b]/35 border border-white/10 flex flex-col justify-between gap-6 min-h-[260px]">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Speaking Telemetry Metrics</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* pacing card */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                <span className="material-symbols-outlined text-primary text-xl">speed</span>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono">Average Pacing</p>
                <h4 className="text-xl font-bold text-white font-mono">{report.wpm || 120} <span className="text-xs font-normal text-on-surface-variant">WPM</span></h4>
                <p className="text-[9px] text-on-surface-variant leading-relaxed">
                  Ideal is 110–150. {report.wpm < 110 ? "Pacing is a bit slow." : report.wpm > 150 ? "Speech is fast." : "Pacing is excellent."}
                </p>
              </div>

              {/* filler card */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                <span className="material-symbols-outlined text-rose-400 text-xl">sms_failed</span>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono">Crutch Words</p>
                <h4 className="text-xl font-bold text-rose-400 font-mono">{report.fillerWords || 0} <span className="text-xs font-normal text-on-surface-variant">Used</span></h4>
                <p className="text-[9px] text-on-surface-variant leading-relaxed">
                  Spoke verbal fillers like "um", "uh", or "like" throughout user answers.
                </p>
              </div>

              {/* hesitation card */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                <span className="material-symbols-outlined text-amber-400 text-xl">pause_circle</span>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono">Pause & Hesitations</p>
                <h4 className="text-xl font-bold text-amber-400 font-mono">{report.hesitationDuration || '0s'}</h4>
                <p className="text-[9px] text-on-surface-variant leading-relaxed">
                  Cumulative silent gap durations registered during user speaking terms.
                </p>
              </div>
            </div>

            {/* High-level advice summary */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs">
              <span className="material-symbols-outlined text-primary text-lg mt-0.5">feedback</span>
              <p className="text-on-surface-variant leading-relaxed">
                <strong className="text-white">Review Summary:</strong> {report.correctnessFeedback} {report.clarityFeedback}
              </p>
            </div>
          </div>
        </section>

        {/* ── QUESTION-BY-QUESTION QA AUDIT MATRIX ── */}
        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">quiz</span>
            <h2 className="font-headline-md text-headline-md text-white font-bold">Detailed Answers Audit</h2>
          </div>

          {report.qaAudit && report.qaAudit.length > 0 ? (
            <div className="flex flex-col gap-6">
              {report.qaAudit.map((qa, index) => (
                <div key={index} className="glass-card rounded-2xl p-6 bg-[#18181b]/35 border border-white/10 space-y-4 text-left relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                  
                  {/* Question Header */}
                  <div className="flex items-start gap-3 pl-2">
                    <span className="font-mono text-primary font-bold text-xs">Q{index + 1}.</span>
                    <h3 className="text-xs font-bold text-white leading-relaxed">{qa.question}</h3>
                  </div>

                  {/* Transcript block */}
                  <div className="ml-5 p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-[9px] font-mono text-on-surface-variant uppercase tracking-wider font-bold">Your Response:</span>
                    <p className="text-xs text-on-surface italic leading-relaxed">"{qa.userResponse || 'No verbal answer recorded.'}"</p>
                  </div>

                  {/* Feedback grid */}
                  <div className="ml-5 grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-white/5">
                    {/* Flaws / Critique */}
                    <div className="space-y-1.5">
                      <h4 className="text-[10px] font-mono text-rose-500 dark:text-rose-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">error_outline</span>
                        Areas for Improvement
                      </h4>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        {qa.critique || "Review your answer pacing or check structural specifications."}
                      </p>
                    </div>

                    {/* Ideal formulation */}
                    <div className="space-y-1.5">
                      <h4 className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        Recommended Formulation
                      </h4>
                      <p className="text-xs text-on-surface bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl leading-relaxed">
                        {qa.idealAnswer || "Ensure to mention system capacity parameters or financial ratios."}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-8 bg-[#18181b]/35 border border-white/10 text-center text-xs text-on-surface-variant">
              No custom question audit entries generated. Check complete transcript below.
            </div>
          )}
        </section>

        {/* ── CONVERSATION TRANSCRIPT HUB ── */}
        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">forum</span>
            <h2 className="font-headline-md text-headline-md text-white font-bold">Full Interview Transcript</h2>
          </div>

          <div className="glass-card rounded-2xl bg-[#18181b]/35 border border-white/10 py-6 pl-6 pr-4">
            <div className="max-h-[500px] overflow-y-auto space-y-4 custom-scrollbar text-xs leading-relaxed pr-2">
              {session.transcript && session.transcript.length > 0 ? (
                session.transcript.map((item, index) => (
                  <div 
                    key={index}
                    className={`p-4 rounded-2xl border ${
                      item.sender === 'candidate' 
                        ? 'bg-[#1E1B4B]/30 border-[#818CF8]/25 ml-8 md:ml-16' 
                        : 'bg-white/[0.02] border-white/5 mr-8 md:mr-16'
                    }`}
                  >
                    <span className={`block text-[9px] font-mono font-bold uppercase mb-1.5 ${
                      item.sender === 'candidate' ? 'text-indigo-600 dark:text-[#818CF8]' : 'text-indigo-900 dark:text-primary'
                    }`}>
                      {item.sender === 'candidate' ? 'Candidate (You)' : 'Interviewer (IntervFlow AI)'}
                    </span>
                    <p className="text-on-surface">{item.text}</p>
                    <span className="block text-[8px] text-on-surface-variant font-mono mt-2 text-right">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center text-on-surface-variant py-8">
                  No transcript turns captured for this interview session.
                </div>
              )}
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
