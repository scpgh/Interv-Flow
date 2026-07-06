import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardNavbar from '../components/DashboardNavbar';
import Footer from '../components/Footer';
import Chatbot from '../components/Chatbot';

const critiqueData = {
  backend: {
    grammar: [
      { id: "g1", type: "error", title: "Casing & Typos", text: 'Inconsistent spelling of frameworks: "Nodejs" instead of "Node.js" and "postgres" instead of "PostgreSQL".' },
      { id: "g2", type: "error", title: "Missing Orchestration Typo", text: 'Misspelled orchestration tool: "Kubernets" detected in Project 2 experience list.' }
    ],
    technical: [
      { id: "t1", type: "error", title: "Missing Scale Patterns", text: 'Lacks mentions of horizontal scaling patterns: sharding, consistent hashing, caching (Redis), or message queues (Kafka).' },
      { id: "t2", type: "warning", title: "API Standards Vague", text: 'Uses generic "created API endpoints" instead of specifying standards like REST, GraphQL, or gRPC.' }
    ],
    impact: [
      { id: "i1", type: "error", title: "Non-Quantified Outcomes", text: 'Under "Optimized SQL queries," fails Google XYZ formula. Quantify query latency reduction (e.g., "Reduced database latency by 42%").' }
    ],
    formatting: [
      { id: "f1", type: "error", title: "Multi-Column Layout Risk", text: 'Dual-column layout detected. Standard ATS parsers read horizontally, causing text merging.' }
    ],
    gapAdvice: "Your resume is missing distributed scale patterns (caching/queues) and database optimization metrics.",
    atsKeywords: ["Distributed Systems", "Redis Cache", "gRPC / REST", "Kafka Streams", "CI/CD Setup"]
  },
  frontend: {
    grammar: [
      { id: "g1", type: "error", title: "Casing & Typos", text: 'Inconsistent branding: "Reactjs" instead of "React", and "typescript" instead of "TypeScript".' }
    ],
    technical: [
      { id: "t1", type: "error", title: "Vague State Management", text: 'React profile lacks details on state management tools (Zustand, Redux Toolkit, Context API) used for complex states.' },
      { id: "t2", type: "error", title: "No Performance Metrics", text: 'Lacks references to frontend performance tuning: Core Web Vitals, code-splitting, or lazy-loading.' }
    ],
    impact: [
      { id: "i1", type: "error", title: "Unquantified Page Speed", text: 'Bullet point says "Improved website speed." Convert to: "Decreased initial bundle size by 35%, leading to a 1.2s improvement in TTI".' }
    ],
    formatting: [
      { id: "f1", type: "error", title: "Skill Rating Progress Bars", text: 'Using progress bars to rate skills is unparseable by ATS and wastes space.' }
    ],
    gapAdvice: "Frontend speed metrics and global state management specifications are missing from the resume profile.",
    atsKeywords: ["Core Web Vitals", "Zustand / Redux", "Code Splitting", "Webpack / Vite", "Responsive UI"]
  },
  fullstack: {
    grammar: [
      { id: "g1", type: "error", title: "Casing & Typos", text: 'Casing errors: "javascript" instead of "JavaScript", and "mongodb" instead of "MongoDB".' }
    ],
    technical: [
      { id: "t1", type: "error", title: "Rendering Paradigm Vague", text: 'Lacks description of SSR/SSG/ISR rendering paradigms when detailing Next.js implementations.' },
      { id: "t2", type: "warning", title: "No Database Schema Context", text: 'Mentions databases but doesn\'t specify modeling choices (e.g. relational normalization).' }
    ],
    impact: [
      { id: "i1", type: "error", title: "Weak Collaboration Verb", text: 'Passive verb "Assisted in code reviews" found. Replace with: "Orchestrated pull-request quality gates".' }
    ],
    formatting: [
      { id: "f1", type: "error", title: "OCR Blocking Dividers", text: 'Horizontal divider lines and colored header banners block OCR scans.' }
    ],
    gapAdvice: "Include full-stack volume metrics and specify rendering paths (SSR/ISR) used in Next.js projects.",
    atsKeywords: ["Next.js SSR/ISR", "Database Modeling", "CI/CD Actions", "AWS Pipelines", "Tailwind CSS"]
  },
  se: {
    grammar: [
      { id: "g1", type: "error", title: "Casing Consistency", text: 'Review casing of technologies like "SQL" and "Git".' }
    ],
    technical: [
      { id: "t1", type: "error", title: "Design Patterns Missing", text: 'Needs description of backend design patterns (e.g. MVC, repository pattern) used in projects.' },
      { id: "t2", type: "warning", title: "Testing Methodologies Absent", text: 'Lacks mention of testing frameworks (Jest, PyTest, JUnit) and code coverage.' }
    ],
    impact: [
      { id: "i1", type: "error", title: "Unquantified Project Impact", text: 'Use Google XYZ formula: instead of "built dashboard", use "built dashboard, reducing data fetch latency by 20%".' }
    ],
    formatting: [
      { id: "f1", type: "error", title: "Unparseable Graphic Elements", text: 'Remove styling elements like stars or progress bars that break parser logic.' }
    ],
    gapAdvice: "Incorporate software testing practices (unit/integration tests) and show quantitative impact (XYZ formula).",
    atsKeywords: ["Algorithms & DS", "Design Patterns", "Unit & Integration Test", "SQL Optimizations", "Git Flow"]
  },
  ml: {
    grammar: [
      { id: "g1", type: "warning", title: "AI Framework Casing", text: 'Make sure terms like "PyTorch" and "TensorFlow" are capitalized correctly.' }
    ],
    technical: [
      { id: "t1", type: "error", title: "Model Serving Details Missing", text: 'Lacks reference to serving tools used in production (e.g. FastAPI, ONNX, Triton, or Docker).' }
    ],
    impact: [
      { id: "i1", type: "error", title: "Unquantified Model Performance", text: 'Fails XYZ formula: "Built prediction systems" should show model performance (e.g. F1-score uplift by 12%).' }
    ],
    formatting: [
      { id: "f1", type: "error", title: "Math Symbols Rendering Issues", text: 'Complex LaTeX symbols (like ∑ or β) in body text fail ATS translation.' }
    ],
    gapAdvice: "Add model deployment details (MLOps) and model evaluation metrics (accuracy, F1-score) to your experience.",
    atsKeywords: ["MLOps (Triton/FastAPI)", "Hyperparameter Tuning", "Deep Learning", "PyTorch / TensorFlow", "F1 / ROC-AUC Metrics"]
  },
  pm: {
    grammar: [
      { id: "g1", type: "warning", title: "Terminology Casing", text: 'Ensure terms like "Scrum" and "Agile" are capitalized.' }
    ],
    technical: [
      { id: "t1", type: "error", title: "Metric Tracking Details", text: 'Lacks references to specific metric tracking structures: burndown charts or OKR mapping.' },
      { id: "t2", type: "warning", title: "Analytics Stack Missing", text: 'PMs need data. Mention analytics tools like SQL, Amplitude, or Mixpanel.' }
    ],
    impact: [
      { id: "i1", type: "error", title: "Weak Action Verbs", text: 'Passive verb "Led meetings" found. Replace with: "Orchestrated cross-functional roadmaps".' }
    ],
    formatting: [
      { id: "f1", type: "error", title: "Floating Text Frames", text: 'Floating text boxes/frames are skipped entirely by standard ATS engines.' }
    ],
    gapAdvice: "Highlight product metrics (conversions, retention, user growth) and data analysis skills (SQL/Mixpanel).",
    atsKeywords: ["Product Strategy", "Agile / Scrum", "SQL / Amplitude", "User Research & PRD", "A/B Test Funnels"]
  }
};

