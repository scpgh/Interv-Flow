import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardNavbar from '../components/DashboardNavbar';
import Footer from '../components/Footer';
import Chatbot from '../components/Chatbot';

const critiqueData = {
  backend_systems: {
    grammar: [
      { id: "g1", type: "error", title: "Casing & Typos", text: 'Inconsistent spelling of frameworks: "Nodejs" instead of "Node.js" and "postgres" instead of "PostgreSQL".' },
      { id: "g2", type: "error", title: "Missing Orchestration Typo", text: 'Misspelled orchestration tool: "Kubernets" detected in Project 2 experience list.' },
      { id: "g3", type: "warning", title: "Punctuation Inconsistency", text: 'Missing sentence-ending periods in 2 bullet points under Senior Backend Developer at TechCorp.' }
    ],
    technical: [
      { id: "t1", type: "error", title: "Missing Scale Patterns", text: 'Lacks mentions of critical horizontal scaling patterns: sharding, consistent hashing, caching (Redis/Memcached), or message queues (Kafka/RabbitMQ).' },
      { id: "t2", type: "warning", title: "DB Strategy Details", text: 'Mentions write-heavy database logs but does not explain indexing or partition strategies used to mitigate write-locks.' },
      { id: "t3", type: "warning", title: "API Standards Vague", text: 'Uses generic "created API endpoints" instead of specifying standards like REST, GraphQL, or gRPC interfaces.' }
    ],
    impact: [
      { id: "i1", type: "error", title: "Non-Quantified Optimizations", text: 'Under "Optimized SQL queries," fails the Google XYZ formula. Quantify the throughput increase or CPU reduction (e.g., "Reduced database query latency by 42%").' },
      { id: "i2", type: "warning", title: "Passive Action Verbs", text: 'Passive verb "Helped migrate legacy codebase" detected. Replace with high-signal verbs like "Spearheaded", "Orchestrated", or "Engineered".' }
    ],
    formatting: [
      { id: "f1", type: "error", title: "Multi-Column Layout Risk", text: 'Dual-column layout detected. Standard ATS parsers (e.g., Workday) read horizontally, causing sidebar skills to merge into job details.' },
      { id: "f2", type: "warning", title: "Missing Portfolio links", text: 'Missing GitHub or Docker Hub profile links in the contact header section.' }
    ]
  },
  frontend_ui: {
    grammar: [
      { id: "g1", type: "error", title: "Casing & Typos", text: 'Inconsistent branding: "Reactjs" instead of "React", "typescript" instead of "TypeScript", and "tailwind" instead of "Tailwind CSS".' },
      { id: "g2", type: "warning", title: "Double Spacing", text: 'Double spacing detected in "designed  reusable components" under Frontend Engineer section.' }
    ],
    technical: [
      { id: "t1", type: "error", title: "Vague State Management", text: 'React profile lacks details on state management tools (e.g., Redux Toolkit, Zustand, Context API, or Recoil) used for complex states.' },
      { id: "t2", type: "error", title: "No Performance Metrics", text: 'Lacks references to frontend performance tuning: Core Web Vitals, code-splitting, lazy-loading, or image compression.' },
      { id: "t3", type: "warning", title: "Build System Absence", text: 'Missing build/compiler tools reference. Specify Vite, Webpack, Babel, or Turbopack configurations handled.' }
    ],
    impact: [
      { id: "i1", type: "error", title: "Unquantified Page Speed", text: 'Bullet point says "Improved website speed." Suggest converting to: "Decreased initial bundle size by 35%, leading to a 1.2s improvement in Time to Interactive (TTI)".' },
      { id: "i2", type: "warning", title: "Weak User Impact", text: 'Fails to link styling changes to user outcomes. Change "Redesigned product catalog pages" to "Redesigned catalog flows, boosting conversion rates by 14%".' }
    ],
    formatting: [
      { id: "f1", type: "error", title: "Skill Rating Bars", text: 'Using graphic elements (stars, progress bars, colored dots) to self-rate skills is unparseable by ATS and wastes page space.' },
      { id: "f2", type: "warning", title: "Portfolio Missing link", text: 'Missing Figma, Dribbble, or personal website portfolio URL in contact header.' }
    ]
  },
  fullstack_swe: {
    grammar: [
      { id: "g1", type: "error", title: "Casing & Typos", text: 'Casing errors: "javascript" instead of "JavaScript", "mongodb" instead of "MongoDB", and "html/css" instead of "HTML5 & CSS3".' },
      { id: "g2", type: "error", title: "Typo in soft skills", text: 'Spelling error: "resilence" instead of "resilience" in the professional summary section.' }
    ],
    technical: [
      { id: "t1", type: "error", title: "Hydration & SSR Details", text: 'Lacks description of SSR/SSG/ISR rendering paradigms when detailing Next.js or Nuxt.js implementations.' },
      { id: "t2", type: "warning", title: "No Database Schema Context", text: 'Mentions SQL and NoSQL databases but doesn\'t specify data-modeling choices (e.g., relational normalization vs. embedded documents).' },
      { id: "t3", type: "warning", title: "Missing CI/CD Automation", text: 'Has no mention of deployment flows or pipeline automation (Docker, Docker-compose, GitHub Actions).' }
    ],
    impact: [
      { id: "i1", type: "error", title: "Weak Collaboration Verb", text: 'Passive verb "Assisted in code reviews" found. Replace with high-signal verbs: "Orchestrated pull-request quality gates" or "Mentored junior devs".' },
      { id: "i2", type: "warning", title: "Lack of Scale Metric", text: 'Missing user volume scaling metrics. Suggest adding metrics: "supporting 15k+ active daily users" or "handling 5M+ monthly API calls".' }
    ],
    formatting: [
      { id: "f1", type: "error", title: "OCR Blocking Graphic Lines", text: 'Horizontal divider lines and colored header banners block OCR scans. Replace with clean borders or text-based spacing.' },
      { id: "f2", type: "warning", title: "Missing LinkedIn / GitHub", text: 'Ensure both active LinkedIn profile and GitHub links are formatted properly in header.' }
    ]
  },
  data_ml: {
    grammar: [
      { id: "g1", type: "error", title: "Casing & Typos", text: 'Inconsistent naming: "scikit learn" instead of "scikit-learn", "pytorch" instead of "PyTorch", and "tensorflow" instead of "TensorFlow".' },
      { id: "g2", type: "warning", title: "Adjective usage", text: 'Used "quick training times" instead of standard "optimized model execution runtime".' }
    ],
    technical: [
      { id: "t1", type: "error", title: "Training Details Lacking", text: 'Lacks details on regularization or model optimization techniques (e.g., dropout, weight decay, hyperparameter tuning using Optuna).' },
      { id: "t2", type: "error", title: "Vague Processing Pipelines", text: 'Lacks reference to data pipelines or vectorization structures. Suggest mentioning Apache Spark, pandas vectorization, or SQL query tuning.' },
      { id: "t3", type: "warning", title: "Missing Serving Frameworks", text: 'Mentions ML models but fails to explain deployment/serving tools used in production (e.g., FastAPI, ONNX, Triton, or Docker).' }
    ],
    impact: [
      { id: "i1", type: "error", title: "Unquantified Model Metrics", text: 'Fails Google XYZ formula: "Built prediction systems" should show model performance (e.g., "Improved F1-score from 0.81 to 0.94, reducing false positives by 22%").' },
      { id: "i2", type: "warning", title: "Weak Action Verbs", text: 'Fails to showcase ownership: "Worked on ML model". Replace with "Trained, evaluated, and deployed deep learning architectures".' }
    ],
    formatting: [
      { id: "f1", type: "error", title: "Math Symbol Failure", text: 'Complex LaTeX symbols (like ∑ or β) in body text often fail ATS translation, appearing as garbled text strings.' },
      { id: "f2", type: "warning", title: "Missing Kaggle / GitHub", text: 'No Kaggle, Hugging Face, or GitHub link found. Essential for showcasing open-source machine learning portfolios.' }
    ]
  },
  leadership: {
    grammar: [
      { id: "g1", type: "error", title: "Casing & Typos", text: 'Casing errors: "jira" instead of "Jira", "agile/scrum" instead of "Agile/Scrum".' },
      { id: "g2", type: "error", title: "Typo in Core Text", text: 'Spelling error: "devolpment" instead of "development" in Engineering Manager role description.' }
    ],
    technical: [
      { id: "t1", type: "error", title: "Process Methodologies", text: 'Lacks references to specific metric tracking structures: burndown charts, sprint velocity analytics, or OKR mapping.' },
      { id: "t2", type: "warning", title: "Architecture Understanding", text: 'Lacks high-level architectural references like Service-Oriented Architecture (SOA), microservices SLA metrics, or cloud cost governance.' }
    ],
    impact: [
      { id: "i1", type: "error", title: "Weak Facilitation Verbs", text: 'Passive verb "Led scrum meetings" found. Replace with high-impact verbs: "Facilitated agile iterations" or "Orchestrated cross-functional roadmaps".' },
      { id: "i2", type: "warning", title: "No Delivery Metric", text: 'Fails to quantify project delivery successes. Add metric details like: "delivered product roadmap 3 weeks ahead of schedule, saving $45k in overhead".' }
    ],
    formatting: [
      { id: "f1", type: "error", title: "Floating Text Frames", text: 'Floating text boxes/frames are skipped entirely by standard ATS engines. Ensure all text sits in main flow.' },
      { id: "f2", type: "warning", title: "Missing Contact Detail", text: 'No professional LinkedIn profile URL detected in contact info.' }
    ]
  },
  consulting_finance: {
    grammar: [
      { id: "g1", type: "error", title: "Casing & Typos", text: 'Casing error: "ebitda" instead of "EBITDA", "excel" instead of "MS Excel", and "powerpoint" instead of "PowerPoint".' },
      { id: "g2", type: "error", title: "Typo in Finance Terms", text: 'Spelling error: "financials" instead of "financial statements" in experience section.' }
    ],
    technical: [
      { id: "t1", type: "error", title: "Modeling Methods Vague", text: 'Lacks standard financial / consulting methodology references: DCF (Discounted Cash Flow) modeling, LBO modeling, MECE framework, or SWOT analysis.' },
      { id: "t2", type: "warning", title: "Vague Analytics Stack", text: 'Lacks references to data analysis stack (e.g. SQL, Tableau, PowerBI, or advanced Excel pivot tables).' }
    ],
    impact: [
      { id: "i1", type: "error", title: "No Dollar-Value Impact", text: 'Fails Google XYZ formula: "Helped client with cost cutting". Replace with "Formulated cost-restructuring plans that saved $1.2M in annual operational expenditures".' },
      { id: "i2", type: "warning", title: "Passive Business Verbs", text: 'Passive verb "Involved in market research". Suggest using: "Executed competitive market intelligence assessments to capture new revenues".' }
    ],
    formatting: [
      { id: "f1", type: "error", title: "Dense Text Blocks", text: 'Text blocks exceed 4 lines without bullet spacing, making resume unscannable for human hiring managers within the 6-second average look.' },
      { id: "f2", type: "warning", title: "Vague Address details", text: 'Address lists full street addresses. To preserve privacy and ATS parsing spacing, only city/state is required.' }
    ]
  },
  default: {
    grammar: [
      { id: "g1", type: "error", title: "Capitalization & Casing", text: 'Ensure all professional certifications and framework names are correctly capitalized.' },
      { id: "g2", type: "warning", title: "Ending Punctuation", text: 'Bullet lists contain inconsistent ending punctuation; ensure consistent period usage.' }
    ],
    technical: [
      { id: "t1", type: "error", title: "Core Skills Underrepresented", text: 'Ensure the skills section explicitly details technical methodologies, core software applications, and project cycles.' },
      { id: "t2", type: "warning", title: "Certifications Details", text: 'List issuer and date for professional certifications to prove validity.' }
    ],
    impact: [
      { id: "i1", type: "error", title: "Missing Quantified Outcomes", text: 'Verify that accomplishments are framed with numerical indicators (e.g., % time saved, revenue generated, clients served).' },
      { id: "i2", type: "warning", title: "Weak Action Verbs", text: 'Avoid soft verbs like "helped," "responsible for," or "worked on." Use verbs like "executed," "championed," or "implemented."' }
    ],
    formatting: [
      { id: "f1", type: "error", title: "Parsing Safety Check", text: 'Ensure there are no text boxes, charts, or images which disrupt optical character recognition (OCR).' },
      { id: "f2", type: "warning", title: "Professional Header", text: 'Ensure LinkedIn, email, phone number, and city/state are correctly formatted in header.' }
    ]
  }
};