const roleMapping = {
  backend: { title: "Senior Backend Engineer", match: "94%" },
  frontend: { title: "Senior Frontend Engineer", match: "89%" },
  fullstack: { title: "Senior Full-Stack Engineer", match: "95%" },
  se: { title: "Senior Software Engineer (General)", match: "92%" },
  ml: { title: "Machine Learning / AI Engineer", match: "65%" },
  pm: { title: "Technical Product Manager", match: "70%" }
};

export default function Analytics() {
  const navigate = useNavigate();
  
  // User info states
  const [userName, setUserName] = useState("Chaitanya");
  const [userDomain, setUserDomain] = useState("se");
  const [atsScore, setAtsScore] = useState("84");
  const [userExperience, setUserExperience] = useState("0 Yrs");
  const [userEducation, setUserEducation] = useState("B.S. Computer Science");
  const [userDreamCompany, setUserDreamCompany] = useState("Google");

  // Telemetry logs
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [averageMockScore, setAverageMockScore] = useState(null);
  const [totalSpeechHours, setTotalSpeechHours] = useState("0");

  useEffect(() => {
    // Check Authentication
    if (sessionStorage.getItem('isAuthenticated') !== 'true') {
      navigate('/login');
      return;
    }

    const fetchSessions = async () => {
      try {
        const userEmail = sessionStorage.getItem('userEmail') || '';
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await fetch(`${API_URL}/api/interview/sessions?email=${encodeURIComponent(userEmail)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.sessions)) {
          setSessions(data.sessions);
          
          // Calculate average mock interview score
          const scoredSessions = data.sessions.filter(s => s.report && typeof s.report.score === 'number');
          if (scoredSessions.length > 0) {
            const sum = scoredSessions.reduce((acc, curr) => acc + curr.report.score, 0);
            const avg = Math.round(sum / scoredSessions.length);
            setAverageMockScore(avg);
          }

          // Calculate total speech hours
          let totalMinutes = 0;
          data.sessions.forEach(s => {
            if (s.transcript && s.transcript.length > 0) {
              const start = s.startTime || 0;
              const end = s.completedAt || 0;
              if (end > start) {
                totalMinutes += (end - start) / (1000 * 60);
              } else {
                totalMinutes += s.durationMinutes || 15;
              }
            }
          });
          const hours = (totalMinutes / 60).toFixed(1);
          setTotalSpeechHours(hours);
        }
      } catch (err) {
        console.error("Failed to load interview sessions:", err);
      } finally {
        setLoadingSessions(false);
      }
    };
    fetchSessions();

    // Load values from cache
    const name = sessionStorage.getItem('userName');
    const domain = sessionStorage.getItem('userDomain') || 'fullstack';
    const cachedATS = sessionStorage.getItem('userATS');
    const exp = sessionStorage.getItem('userExperience') || '0 Yrs';
    const edu = sessionStorage.getItem('userEducation') || 'B.S. Computer Science';
    const company = sessionStorage.getItem('userTargetCompany') || 'Google';

    if (name) setUserName(name);
    if (domain) setUserDomain(domain);
    if (cachedATS) setAtsScore(cachedATS);
    if (exp) setUserExperience(exp);
    if (edu) setUserEducation(edu);
    if (company) setUserDreamCompany(company);
  }, [navigate]);

  // Derive resume analysis data
  const getResumeAnalysis = () => {
    const cachedAnalysis = sessionStorage.getItem('resumeAnalysisResult');
    if (cachedAnalysis) {
      try {
        const parsed = JSON.parse(cachedAnalysis);
        
        // Ensure atsKeywords is always a valid array of strings
        if (parsed.atsKeywords) {
          if (typeof parsed.atsKeywords === 'string') {
            parsed.atsKeywords = parsed.atsKeywords.split(',').map(s => s.trim()).filter(Boolean);
          } else if (!Array.isArray(parsed.atsKeywords)) {
            parsed.atsKeywords = [];
          }
        } else {
          parsed.atsKeywords = [];
        }

        // Ensure critique structure is fully defined with arrays to prevent map crashes
        if (!parsed.critique) parsed.critique = {};
        ['grammar', 'technical', 'impact', 'formatting'].forEach(key => {
          if (!Array.isArray(parsed.critique[key])) {
            parsed.critique[key] = [];
          }
        });

        // Ensure other basic fields are present/numeric
        parsed.atsScore = parsed.atsScore ? parseInt(parsed.atsScore) : 0;
        parsed.roleMatch = parsed.roleMatch ? parseInt(String(parsed.roleMatch).replace('%', '')) : 0;
        parsed.candidateName = parsed.candidateName || userName || 'Chaitanya';
        parsed.experienceYears = parsed.experienceYears || userExperience || '0 Yrs';
        parsed.highestEducation = parsed.highestEducation || userEducation || 'B.S. Computer Science';

        return parsed;
      } catch (e) {
        console.error("Error parsing cached resume analysis in analytics:", e);
      }
    }
    
    // Fallback based on domain
    const dKey = (userDomain || 'fullstack').toLowerCase();
    const expectations = critiqueData[dKey] || critiqueData.fullstack;
    const ats = atsScore || (dKey === 'backend' ? '88' : dKey === 'frontend' ? '84' : dKey === 'pm' ? '68' : '90');
    const rMap = roleMapping[dKey] || roleMapping.fullstack;
    const name = userName || 'Chaitanya';
    const eduName = userEducation || 'B.S. Computer Science';
    const expVal = userExperience || '0 Yrs';
    
    return {
      atsScore: parseInt(ats),
      roleMatch: parseInt(rMap.match.replace('%', '')),
      candidateName: name,
      highestEducation: eduName,
      experienceYears: expVal,
      critique: {
        grammar: expectations.grammar || [],
        technical: expectations.technical || [],
        impact: expectations.impact || [],
        formatting: expectations.formatting || []
      },
      gapAdvice: expectations.gapAdvice || "",
      atsKeywords: expectations.atsKeywords || []
    };
  };

  const resAnalysis = getResumeAnalysis();
  const targetRoleName = roleMapping[userDomain]?.title || "Senior Software Engineer";
  const targetMatchVal = roleMapping[userDomain]?.match || "90%";

  return (
    <div className="bg-[#09090b] text-[#e5e1e4] min-h-screen flex flex-col relative pt-20 font-body-md text-left">
      {/* Background radial atmosphere glow */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-radial-gradient"></div>

      <DashboardNavbar activeTab="analytics" />

      {/* Main Container */}
      <main className="flex-grow max-w-[1400px] mx-auto w-full px-6 pt-4 pb-16 z-10 relative flex flex-col gap-8">
        
        {/* Title Header */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span className="text-[9px] text-primary uppercase tracking-widest font-mono font-bold">IntervFlow Analytics Engine</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-white font-bold tracking-tight">IntervFlow Prep Analytics</h1>
            <p className="text-xs text-on-surface-variant mt-1">
              Holistic readiness metrics tracking both your Resume ATS compatibility and Mock Interview performance.
            </p>
          </div>

          <button onClick={() => navigate('/practice')} className="btn-primary px-5 py-3 rounded-xl text-xs font-bold text-white flex items-center gap-2 border-none">
            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
            Start Simulation
          </button>
        </section>

        {/* ── HOLISTIC ASSESSMENT PANEL (4-COLUMNS GRID) ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Circular Score 1: Avg Interview Score */}
          <div className="glass-card rounded-2xl p-5 bg-[#18181b]/35 border border-white/10 text-left flex flex-col justify-between min-h-[140px] relative overflow-hidden group">
            <div className="absolute -right-8 -top-8 w-20 h-20 bg-primary/5 rounded-full blur-xl"></div>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono font-bold">AVG INTERVIEW SCORE</p>
            <p className="text-4xl font-extrabold text-white font-mono mt-2">
              {averageMockScore !== null ? `${averageMockScore}` : '--'}
              <span className="text-xs font-normal text-on-surface-variant"> /100</span>
            </p>
            <div className="flex items-center gap-1.5 text-[9px] text-emerald-400 font-mono mt-2">
              <span className="material-symbols-outlined text-[12px]">trending_up</span>
              <span>Based on {sessions.filter(s => s.report).length} completed runs</span>
            </div>
          </div>

          {/* Circular Score 2: Resume ATS Rating */}
          <div className="glass-card rounded-2xl p-5 bg-[#18181b]/35 border border-white/10 text-left flex flex-col justify-between min-h-[140px] relative overflow-hidden group">
            <div className="absolute -right-8 -top-8 w-20 h-20 bg-[#818CF8]/5 rounded-full blur-xl"></div>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono font-bold">RESUME ATS SCORE</p>
            <p className="text-4xl font-extrabold text-[#818CF8] font-mono mt-2">
              {resAnalysis.atsScore}%
              <span className="text-xs font-normal text-on-surface-variant"> /100</span>
            </p>
            <div className="flex items-center gap-1.5 text-[9px] text-emerald-400 font-mono mt-2">
              <span className="material-symbols-outlined text-[12px]">verified</span>
              <span>Matching: {targetMatchVal} on {userDomain.toUpperCase()}</span>
            </div>
          </div>

          {/* Circular Score 3: Practice hours */}
          <div className="glass-card rounded-2xl p-5 bg-[#18181b]/35 border border-white/10 text-left flex flex-col justify-between min-h-[140px] relative overflow-hidden group">
            <div className="absolute -right-8 -top-8 w-20 h-20 bg-primary/5 rounded-full blur-xl"></div>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono font-bold">TOTAL SPEAKING TIME</p>
            <p className="text-4xl font-extrabold text-white font-mono mt-2">
              {totalSpeechHours}
              <span className="text-xs font-normal text-on-surface-variant"> Hours</span>
            </p>
            <div className="flex items-center gap-1.5 text-[9px] text-[#818CF8] font-mono mt-2">
              <span className="material-symbols-outlined text-[12px]">schedule</span>
              <span>Accumulated speaking logs</span>
            </div>
          </div>

          {/* Circular Score 4: Mock runs */}
          <div className="glass-card rounded-2xl p-5 bg-[#18181b]/35 border border-white/10 text-left flex flex-col justify-between min-h-[140px] relative overflow-hidden group">
            <div className="absolute -right-8 -top-8 w-20 h-20 bg-[#818CF8]/5 rounded-full blur-xl"></div>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono font-bold">MOCKS COMPLETED</p>
            <p className="text-4xl font-extrabold text-white font-mono mt-2">
              {sessions.length}
              <span className="text-xs font-normal text-on-surface-variant"> Runs</span>
            </p>
            <div className="flex items-center gap-1.5 text-[9px] text-emerald-400 font-mono mt-2">
              <span className="material-symbols-outlined text-[12px]">check_circle</span>
              <span>Simulated setup entries</span>
            </div>
          </div>
        </section>

        {/* ── DOUBLE COLUMNS: RESUME VS INTERVIEW TELEMETRY ── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          
          {/* COLUMN 1: RESUME & ATS AUDIT SUMMARY */}
          <div className="glass-card rounded-2xl p-6 bg-[#18181b]/35 border border-white/10 flex flex-col gap-6">
            <div className="flex justify-between items-start border-b border-white/5 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">description</span>
                  Resume ATS Audit
                </h3>
                <p className="text-[10px] text-on-surface-variant mt-0.5">Target: {targetRoleName}</p>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-[#818CF8]/10 border border-[#818CF8]/20 text-[#818CF8] font-mono text-[10px] font-bold">
                Match Level: {targetMatchVal}
              </span>
            </div>

            {/* Profile specifications */}
            <div className="grid grid-cols-3 gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <div>
                <p className="text-[8px] text-on-surface-variant font-mono uppercase">Candidate</p>
                <p className="text-[11px] font-bold text-white truncate">{resAnalysis.candidateName}</p>
              </div>
              <div>
                <p className="text-[8px] text-on-surface-variant font-mono uppercase">Experience</p>
                <p className="text-[11px] font-bold text-white">{resAnalysis.experienceYears}</p>
              </div>
              <div>
                <p className="text-[8px] text-on-surface-variant font-mono uppercase">Highest Edu</p>
                <p className="text-[10px] font-bold text-white truncate">{resAnalysis.highestEducation}</p>
              </div>
            </div>

            {/* ATS Gaps / Critique checklist */}
            <div className="space-y-4">
              <p className="text-[9px] text-on-surface-variant font-mono uppercase font-bold tracking-wider">Critical Optimization Gaps</p>
              
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                {/* Technical gaps */}
                {resAnalysis.critique.technical && resAnalysis.critique.technical.map((item) => (
                  <div key={item.id} className="flex gap-2.5 text-[11px] bg-red-500/5 p-2.5 rounded-lg border border-red-500/10">
                    <span className="material-symbols-outlined text-red-400 text-xs mt-0.5">warning</span>
                    <div>
                      <strong className="text-white block">{item.title}</strong>
                      <span className="text-on-surface-variant">{item.text}</span>
                    </div>
                  </div>
                ))}

                {/* Formatting gaps */}
                {resAnalysis.critique.formatting && resAnalysis.critique.formatting.map((item) => (
                  <div key={item.id} className="flex gap-2.5 text-[11px] bg-red-500/5 p-2.5 rounded-lg border border-red-500/10">
                    <span className="material-symbols-outlined text-red-400 text-xs mt-0.5">warning</span>
                    <div>
                      <strong className="text-white block">{item.title}</strong>
                      <span className="text-on-surface-variant">{item.text}</span>
                    </div>
                  </div>
                ))}

                {/* Impact gaps */}
                {resAnalysis.critique.impact && resAnalysis.critique.impact.map((item) => (
                  <div key={item.id} className="flex gap-2.5 text-[11px] bg-amber-500/5 p-2.5 rounded-lg border border-amber-500/10">
                    <span className="material-symbols-outlined text-amber-400 text-xs mt-0.5">error_outline</span>
                    <div>
                      <strong className="text-white block">{item.title}</strong>
                      <span className="text-on-surface-variant">{item.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Keyword recommendations */}
            <div className="space-y-2.5 pt-2 border-t border-white/5">
              <p className="text-[9px] text-on-surface-variant font-mono uppercase font-bold tracking-wider">Recommended ATS Keywords to Inject</p>
              <div className="flex flex-wrap gap-1.5">
                {resAnalysis.atsKeywords && resAnalysis.atsKeywords.map((kw, idx) => (
                  <span key={idx} className="text-[10px] px-2 py-0.5 bg-primary/10 border border-primary/20 text-indigo-900 dark:text-[#b4c5ff] font-mono rounded">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* COLUMN 2: INTERVIEW TELEMETRY */}
          <div className="glass-card rounded-2xl p-6 bg-[#18181b]/35 border border-white/10 flex flex-col gap-6">
            <div className="flex justify-between items-start border-b border-white/5 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">forum</span>
                  Speaking Telemetry
                </h3>
                <p className="text-[10px] text-on-surface-variant mt-0.5">Analyzed speech metrics and pace history</p>
              </div>
            </div>

            {/* WPM Pacing Section */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white">Speech Pacing (Words Per Minute)</span>
                <span className="text-on-surface-variant font-mono text-[10px]">Target: 110-150 WPM</span>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                IntervFlow Engine monitors your speaking rate. Continuous fast or slow paces reduce delivery structure.
              </p>

              <div className="space-y-4 pt-2">
                {sessions.filter(s => s.report).length === 0 ? (
                  <div className="text-center py-6 text-xs text-on-surface-variant italic bg-white/[0.01] rounded-xl border border-dashed border-white/5">
                    No pacing history recorded. Complete a mock session first.
                  </div>
                ) : (
                  sessions.filter(s => s.report).slice(0, 3).map((session) => {
                    const wpmVal = session.report.wpm || 0;
                    const wpmPercentage = Math.min((wpmVal / 200) * 100, 100);
                    const isOptimal = wpmVal >= 110 && wpmVal <= 150;
                    
                    return (
                      <div key={session.id} className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-white truncate max-w-[200px]">{session.mode === 'jd' ? `${session.title}` : 'Resume Exam'}</span>
                          <span className={isOptimal ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                            {wpmVal} WPM ({isOptimal ? 'Optimal' : wpmVal < 110 ? 'Slow' : 'Fast'})
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded bg-white/5 relative overflow-hidden">
                          <div 
                            className={`h-full rounded transition-all duration-500 ${isOptimal ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${wpmPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Crutch words tracker */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white">Verbal Filler Usage</span>
                <span className="text-on-surface-variant font-mono text-[10px]">Target: &lt;5 fillers</span>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Repetition of verbal filters (like "um", "uh", "like", "so") dilutes technical assertions.
              </p>

              <div className="space-y-4 pt-2">
                {sessions.filter(s => s.report).length === 0 ? (
                  <div className="text-center py-6 text-xs text-on-surface-variant italic bg-white/[0.01] rounded-xl border border-dashed border-white/5">
                    No crutch words recorded.
                  </div>
                ) : (
                  sessions.filter(s => s.report).slice(0, 3).map((session) => {
                    const fillerVal = session.report.fillerWords || 0;
                    const fillerPercentage = Math.min((fillerVal / 15) * 100, 100);
                    const isGood = fillerVal <= 5;
                    
                    return (
                      <div key={session.id} className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-white truncate max-w-[200px]">{session.mode === 'jd' ? `${session.title}` : 'Resume Exam'}</span>
                          <span className={isGood ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                            {fillerVal} fillers ({isGood ? 'Optimal' : 'High'})
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded bg-white/5 relative overflow-hidden">
                          <div 
                            className={`h-full rounded transition-all duration-500 ${isGood ? 'bg-emerald-500' : 'bg-rose-500'}`}
                            style={{ width: `${fillerPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── INTEGRATED AI ACTION PLAN & GROWTH RECOMMENDATIONS ── */}
        <section className="glass-card rounded-2xl p-6 border border-primary/20 bg-[#1E1B4B]/5 relative overflow-hidden">
          <div className="absolute -right-20 -bottom-20 w-48 h-48 bg-[#1e1b4b]/20 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-5">
            <span className="material-symbols-outlined text-primary text-2xl">auto_awesome</span>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Combined Growth Plan</h3>
              <p className="text-[10px] text-on-surface-variant">Tailored recommendations derived from your combined resume and speaking telemetry metrics</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Resume recommendations */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <span className="material-symbols-outlined text-primary text-[16px]">description</span>
                ATS Score Focus
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Your resume ATS score is **{resAnalysis.atsScore}%**. 
                {resAnalysis.atsScore < 85 ? (
                  " Modify grammar casing tech terms and fix structural dividers. Ensure the first-page layout uses a clean, single-column design suitable for OCR scrapers."
                ) : (
                  " Your resume is highly structured. Maintain consistency and update keywords whenever you apply to adjacent domains."
                )}
              </p>
            </div>

            {/* Speaking recommendations */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <span className="material-symbols-outlined text-primary text-[16px]">speed</span>
                Delivery & Pacing Focus
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                {sessions.filter(s => s.report).length === 0 ? (
                  "No speech pacing log found. Start a mock interview to calibrate your WPM. Aim to deliver technical claims between 110 and 150 WPM."
                ) : (() => {
                  const lastSession = sessions.filter(s => s.report)[0];
                  const wpmVal = lastSession.report.wpm || 0;
                  if (wpmVal < 110) {
                    return `Your last session registered a pacing of **${wpmVal} WPM**. Pacing is slightly slow. Speak more dynamically to express high energy.`;
                  } else if (wpmVal > 150) {
                    return `Your last session registered a pacing of **${wpmVal} WPM**. Speaking rate is too fast. Incorporate structural silence and pauses between logical assertions.`;
                  } else {
                    return `Your last session pacing was **${wpmVal} WPM** which is optimal. Continue maintaining this deliberate speed in high-stakes loops.`;
                  }
                })()}
              </p>
            </div>

            {/* Growth checklist */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <span className="material-symbols-outlined text-emerald-400 text-[16px]">checklist</span>
                Growth Action Plan
              </div>
              <ul className="text-[10px] text-on-surface-variant space-y-1.5 leading-relaxed">
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 font-bold">1.</span>
                  <span>Add domain keywords like <strong>{resAnalysis.atsKeywords[0] || "Distributed Systems"}</strong> in context.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 font-bold">2.</span>
                  <span>Frame projects using Google XYZ: <em>"Accomplished X, measured by Y, by doing Z."</em></span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-400 font-bold">3.</span>
                  <span>Reduce verbal filters to strengthen presence. Replace stutters with deliberate breathing.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── LOGS TABLE ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">assignment</span>
            <h2 className="font-headline-md text-headline-md text-white font-bold">Completed Sessions</h2>
          </div>

          <div className="glass-card rounded-xl border border-white/5 bg-[#18181b]/35 overflow-hidden">
            {/* Sticky header wrapper */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-on-surface-variant border-collapse">
                <thead>
                  <tr className="border-b border-white/5 font-mono uppercase text-[10px] text-slate-600 dark:text-white bg-slate-100 dark:bg-[#18181b]/60">
                    <th className="py-3 px-4">Role Title</th>
                    <th className="py-3 px-4 text-center">Score</th>
                    <th className="py-3 px-4 text-center">WPM</th>
                    <th className="py-3 px-4 text-center">Filler Words</th>
                    <th className="py-3 px-4 text-center">Hesitations</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
              </table>
            </div>
            {/* Scrollable body — shows 7 rows at a time (~44px per row) */}
            <div className="overflow-x-auto overflow-y-auto custom-scrollbar" style={{ maxHeight: '308px' }}>
              <table className="w-full text-xs text-left text-on-surface-variant border-collapse">
                <tbody>
                  {sessions.filter(s => s.report).length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-on-surface-variant italic">
                        No completed mock sessions registered yet. Start a practice session to see logs!
                      </td>
                    </tr>
                  ) : (
                    sessions.filter(s => s.report).map((session) => (
                      <tr key={session.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-all">
                        <td className="py-3 px-4 text-white font-medium" style={{ minWidth: '200px' }}>
                          {session.mode === 'jd' ? `${session.title} at ${session.company}` : "Resume Cross-Examination"}
                        </td>
                        <td className="py-3 px-4 text-center" style={{ minWidth: '80px' }}>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold border border-emerald-500/20">
                            {session.report.score}/100
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono" style={{ minWidth: '70px' }}>{session.report.wpm}</td>
                        <td className="py-3 px-4 text-center font-mono" style={{ minWidth: '100px' }}>{session.report.fillerWords}</td>
                        <td className="py-3 px-4 text-center font-mono" style={{ minWidth: '100px' }}>{session.report.hesitationDuration || '0s'}</td>
                        <td className="py-3 px-4 text-right" style={{ minWidth: '100px' }}>
                          <button 
                            onClick={() => navigate(`/practice/feedback/${session.id}`)}
                            className="text-primary hover:text-primary/80 font-bold font-mono cursor-pointer border-none bg-transparent"
                          >
                            View Report
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

      </main>

      <Footer />
      <Chatbot />
    </div>
  );
}