const domainToCritiqueGroup = {
  backend: 'backend_systems',
  devops: 'backend_systems',
  dataeng: 'backend_systems',
  cloud: 'backend_systems',
  solutions: 'backend_systems',
  security: 'backend_systems',
  frontend: 'frontend_ui',
  design: 'frontend_ui',
  fullstack: 'fullstack_swe',
  swe: 'fullstack_swe',
  mobile: 'fullstack_swe',
  sdet: 'fullstack_swe',
  ml: 'data_ml',
  ds: 'data_ml',
  pm: 'leadership',
  em: 'leadership',
  consulting: 'consulting_finance',
  finance: 'consulting_finance',
  bizdev: 'consulting_finance',
  financial: 'consulting_finance',
  strategy: 'consulting_finance',
  vc: 'consulting_finance',
  brand: 'consulting_finance',
  marketing: 'consulting_finance'
};

export default function ResumeAnalyzer() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [apiData, setApiData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [scanState, setScanState] = useState('idle'); // 'idle' | 'scanning' | 'completed'
  const [progress, setProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState('Extracting Skills...');
  const [selectedDomain, setSelectedDomain] = useState(sessionStorage.getItem('userDomain') || 'fullstack');
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'pdf' || ext === 'docx' || ext === 'doc') {
        handleScan(file);
      } else {
        setErrorMsg("Unsupported file type. Please upload a PDF (.pdf) or Word (.docx) document.");
      }
    }
  };

  // New Input tabs & chatbot states
  const [inputMethod, setInputMethod] = useState('file'); // 'file' | 'text'
  const [pastedText, setPastedText] = useState("");
  const [userQuestion, setUserQuestion] = useState("");
  const [qaMessages, setQaMessages] = useState([
    { sender: 'bot', text: "Ask me anything about your resume! For example: 'What are the main tech gaps I should fix?' or 'How can I make my experience descriptions sound stronger?'" }
  ]);
  const [isQaLoading, setIsQaLoading] = useState(false);

  // Role mappings dictionary
  const roleMapping = {
    backend: { title: "Senior Backend Engineer", match: "94%", ats: "88" },
    frontend: { title: "Senior Frontend Engineer", match: "89%", ats: "84" },
    fullstack: { title: "Senior Full-Stack Engineer", match: "95%", ats: "90" },
    mobile: { title: "Senior Mobile Developer (iOS/Android)", match: "82%", ats: "79" },
    devops: { title: "Infrastructure / DevOps Lead", match: "78%", ats: "75" },
    ml: { title: "Machine Learning / AI Engineer", match: "65%", ats: "60" },
    dataeng: { title: "Senior Data Engineer", match: "80%", ats: "78" },
    security: { title: "Security / AppSec Specialist", match: "74%", ats: "71" },
    sdet: { title: "QA / SDET Lead Engineer", match: "85%", ats: "82" },
    swe: { title: "Senior Software Engineer (General)", match: "92%", ats: "87" },
    pm: { title: "Technical Product Manager", match: "70%", ats: "68" },
    em: { title: "Engineering Manager", match: "72%", ats: "70" },
    ds: { title: "Data Scientist / Analyst", match: "68%", ats: "64" },
    design: { title: "UX/UI Designer & Developer", match: "55%", ats: "52" },
    cloud: { title: "Cloud Solutions Architect", match: "88%", ats: "85" },
    solutions: { title: "Solutions Architect", match: "90%", ats: "86" },
    consulting: { title: "Management Consultant", match: "45%", ats: "42" },
    finance: { title: "Investment Analyst", match: "38%", ats: "35" },
    bizdev: { title: "Business Development Manager", match: "50%", ats: "48" },
    financial: { title: "Financial Analyst", match: "35%", ats: "32" },
    strategy: { title: "Strategy & Operations Lead", match: "52%", ats: "50" },
    vc: { title: "Venture Capital Analyst", match: "40%", ats: "36" },
    brand: { title: "Brand Strategist", match: "32%", ats: "28" },
    marketing: { title: "Digital Marketing Manager", match: "30%", ats: "25" }
  };

  const currentRole = roleMapping[selectedDomain] || roleMapping.fullstack;
  const critiqueGroupKey = domainToCritiqueGroup[selectedDomain] || 'default';

  // Dynamic bindings
  const displayATS = apiData ? apiData.atsScore : currentRole.ats;
  const displayMatch = apiData ? `${apiData.roleMatch}%` : currentRole.match;
  const displayName = apiData ? apiData.candidateName : (sessionStorage.getItem('userName') || 'Alex Rivera');
  const displayExperience = apiData ? apiData.experienceYears : (sessionStorage.getItem('userExperience') || '0 Yrs');
  const displayEducation = apiData ? apiData.highestEducation : (sessionStorage.getItem('userEducation') || 'B.S. Computer Science');
  const critiques = apiData ? apiData.critique : critiqueData[critiqueGroupKey];
  const displayGapAdvice = apiData ? apiData.gapAdvice : `Limited "System Design" experience detected. Focus on Scalability questions.`;
  const rawKeywords = apiData ? apiData.atsKeywords : ["Distributed Systems", "Redis Cache Shards", "CI/CD Security", "WebRTC Peer Media"];
  const displayATSKeywords = Array.isArray(rawKeywords)
    ? rawKeywords
    : typeof rawKeywords === 'string'
      ? rawKeywords.split(',').map(k => k.trim()).filter(Boolean)
      : ["Distributed Systems", "Redis Cache Shards", "CI/CD Security", "WebRTC Peer Media"];

  // Simulator details handler
  const handleDomainChange = (e) => {
    setSelectedDomain(e.target.value);
    sessionStorage.setItem('userDomain', e.target.value);
  };

  // Scanning simulation trigger
  const handleScan = async (file) => {
    if (!file && inputMethod === 'file') {
      triggerFileSelect();
      return;
    }
    if (inputMethod === 'text' && !pastedText.trim()) {
      setErrorMsg("Please paste some resume text to analyze.");
      return;
    }

    setScanState('scanning');
    setProgress(0);
    setStatusLabel('Uploading resume data...');
    setErrorMsg("");
    setApiData(null);

    let simulatedProgress = 0;
    const progressInterval = setInterval(() => {
      simulatedProgress += 3;
      if (simulatedProgress >= 90) {
        clearInterval(progressInterval);
        simulatedProgress = 90;
      }
      setProgress(simulatedProgress);

      if (simulatedProgress === 15) {
        setStatusLabel(inputMethod === 'file' ? 'Uploading file to parser...' : 'Uploading text data...');
      } else if (simulatedProgress === 36) {
        setStatusLabel(inputMethod === 'file' ? 'Parsing document text layers...' : 'Formatting text inputs...');
      } else if (simulatedProgress === 54) {
        setStatusLabel('Consulting Gemini AI engine...');
      } else if (simulatedProgress === 72) {
        setStatusLabel('Analyzing layout and ATS constraints...');
      } else if (simulatedProgress === 87) {
        setStatusLabel('Finalizing critique logs...');
      }
    }, 100);

    try {
      let response;
      const userEmail = sessionStorage.getItem('userEmail');
      if (inputMethod === 'file') {
        const formData = new FormData();
        formData.append('resume', file);
        formData.append('domain', selectedDomain);
        if (userEmail) {
          formData.append('email', userEmail);
        }

        response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/analyze-resume`, {
          method: 'POST',
          body: formData
        });
      } else {
        response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/analyze-resume`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            domain: selectedDomain,
            resumeText: pastedText,
            email: userEmail
          })
        });
      }

      const data = await response.json();
      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze resume. Please try again.");
      }

      setProgress(100);
      setStatusLabel('Analysis complete!');
      setApiData(data);
      sessionStorage.setItem('resumeAnalysisResult', JSON.stringify(data));
      if (window.addIntervflowNotification) {
        window.addIntervflowNotification(
          'Resume Analyzed Successfully',
          `Your resume achieved an ATS Score of ${data.atsScore || 0}% for the target domain: ${selectedDomain.toUpperCase()}.`,
          'verified',
          'text-emerald-400'
        );
      }

      if (data.generalQuestions && data.technicalQuestions) {
        sessionStorage.setItem('generatedQuestions', JSON.stringify({
          general: data.generalQuestions,
          technical: data.technicalQuestions
        }));
      }

      if (data.candidateName) sessionStorage.setItem('userName', data.candidateName);
      if (data.experienceYears) sessionStorage.setItem('userExperience', data.experienceYears);
      if (data.highestEducation) sessionStorage.setItem('userEducation', data.highestEducation);
      if (data.atsScore) sessionStorage.setItem('userATS', data.atsScore.toString());
      if (data.roleMatch) sessionStorage.setItem('userMatch', data.roleMatch.toString());
      if (data.extractedText) sessionStorage.setItem('extractedResumeText', data.extractedText);
      
      setTimeout(() => {
        setScanState('completed');
      }, 500);

    } catch (err) {
      clearInterval(progressInterval);
      setScanState('idle');
      setErrorMsg(err.message || "Network error. Please make sure the backend server is running.");
      console.error("Resume analysis failed:", err);
    }
  };

  // Click handler to open file explorer
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleScan(file);
    }
  };

  // Reset scan parameters
  const handleRefine = () => {
    setScanState('idle');
    setProgress(0);
    setQaMessages([
      { sender: 'bot', text: "Ask me anything about your resume! For example: 'What are the top 3 gaps I should fix?' or 'How can I make my experience descriptions sound stronger?'" }
    ]);
  };

  // Generate technical questions
  const handleGenerateQuestions = () => {
    navigate('/dashboard');
  };

  // Chatbot Q&A trigger
  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!userQuestion.trim()) return;

    const questionText = userQuestion;
    setUserQuestion("");
    setQaMessages(prev => [...prev, { sender: 'user', text: questionText }]);
    setIsQaLoading(true);

    try {
      const resumeContext = apiData?.extractedText || pastedText || "Empty Resume";
      
      const userName = sessionStorage.getItem('userName') || '';
      const userDomain = sessionStorage.getItem('userDomain') || 'fullstack';
      const userExperience = sessionStorage.getItem('userExperience') || '';
      const userEducation = sessionStorage.getItem('userEducation') || '';
      const userTargetCompany = sessionStorage.getItem('userTargetCompany') || '';
      const userATS = sessionStorage.getItem('userATS') || '';
      const userMatch = sessionStorage.getItem('userMatch') || '';
      
      const userProfile = {
        name: userName,
        domain: userDomain,
        experience: userExperience,
        education: userEducation,
        dreamCompany: userTargetCompany,
        atsScore: userATS,
        roleMatch: userMatch
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/query-resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resumeText: resumeContext,
          question: questionText,
          userProfile
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to query resume.");
      }
      setQaMessages(prev => [...prev, { sender: 'bot', text: data.answer }]);
    } catch (err) {
      console.error("AI Q&A error:", err);
      setQaMessages(prev => [...prev, { sender: 'bot', text: "Sorry, I encountered an error answering your question. Please make sure the backend server is running." }]);
    } finally {
      setIsQaLoading(false);
    }
  };

  return (
    <div className="bg-[#09090b] text-[#e5e1e4] min-h-screen flex flex-col relative overflow-x-hidden pt-24 font-body-md text-left">
      {/* Atmosphere Glow */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-radial-gradient"
        style={{
          background: 'radial-gradient(circle at 15% 15%, rgba(37,99,235,0.04) 0%, transparent 40%), radial-gradient(circle at 85% 85%, rgba(221,183,255,0.04) 0%, transparent 40%)'
        }}
      />

      {/* Header */}
      <DashboardNavbar activeTab="resume" />

      {/* Main Content container */}
      <main className="flex-grow flex flex-col items-center justify-start w-full max-w-[1400px] mx-auto px-6 pt-2 pb-12 md:pt-4 md:pb-20 z-10 relative">
        
        {/* Hero Banner Section */}
        <section className="max-w-4xl w-full text-center mb-16 flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6 shadow-[0_0_15px_rgba(37,99,235,0.15)]">
            <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            <span className="text-xs text-primary uppercase tracking-widest font-mono font-bold">AI-Powered Extraction</span>
          </div>
          <h1 className="font-bold text-5xl md:text-6xl text-white leading-tight mb-4" style={{ textShadow: '0 0 30px rgba(37,99,235,0.2)' }}>
            AI Resume Analysis
          </h1>
          <p className="text-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            Upload your resume to generate hyper-tailored technical and behavioral questions that reflect your specific career journey and skills.
          </p>
        </section>

        {/* --- IDLE STATE --- */}
        {scanState === 'idle' && (
          <section className="max-w-3xl w-full mb-12 space-y-6">
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-xs text-red-400 flex items-start gap-3">
                <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
                <div>
                  <strong className="block font-bold mb-0.5">Analysis Failed</strong>
                  <span>{errorMsg}</span>
                </div>
              </div>
            )}
            
            {/* Domain Selection panel */}
            <div className="glass-panel rounded-2xl p-6 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#18181b]/40">
              <div className="space-y-1">
                <h3 className="text-body-md font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">category</span>
                  Target Job Role / Domain
                </h3>
                <p className="text-xs text-on-surface-variant">Select the target job domain for precise ATS score tuning.</p>
              </div>
              <div className="relative min-w-[240px] w-full sm:w-auto">
                <select 
                  className="glass-input w-full appearance-none rounded-xl px-4 py-3 text-sm text-white pr-10 focus:border-primary focus:ring-1 focus:ring-primary/50 bg-[#09090b]"
                  value={selectedDomain}
                  onChange={handleDomainChange}
                >
                  <optgroup className="bg-[#09090b] text-primary font-bold" label="Technology & Engineering">
                    <option className="bg-[#09090b] text-on-surface" value="backend">Backend Engineer</option>
                    <option className="bg-[#09090b] text-on-surface" value="frontend">Frontend Engineer</option>
                    <option className="bg-[#09090b] text-on-surface" value="fullstack">Fullstack Engineer</option>
                    <option className="bg-[#09090b] text-on-surface" value="mobile">Mobile Developer (iOS/Android)</option>
                    <option className="bg-[#09090b] text-on-surface" value="devops">DevOps & Infrastructure</option>
                    <option className="bg-[#09090b] text-on-surface" value="ml">Machine Learning / AI Engineer</option>
                    <option className="bg-[#09090b] text-on-surface" value="dataeng">Data Engineer</option>
                    <option className="bg-[#09090b] text-on-surface" value="security">Security / AppSec Engineer</option>
                    <option className="bg-[#09090b] text-on-surface" value="sdet">QA / SDET Engineer</option>
                    <option className="bg-[#09090b] text-on-surface" value="swe">Software Engineer (General)</option>
                    <option className="bg-[#09090b] text-on-surface" value="pm">Product Manager</option>
                    <option className="bg-[#09090b] text-on-surface" value="em">Engineering Manager</option>
                    <option className="bg-[#09090b] text-on-surface" value="ds">Data Scientist</option>
                    <option className="bg-[#09090b] text-on-surface" value="design">UX/UI Designer</option>
                    <option className="bg-[#09090b] text-on-surface" value="cloud">Cloud Architect</option>
                    <option className="bg-[#09090b] text-on-surface" value="solutions">Solutions Architect</option>
                  </optgroup>
                  <optgroup className="bg-[#09090b] text-primary font-bold" label="Business & Finance">
                    <option className="bg-[#09090b] text-on-surface" value="consulting">Management Consultant</option>
                    <option className="bg-[#09090b] text-on-surface" value="finance">Investment Analyst</option>
                    <option className="bg-[#09090b] text-on-surface" value="bizdev">Business Developer</option>
                    <option className="bg-[#09090b] text-on-surface" value="financial">Financial Analyst</option>
                    <option className="bg-[#09090b] text-on-surface" value="strategy">Strategy & Operations</option>
                    <option className="bg-[#09090b] text-on-surface" value="vc">Venture Capital Analyst</option>
                  </optgroup>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[20px]">keyboard_arrow_down</span>
                </div>
              </div>
            </div>

            {/* Input Method Switcher */}
            <div className="flex justify-center w-full mb-8">
              <div className="flex bg-[#1E1B4B]/20 p-1.5 rounded-full border border-[#1E1B4B]/50 shadow-[0_0_15px_rgba(30,27,75,0.3)]">
                <button 
                  onClick={() => { setInputMethod('file'); setErrorMsg(""); }}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-semibold tracking-wider transition-all border-none cursor-pointer ${
                    inputMethod === 'file' 
                      ? 'text-white bg-[#1E1B4B] shadow-[0_0_10px_rgba(30,27,75,0.6)]' 
                      : 'text-on-surface-variant/75 hover:text-white bg-transparent'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                  Upload PDF / DOCX
                </button>
                <button 
                  onClick={() => { setInputMethod('text'); setErrorMsg(""); }}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-semibold tracking-wider transition-all border-none cursor-pointer ${
                    inputMethod === 'text' 
                      ? 'text-white bg-[#1E1B4B] shadow-[0_0_10px_rgba(30,27,75,0.6)]' 
                      : 'text-on-surface-variant/75 hover:text-white bg-transparent'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">edit_note</span>
                  Paste Resume Text
                </button>
              </div>
            </div>

            {inputMethod === 'file' ? (
              /* Upload Zone Card */
              <div 
                onClick={triggerFileSelect}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`glass-panel group cursor-pointer relative rounded-2xl border-dashed border-2 transition-all p-12 flex flex-col items-center justify-center min-h-[340px] w-full ${
                  isDragging 
                    ? 'border-white/40 bg-white/[0.04] shadow-[0_0_20px_rgba(255,255,255,0.05)] animate-pulse' 
                    : 'border-white/10 hover:border-white/20 bg-[#18181b]/30'
                }`}
              >
                <div className="absolute inset-0 bg-white/[0.01] pointer-events-none group-hover:bg-white/[0.03] transition-colors rounded-2xl"></div>
                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-4xl text-white/60 group-hover:text-white transition-colors">upload_file</span>
                  </div>
                  <h3 className="font-headline-md text-headline-md text-white mb-2">Drop PDF or DOCX</h3>
                  <p className="font-body-md text-on-surface-variant mb-8">or click to browse your local files</p>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept=".pdf,.docx,.doc" 
                    className="hidden" 
                  />
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleScan(); }} 
                    className="btn-primary px-8 py-4 rounded-xl text-white font-bold flex items-center gap-3 cursor-pointer"
                  >
                    <span className="material-symbols-outlined">document_scanner</span>
                    Scan Resume
                  </button>
                </div>
              </div>
            ) : (
              /* Plain Text Paste Area */
              <div className="glass-panel rounded-2xl border border-white/10 p-6 bg-[#18181b]/30 flex flex-col gap-4 w-full">
                <div className="space-y-1">
                  <h3 className="text-body-md font-bold text-white">Paste Resume Plain Text</h3>
                  <p className="text-xs text-on-surface-variant">Copy and paste the entire text content of your resume below.</p>
                </div>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste your resume details here (experience, education, projects, skills)..."
                  rows={12}
                  className="w-full bg-[#09090b]/80 border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary/50 text-white rounded-xl p-4 text-xs font-body-md focus:outline-none resize-y"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => handleScan()}
                    className="btn-primary px-8 py-3.5 rounded-xl text-white font-bold flex items-center gap-2 cursor-pointer border-none"
                  >
                    <span className="material-symbols-outlined text-[18px]">bolt</span>
                    Analyze Resume Text
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* --- SCANNING STATE --- */}
        {scanState === 'scanning' && (
          <section className="max-w-3xl w-full mb-12">
            <div className="glass-panel rounded-2xl p-8 border border-primary/20 bg-[#18181b]/35 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <h4 className="font-bold text-sm text-primary mb-1">{statusLabel}</h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">Scanning document structure and parsing entities</p>
                </div>
                <span className="text-sm font-bold text-white font-mono">{progress}%</span>
              </div>
              
              {/* Progress bar track */}
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300 shadow-[0_0_12px_rgba(180,197,255,0.7)]" 
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Progress steps checklist */}
              <div className="mt-8 space-y-4">
                <div className={`flex items-center gap-3 transition-opacity duration-300 ${progress >= 40 ? 'opacity-60' : 'opacity-100'}`}>
                  <span className="material-symbols-outlined text-primary text-[20px]">{progress >= 40 ? 'check_circle' : 'sync'}</span>
                  <span className="text-xs text-white">Parsing PDF layers and text blocks</span>
                </div>
                <div className={`flex items-center gap-3 transition-opacity duration-300 ${progress >= 68 ? 'opacity-60' : progress >= 40 ? 'opacity-100' : 'opacity-40'}`}>
                  <span className="material-symbols-outlined text-primary text-[20px]">{progress >= 68 ? 'check_circle' : progress >= 40 ? 'sync' : 'circle'}</span>
                  <span className="text-xs text-white">Identifying experience gaps and role levels</span>
                </div>
                <div className={`flex items-center gap-3 transition-opacity duration-300 ${progress >= 100 ? 'opacity-60' : progress >= 68 ? 'opacity-100' : 'opacity-40'}`}>
                  <span className="material-symbols-outlined text-primary text-[20px]">{progress >= 100 ? 'check_circle' : progress >= 68 ? 'sync' : 'circle'}</span>
                  <span className="text-xs text-white">Cross-referencing tech stacks with industry benchmarks</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* --- COMPLETED PREVIEW STATE --- */}
        {scanState === 'completed' && (
          <section className="max-w-5xl w-full transition-all duration-700">
            {apiData?.provider === "groq" && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mb-8 flex items-center gap-3 text-left">
                <span className="material-symbols-outlined text-emerald-400 text-[20px] shrink-0">auto_awesome</span>
                <p className="text-xs text-emerald-300/80 font-medium">
                  Analysis powered by <strong className="text-emerald-300">Groq · Llama 3.3 70B</strong> — deep contextual ATS evaluation for the <strong className="text-emerald-300">{currentRole.title}</strong> role.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Extracted Data Reports */}
              <div className="lg:col-span-2 glass-card rounded-2xl p-8 border border-white/10 relative overflow-hidden bg-[#18181b]/30">
                <div className="absolute top-0 right-0 p-4">
                  <span className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] text-primary font-mono uppercase font-bold">High-Accuracy ATS Extraction</span>
                </div>
                
                <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                  
                  {/* Avatar and circular SVG ATS gauge */}
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-24 h-24 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 overflow-hidden">
                      <img alt="Profile" className="w-full h-full object-cover" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23374151'/%3E%3Cstop offset='100%25' style='stop-color:%231f2937'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' fill='url(%23bg)'/%3E%3Ccircle cx='50' cy='36' r='16' fill='%239ca3af'/%3E%3Cellipse cx='50' cy='80' rx='28' ry='20' fill='%239ca3af'/%3E%3C/svg%3E" />
                    </div>
                    
                    {/* Circular ATS Gauge */}
                    <div className="relative w-20 h-20">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path className="text-white/5 stroke-current" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="3"></path>
                        <path 
                          className="text-primary stroke-current" 
                          strokeDasharray={`${displayATS}, 100`}
                          strokeLinecap="round" 
                          strokeWidth="3" 
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                          fill="none"
                          style={{ filter: 'drop-shadow(0 0 6px rgba(37,99,235,0.6))' }}
                        ></path>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
                        <span className="text-xs font-bold text-primary">{displayATS}%</span>
                        <span className="text-[8px] text-on-surface-variant/70 uppercase font-bold tracking-wider">ATS</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 w-full text-center md:text-left">
                    <h2 className="font-headline-md text-headline-md text-white font-bold mb-1">{displayName}</h2>
                    <p className="text-sm text-primary font-bold mb-4">{currentRole.title}</p>
                    
                    <div className="grid grid-cols-3 gap-6 pt-4 border-t border-white/5">
                      <div>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1 font-mono font-bold">Experience</p>
                        <p className="text-lg font-bold text-white">{displayExperience}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1 font-mono font-bold">Role Match</p>
                        <p className="text-lg font-bold text-white">{displayMatch}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1 font-mono font-bold">Education</p>
                        <p className="text-xs text-white leading-relaxed pt-1">{displayEducation}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grammar mistakes and improvement logs */}
                <div className="mt-8 pt-6 border-t border-white/5 space-y-4 text-left">
                  <p className="text-[10px] text-on-surface-variant font-mono font-bold uppercase tracking-widest mb-2">Detailed Resume Critique & ATS Gaps</p>
                  
                  <div className="flex flex-col gap-6 mt-6">
                    {/* Grammar & Style Card */}
                    <div className="bg-red-500/5 hover:bg-red-500/10 transition-all duration-300 rounded-2xl p-5 border border-red-500/10 hover:border-red-500/25 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2.5 text-red-400 mb-4">
                          <span className="material-symbols-outlined text-[22px]">spellcheck</span>
                          <span className="text-xs font-mono font-bold uppercase tracking-wider">Grammar & Style</span>
                        </div>
                        <ul className="space-y-4 text-xs text-on-surface-variant leading-relaxed">
                          {critiques.grammar.map((item) => (
                            <li key={item.id} className="flex items-start gap-2.5">
                              <span className={`material-symbols-outlined text-[16px] mt-0.5 shrink-0 ${item.type === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
                                {item.type === 'error' ? 'cancel' : 'warning'}
                              </span>
                              <div>
                                <strong className="text-white block mb-0.5">{item.title}</strong>
                                <span className="text-on-surface-variant/90">{item.text}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Technical & Stack Card */}
                    <div className="bg-blue-500/5 hover:bg-blue-500/10 transition-all duration-300 rounded-2xl p-5 border border-blue-500/10 hover:border-blue-500/25 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2.5 text-blue-400 mb-4">
                          <span className="material-symbols-outlined text-[22px]">terminal</span>
                          <span className="text-xs font-mono font-bold uppercase tracking-wider">Technical & Stack</span>
                        </div>
                        <ul className="space-y-4 text-xs text-on-surface-variant leading-relaxed">
                          {critiques.technical.map((item) => (
                            <li key={item.id} className="flex items-start gap-2.5">
                              <span className={`material-symbols-outlined text-[16px] mt-0.5 shrink-0 ${item.type === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
                                {item.type === 'error' ? 'cancel' : 'warning'}
                              </span>
                              <div>
                                <strong className="text-white block mb-0.5">{item.title}</strong>
                                <span className="text-on-surface-variant/90">{item.text}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Quantitative Impact Card */}
                    <div className="bg-emerald-500/5 hover:bg-emerald-500/10 transition-all duration-300 rounded-2xl p-5 border border-emerald-500/10 hover:border-emerald-500/25 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2.5 text-emerald-400 mb-4">
                          <span className="material-symbols-outlined text-[22px]">trending_up</span>
                          <span className="text-xs font-mono font-bold uppercase tracking-wider">Quantitative Impact (XYZ)</span>
                        </div>
                        <ul className="space-y-4 text-xs text-on-surface-variant leading-relaxed">
                          {critiques.impact.map((item) => (
                            <li key={item.id} className="flex items-start gap-2.5">
                              <span className={`material-symbols-outlined text-[16px] mt-0.5 shrink-0 ${item.type === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
                                {item.type === 'error' ? 'cancel' : 'warning'}
                              </span>
                              <div>
                                <strong className="text-white block mb-0.5">{item.title}</strong>
                                <span className="text-on-surface-variant/90">{item.text}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* ATS Layout & Format Card */}
                    <div className="bg-amber-500/5 hover:bg-amber-500/10 transition-all duration-300 rounded-2xl p-5 border border-amber-500/10 hover:border-amber-500/25 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2.5 text-amber-400 mb-4">
                          <span className="material-symbols-outlined text-[22px]">grid_view</span>
                          <span className="text-xs font-mono font-bold uppercase tracking-wider">ATS Layout & Format</span>
                        </div>
                        <ul className="space-y-4 text-xs text-on-surface-variant leading-relaxed">
                          {critiques.formatting.map((item) => (
                            <li key={item.id} className="flex items-start gap-2.5">
                              <span className={`material-symbols-outlined text-[16px] mt-0.5 shrink-0 ${item.type === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
                                {item.type === 'error' ? 'cancel' : 'warning'}
                              </span>
                              <div>
                                <strong className="text-white block mb-0.5">{item.title}</strong>
                                <span className="text-on-surface-variant/90">{item.text}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expandable Extracted Resume Transcript */}
                <div className="mt-8 pt-6 border-t border-white/5 text-left w-full">
                  <details className="group glass-card rounded-xl border border-white/10 bg-[#09090b]/40 overflow-hidden">
                    <summary className="flex items-center justify-between p-4 cursor-pointer text-xs font-bold text-white hover:bg-white/5 transition-colors select-none">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[20px]">receipt_long</span>
                        <span>View Parsed Resume Transcript</span>
                      </div>
                      <span className="material-symbols-outlined transition-transform duration-300 group-open:rotate-180 text-on-surface-variant">expand_more</span>
                    </summary>
                    <div className="p-4 border-t border-white/10 bg-[#09090b]/80 max-h-[300px] overflow-y-auto font-mono text-[10px] text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                      {apiData?.extractedText || pastedText || "No text content found."}
                    </div>
                  </details>
                </div>
              </div>

              {/* Sidebar Action Cards */}
              <div className="lg:col-span-1 flex flex-col gap-6 h-fit">
                
                {/* Ready prep CTA */}
                <div className="glass-card rounded-2xl p-8 border border-primary/20 bg-primary/5 flex flex-col gap-6 shadow-[0_4px_30px_rgba(0,0,0,0.3)] text-left">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Ready to Prep?</h3>
                    <p className="text-xs text-on-surface-variant leading-relaxed">We've identified {apiData?.technicalQuestions?.length || 10} high-priority technical questions and {apiData?.generalQuestions?.length || 10} leadership scenarios based on your background.</p>
                  </div>
                  <div className="space-y-3">
                    <button 
                      onClick={handleGenerateQuestions}
                      className="w-full btn-primary py-4 text-xs font-bold rounded-xl text-white flex items-center justify-center gap-2 border-none"
                    >
                      <span className="material-symbols-outlined text-[20px]">bolt</span>
                      Generate Questions
                    </button>
                    <button 
                      onClick={handleRefine}
                      className="w-full btn-secondary py-3 text-xs font-bold rounded-xl"
                    >
                      Refine Parameters
                    </button>
                  </div>
                </div>

                {/* Gap advice badge */}
                <div className="glass-card rounded-xl p-6 border border-white/5 bg-[#18181b]/40 text-left">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-amber-500/10 shrink-0">
                      <span className="material-symbols-outlined text-amber-400 text-lg">lightbulb</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Gap Area Found</p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">{displayGapAdvice}</p>
                    </div>
                  </div>
                </div>

                {/* Recommended keywords to add */}
                <div className="glass-card rounded-xl p-6 border border-primary/20 bg-black/25 text-left">
                  <p className="text-[10px] text-primary uppercase tracking-widest font-mono font-bold mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                    ATS Keyword Additions
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {displayATSKeywords.map((kw, idx) => (
                      <span key={idx} className="text-[9px] px-2 py-1 bg-primary/10 border border-primary/20 rounded text-primary font-mono">
                        + "{kw}"
                      </span>
                    ))}
                  </div>
                </div>

                {/* AI Resume Chatbot Q&A */}
                <div className="glass-card rounded-2xl p-6 border border-primary/20 bg-[#1e1b4b]/10 flex flex-col gap-4 shadow-lg text-left">
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#818cf8] text-[20px]">forum</span>
                      Ask AI about your Resume
                    </h3>
                    <p className="text-[10px] text-on-surface-variant mt-1 leading-normal">Ask questions, request rewrites, or query specific tech stack gaps directly from this analysis.</p>
                  </div>
                  
                  {/* Chat messages */}
                  <div className="flex flex-col gap-2.5 max-h-[200px] overflow-y-auto bg-black/40 border border-white/5 rounded-xl p-3 scrollbar-thin">
                    {qaMessages.map((msg, idx) => (
                      <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`px-3 py-2 rounded-xl text-[10px] leading-relaxed max-w-[85%] ${msg.sender === 'user' ? 'bg-[#1e1b4b] text-[#818cf8] border border-[#818cf8]/25' : 'bg-white/5 text-on-surface-variant'}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isQaLoading && (
                      <div className="flex items-center gap-2 text-[9px] text-[#818cf8]">
                        <span className="material-symbols-outlined animate-spin text-[12px]">sync</span>
                        <span>AI is thinking...</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Form input */}
                  <form onSubmit={handleAskQuestion} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={userQuestion}
                      onChange={(e) => setUserQuestion(e.target.value)}
                      placeholder="Ask a question..."
                      className="flex-grow bg-[#09090b]/80 border border-white/10 focus:border-primary text-[10px] rounded-lg px-2.5 py-1.5 text-white placeholder-on-surface-variant/50 focus:outline-none"
                    />
                    <button 
                      type="submit" 
                      disabled={isQaLoading || !userQuestion.trim()}
                      className="w-7 h-7 rounded-lg bg-[#1e1b4b] text-[#818cf8] hover:bg-[#1e1b4b]/80 border border-[#818cf8]/20 flex items-center justify-center cursor-pointer transition-all disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-[14px]">send</span>
                    </button>
                  </form>
                </div>

              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />

      {/* Floating doubt chatbot */}
      <Chatbot />
    </div>
  );
}
