import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

export default function Dashboard() {
  const navigate = useNavigate();
  
  // User info from auth simulation
  const [userName, setUserName] = useState("Chaitanya");
  const [userDomain, setUserDomain] = useState("se");
  const [atsScore, setAtsScore] = useState("84");
  const [userExperience, setUserExperience] = useState("0 Yrs");
  const [userEducation, setUserEducation] = useState("B.S. Computer Science");
  const [userDreamCompany, setUserDreamCompany] = useState("Google");
  const [activeSidebarTab, setActiveSidebarTab] = useState("dashboard");
  
  // Navbar active tab state (for active class matching)
  const [activeNavTab, setActiveNavTab] = useState("dashboard");

  const [generalQuestions, setGeneralQuestions] = useState([]);
  const [technicalQuestions, setTechnicalQuestions] = useState([]);
  const [hasScanQuestions, setHasScanQuestions] = useState(false);
  const [questionsExpanded, setQuestionsExpanded] = useState(false);

  // Mock interview sessions & analytics
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [averageMockScore, setAverageMockScore] = useState(null);
  const [totalSpeechHours, setTotalSpeechHours] = useState("0");
  const [recommendedJob, setRecommendedJob] = useState(null);

  const [claimedTimeline, setClaimedTimeline] = useState(
    localStorage.getItem('intervflow_timeline_claimed') === 'true'
  );

  const claimTimelineBonus = () => {
    if (sessions.length < 15) {
      alert(`You have completed ${sessions.length}/15 mock interview sessions. Please complete 15 sessions to claim the XP Bonus!`);
      return;
    }
    if (claimedTimeline) return;

    const currentXp = parseInt(localStorage.getItem('intervflow_user_xp') || '750', 10);
    const newXp = currentXp + 500;
    localStorage.setItem('intervflow_user_xp', String(newXp));
    localStorage.setItem('intervflow_timeline_claimed', 'true');
    setClaimedTimeline(true);

    // Trigger navbar XP refresh
    window.dispatchEvent(new Event('intervflow-xp-update'));

    // Trigger global notification
    if (window.addIntervflowNotification) {
      window.addIntervflowNotification(
        'Practice Challenge Completed!',
        'Outstanding work! You completed the 15-day interview practice challenge and earned +500 XP.',
        'celebration',
        'text-amber-400'
      );
    }
  };

  // Fetch recommended job matching candidate settings
  useEffect(() => {
    const fetchRecommendedJob = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await fetch(`${API_URL}/api/jobs`);
        const data = await res.json();
        if (data.success && Array.isArray(data.jds) && data.jds.length > 0) {
          const targetCompany = sessionStorage.getItem('userTargetCompany') || userDreamCompany || '';
          const targetDomain = sessionStorage.getItem('userDomain') || userDomain || '';
          
          let matchingJob = null;
          if (targetCompany) {
            matchingJob = data.jds.find(j => 
              j.company.toLowerCase().includes(targetCompany.toLowerCase())
            );
          }
          if (!matchingJob && targetDomain) {
            matchingJob = data.jds.find(j => 
              j.title.toLowerCase().includes(targetDomain.toLowerCase())
            );
          }
          setRecommendedJob(matchingJob || data.jds[0]);
        }
      } catch (err) {
        console.error("Failed to fetch recommended job:", err);
      }
    };
    fetchRecommendedJob();
  }, [userDreamCompany, userDomain]);

  const handleStartInterview = (jd) => {
    navigate('/practice', {
      state: {
        jobTitle: jd.title,
        jdText: jd.jdText,
        company: jd.company,
        jdId: jd.id || jd._id || '',
        customSystemPrompt: jd.customSystemPrompt || '',
        customQuestions: jd.customQuestions || [],
        duration: jd.duration || 15,
        mode: 'jd'
      }
    });
  };

  const handleSaveSettings = (newName, newDomain, newATS, newExperience, newEducation, newDreamCompany) => {
    setUserName(newName);
    setUserDomain(newDomain);
    setAtsScore(newATS);
    setUserExperience(newExperience);
    setUserEducation(newEducation);
    setUserDreamCompany(newDreamCompany);
    
    sessionStorage.setItem('userName', newName);
    sessionStorage.setItem('userDomain', newDomain);
    sessionStorage.setItem('userATS', newATS);
    sessionStorage.setItem('userExperience', newExperience);
    sessionStorage.setItem('userEducation', newEducation);
    sessionStorage.setItem('userTargetCompany', newDreamCompany);

    const rMap = roleMapping[newDomain] || roleMapping.fullstack;
    sessionStorage.setItem('userMatch', rMap.match);

    const cachedAnalysis = sessionStorage.getItem('resumeAnalysisResult');
    if (cachedAnalysis) {
      try {
        const parsed = JSON.parse(cachedAnalysis);
        parsed.candidateName = newName;
        parsed.atsScore = parseInt(newATS);
        parsed.experienceYears = newExperience;
        parsed.highestEducation = newEducation;
        parsed.roleMatch = parseInt(rMap.match.replace('%', ''));
        sessionStorage.setItem('resumeAnalysisResult', JSON.stringify(parsed));
      } catch (e) {}
    }

    alert("Settings saved successfully!");
  };

  // Load user details and interview questions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const userEmail = sessionStorage.getItem('userEmail') || '';
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await fetch(`${API_URL}/api/interview/sessions?email=${encodeURIComponent(userEmail)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.sessions)) {
          setSessions(data.sessions);
          
          // Compute average score of completed interviews that have a score
          const scoredSessions = data.sessions.filter(s => s.report && typeof s.report.score === 'number');
          if (scoredSessions.length > 0) {
            const sum = scoredSessions.reduce((acc, curr) => acc + curr.report.score, 0);
            const avg = Math.round(sum / scoredSessions.length);
            setAverageMockScore(avg);
          }

          // Calculate total speech hours dynamically
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
        console.error("Failed to load interview sessions on dashboard:", err);
      } finally {
        setLoadingSessions(false);
      }
    };
    fetchSessions();

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

    const cachedQuestions = sessionStorage.getItem('generatedQuestions');
    if (cachedQuestions) {
      try {
        const parsed = JSON.parse(cachedQuestions);
        if (parsed.general && parsed.technical) {
          setGeneralQuestions(parsed.general);
          setTechnicalQuestions(parsed.technical);
          setHasScanQuestions(true);
          return;
        }
      } catch (e) {
        console.error("Failed to parse cached questions", e);
      }
    }

    // Default questions fallback if no scan questions exist yet
    const defaultQuestionsDb = {
      backend: {
        general: [
          "Tell me about a time when you had to debug a complex production issue under tight time constraints.",
          "How do you handle disagreements with team members regarding architectural decisions or database schema design?",
          "Describe a project where you had to quickly learn and adopt a new backend technology or framework.",
          "How do you handle technical debt while keeping up with a fast-paced product delivery schedule?",
          "Talk about a time when you made a major mistake in a database query or code deployment and how you mitigated the impact.",
          "How do you approach mentoring junior developers or conducting constructive code reviews?",
          "Tell me about a time you had to optimize resource costs on a cloud hosting provider.",
          "Describe a time you collaborated with product managers to refine technical specifications for a feature.",
          "How do you handle situations where a library or third-party service you depend on goes down or has breaking changes?",
          "Tell me about a time you had to refactor critical path code that had no tests."
        ],
        technical: [
          "Explain how you would design a highly available, read-heavy caching layer using Redis for a social media feed.",
          "What database indexing strategies would you employ to prevent write-locks in a high-throughput transaction ledger?",
          "How do you approach database schema normalization vs. denormalization, and how do you decide when to use a NoSQL database?",
          "How do you design a secure, distributed locking mechanism across microservices using Redis or Zookeeper?",
          "Explain the difference between SQL transactions (ACID properties) and NoSQL BASE properties, and how you ensure consistency.",
          "How does a message broker like Kafka ensure ordered processing of events across multiple consumer instances?",
          "What is database partitioning vs. sharding, and how do you choose the partition key?",
          "Explain the execution flow of a connection pool and how you configure its min/max connection sizes.",
          "How would you secure a backend API against rate-limiting bypasses or credential stuffing attacks?",
          "Explain the differences between REST, gRPC, and GraphQL and when you would select each one for microservices communication."
        ]
      },
      frontend: {
        general: [
          "Describe a scenario where you had to collaborate closely with a UI/UX designer to translate a complex mockup into code.",
          "How do you prioritize page speed and user experience improvements when faced with feature delivery deadlines?",
          "Tell me about a time you had to deal with cross-browser compatibility issues or legacy frontend codebase migration.",
          "How do you advocate for web accessibility (a11y) standards within your development team?",
          "Describe a time when you refactored a legacy frontend code module to improve developer productivity.",
          "How do you handle disagreements on technical choices, like selecting state management or CSS tooling?",
          "Describe a time you solved an unexpected performance lag reported by real users on the client side.",
          "How do you approach writing clean, testable, and reusable UI components in a collaborative codebase?",
          "Tell me about a time you had to implement a complicated responsive layout with strict design specifications.",
          "How do you balance adding custom visual animations with maintaining loading speed on mobile viewports?"
        ],
        technical: [
          "How would you optimize Core Web Vitals (specifically LCP and CLS) for a high-traffic e-commerce landing page?",
          "Explain when you would choose React Context API versus a global state management library like Redux or Zustand.",
          "What rendering strategies (SSR, SSG, or client-side rendering) would you choose for a public-facing blog versus a dashboard?",
          "What is the critical rendering path, and how do you optimize CSS and JS execution to avoid blocking page paints?",
          "How do you manage client-side caching (Service Workers, HTTP cache headers, CDN caching) for high-performance websites?",
          "Explain the difference between virtualization (e.g. react-window) and standard rendering for extremely long lists.",
          "What is code-splitting, and how would you implement dynamic imports in a modern Bundling setup (Vite or Webpack)?",
          "How would you troubleshoot a memory leak occurring in a single-page application (SPA)?",
          "What are web workers, and in what scenarios would you offload computations to a web worker?",
          "How do you protect client-side web applications against common security concerns like XSS and CSRF?"
        ]
      },
      fullstack: {
        general: [
          "Describe a challenging feature you implemented that required modifying both the database/backend and the user interface.",
          "How do you stay up-to-date with both frontend and backend technology updates, and how do you decide what to implement?",
          "Explain a time when you had to balance building features quickly with maintaining code quality and write unit tests.",
          "How do you divide technical tasks between frontend and backend in a project under a tight deadline?",
          "Tell me about a time you helped resolve an engineering blocker that spanned both client and server teams.",
          "Describe a situation where you had to refactor a massive monolithic application into modular codebases.",
          "How do you manage communications when APIs you built are changing and break downstream consumer applications?",
          "Tell me about a time you made a compromise in frontend layout polish to meet a critical backend deadline.",
          "Describe a time you handled a critical security vulnerability discovered in an open-source dependency you used.",
          "How do you balance learning deep specialization vs. broad knowledge as a full-stack engineer?"
        ],
        technical: [
          "Explain the steps involved in implementing a real-time web application using WebSockets or Server-Sent Events from frontend to backend.",
          "How would you design a secure user authentication flow using JWTs, including storage on the client side and verification on the server?",
          "What are the common performance bottlenecks in full-stack applications, and how do you use profiling/debugging tools to locate them?",
          "Explain the differences in session management and security between HTTP cookies and JWT tokens stored in localStorage.",
          "How would you set up an end-to-end telemetry system to track API latency, error rates, and client-side page load times?",
          "Explain CORS (Cross-Origin Resource Sharing) in detail and how you would configure it on the server and client.",
          "How would you design a database schema and associated API endpoints for a collaborative real-time document editor?",
          "What is connection pooling, and why is it essential for serverless backend functions connecting to relational databases?",
          "Explain how you would write an integration test suite that tests both the database state and the frontend rendering.",
          "How would you implement a robust data pagination, sorting, and filtering mechanism across client, server, and SQL database?"
        ]
      },
      ml: {
        general: [
          "How do you explain complex machine learning model decisions or statistical findings to non-technical business stakeholders?",
          "Tell me about a time when a model you built did not perform as expected in production, and how you diagnosed and resolved the issue.",
          "Describe how you balance research/experimental modeling with practical engineering and deployment constraints.",
          "How do you decide between building a custom ML model versus using a pre-trained API or cloud service?",
          "Talk about a time when a model showed high accuracy during offline training but degraded significantly in production.",
          "How do you stay updated with the rapid changes and weekly preprints in the AI/ML landscape?",
          "Describe a time you had to build a dataset from scratch and clean up noisy, contradictory labels.",
          "Explain how you prioritize which machine learning projects to pursue based on business ROI vs. technical feasibility.",
          "Tell me about a time you had to deal with severe class imbalance in a dataset and how you set up your validation split.",
          "Describe how you collaborate with backend engineers to integrate your model endpoints into user-facing products."
        ],
        technical: [
          "Explain the difference between bagging and boosting algorithms, and give an example scenario where you would prefer one over the other.",
          "How would you design and implement a real-time inference pipeline for a large language model using FastAPI and Triton/Docker?",
          "What evaluation metrics (F1-score, ROC-AUC, MAE, etc.) would you use to measure a class-imbalanced fraud detection model, and why?",
          "How do you handle feature engineering and data preprocessing at scale using tools like Spark or pandas?",
          "What is data drift and concept drift, and how do you implement monitoring to detect them in production ML systems?",
          "Explain the mathematical differences between L1 (Lasso) and L2 (Ridge) regularization and how they affect model weights.",
          "How would you fine-tune a pre-trained transformer model (e.g. BERT/Llama) on a domain-specific text classification task?",
          "What is the vanishing/exploding gradient problem in deep networks, and what techniques do we use to prevent it?",
          "Explain the process of quantization and pruning, and how they assist in deploying models to edge devices.",
          "How does the attention mechanism in transformers work, and how does it differ from traditional recurrent networks (LSTMs)?"
        ]
      },
      pm: {
        general: [
          "How do you handle prioritizing competing feature requests from multiple key stakeholders under limited engineering bandwidth?",
          "Describe a time when a product launch didn't go as planned or missed its key metrics, and what you learned from the experience.",
          "How do you align cross-functional teams (design, engineering, marketing) around a single product roadmap vision?",
          "How do you decide when to kill a feature or product that is underperforming?",
          "Describe a time when you had to say no to a high-priority customer request to focus on the core product vision.",
          "How do you conduct customer discovery interviews without leading the user to confirm your pre-conceived features?",
          "Tell me about a time you had to resolve a severe technical disagreement between design and engineering teams.",
          "Describe a time when you used quantitative data to disprove a strongly held opinion of an executive stakeholder.",
          "How do you ensure your product is accessible and inclusive to diverse user demographics?",
          "Describe how you structure a Product Requirements Document (PRD) to ensure the engineering team has full clarity."
        ],
        technical: [
          "What key metrics (conversion rate, retention, DAU/MAU) would you track for a new AI-powered search tool, and how would you set OKRs?",
          "Explain how you would design and analyze an A/B test for a core checkout page modification to ensure statistical significance.",
          "How do you approach managing technical debt with your engineering lead while still delivering business value?",
          "How do you use telemetry and SQL queries to perform funnel analysis and locate drop-offs in an onboarding flow?",
          "What is the difference between leading and lagging indicators, and how do you select KPIs for a marketplace model?",
          "Explain how you would run a cohort retention analysis to see if a newly launched feature is driving repeat usage.",
          "How would you estimate the market size (TAM, SAM, SOM) for a new developer tool targeted at mobile developers?",
          "Describe how you calculate Customer Acquisition Cost (CAC) and Customer Lifetime Value (LTV), and what ratio is considered healthy.",
          "How do you conduct competitive analysis, and what frameworks (like SWOT or Porter's Five Forces) do you find most useful?",
          "If you saw a sudden 15% drop in daily active users for a messaging app, outline your step-by-step diagnostic sequence."
        ]
      }
    };

    // Find closest domain group
    const domainKey = (domain || 'swe').toLowerCase();
    let selectedGroup = 'fullstack';
    if (['backend', 'devops', 'dataeng', 'cloud', 'solutions', 'security'].includes(domainKey)) {
      selectedGroup = 'backend';
    } else if (['frontend', 'design'].includes(domainKey)) {
      selectedGroup = 'frontend';
    } else if (['fullstack', 'swe', 'mobile', 'sdet'].includes(domainKey)) {
      selectedGroup = 'fullstack';
    } else if (['ml', 'ds'].includes(domainKey)) {
      selectedGroup = 'ml';
    } else if (['pm', 'em'].includes(domainKey)) {
      selectedGroup = 'pm';
    }

    const defaultQuestions = defaultQuestionsDb[selectedGroup] || defaultQuestionsDb.fullstack;
    setGeneralQuestions(defaultQuestions.general);
    setTechnicalQuestions(defaultQuestions.technical);
    setHasScanQuestions(false);
  }, [userDomain, atsScore, userName, userExperience, userEducation, userDreamCompany]);

  // Get combined resume and interview analysis data
  const getResumeAnalysis = () => {
    const cachedAnalysis = sessionStorage.getItem('resumeAnalysisResult');
    if (cachedAnalysis) {
      try {
        return JSON.parse(cachedAnalysis);
      } catch (e) {}
    }
    
    // Fallback based on domain
    const dKey = (userDomain || 'fullstack').toLowerCase();
    const expectations = critiqueData[dKey] || critiqueData.fullstack;
    const ats = atsScore || (dKey === 'backend' ? '88' : dKey === 'frontend' ? '84' : dKey === 'pm' ? '68' : '90');
    const rMap = roleMapping[dKey] || roleMapping.fullstack;
    const name = userName || 'Chaitanya';
    const edu = userEducation || 'B.S. Computer Science';
    const exp = userExperience || '0 Yrs';
    
    return {
      atsScore: parseInt(ats),
      roleMatch: parseInt(rMap.match.replace('%', '')),
      candidateName: name,
      highestEducation: edu,
      experienceYears: exp,
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

  // Sync navbar tabs with sidebar tabs
  useEffect(() => {
    if (activeNavTab === 'analytics') {
      setActiveSidebarTab('performance');
    } else if (activeNavTab === 'dashboard') {
      setActiveSidebarTab('dashboard');
    }
  }, [activeNavTab]);

  useEffect(() => {
    if (activeSidebarTab === 'performance') {
      setActiveNavTab('analytics');
    } else if (activeSidebarTab === 'dashboard') {
      setActiveNavTab('dashboard');
    } else {
      setActiveNavTab('dashboard');
    }
  }, [activeSidebarTab]);

  return (
    <div className="bg-[#09090b] text-[#e5e1e4] min-h-screen flex flex-col relative pt-16 font-body-md">
      {/* Background radial atmosphere glow */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-radial-gradient"></div>

      {/* Reusable Dashboard Header Navbar */}
      <DashboardNavbar activeTab={activeNavTab} setActiveTab={setActiveNavTab} />

      {/* ── Main Dashboard Layout Container ── */}
      <div className="flex flex-1 pt-2 max-w-[1400px] mx-auto w-full px-6 z-10 relative">
        

        {/* Main Dashboard Canvas */}
        <main className="flex-1 flex flex-col gap-8 pb-24 text-left">
             {activeSidebarTab === "dashboard" && (
            <>
              {/* Welcome Banner Card */}
              <section className="glass-card p-8 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden border border-primary/20 bg-primary/5 mt-4">
                <div className="absolute -right-20 -top-20 w-48 h-48 bg-primary/10 rounded-full blur-3xl text-left"></div>
                <div className="flex items-center gap-6 z-10 text-left">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0 shadow-[0_0_20px_rgba(37,99,235,0.15)]">
                    <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  </div>
                  <div>
                    <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-white font-bold leading-tight text-left">Welcome back, {userName}.</h1>
                    <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl mt-1 text-left">Your technical preparation journey is progressing well. You have completed {sessions.length} mock sessions.</p>
                  </div>
                </div>
                <div className="flex gap-3 w-full md:w-auto shrink-0 z-10">
                  <button onClick={() => navigate('/practice')} className="btn-primary px-8 py-4 rounded-xl text-xs font-bold text-white shadow-xl flex items-center justify-center gap-2 border-none cursor-pointer w-full md:w-auto">
                    <span className="material-symbols-outlined text-[16px] text-white">play_arrow</span>
                    Start Practice Session
                  </button>
                </div>
              </section>

              {/* Quick Stats Grid */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Stat Card 1 */}
                <div className="glass-card rounded-xl p-6 flex flex-col gap-4 group hover:shadow-[0_0_30px_rgba(37,99,235,0.15)] transition-all duration-300">
                  <div className="flex justify-between items-start">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                      <span className="material-symbols-outlined text-primary text-xl">insights</span>
                    </div>
                    <span className="font-label-sm text-label-sm px-2.5 py-1 bg-tertiary-container/20 text-tertiary rounded-full border border-tertiary/20 font-mono font-bold">
                      {averageMockScore !== null ? 'Live Stats' : '+12% this week'}
                    </span>
                  </div>
                  <div>
                    <p className="font-label-md text-label-md text-on-surface-variant mb-1 font-mono text-left">
                      {averageMockScore !== null ? "AVERAGE INTERVIEW SCORE" : "RESUME ATS SCORE"}
                    </p>
                    <p className="font-display-lg text-display-lg text-white text-left">
                      {averageMockScore !== null ? averageMockScore : atsScore}
                      <span className="text-headline-md text-on-surface-variant font-mono">/100</span>
                    </p>
                  </div>
                </div>
                
                {/* Stat Card 2 */}
                <div className="glass-card rounded-xl p-6 flex flex-col gap-4 group hover:shadow-[0_0_30px_rgba(37,99,235,0.15)] transition-all duration-300">
                  <div className="flex justify-between items-start">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                      <span className="material-symbols-outlined text-primary text-xl">architecture</span>
                    </div>
                    <span className="font-label-sm text-label-sm px-2.5 py-1 bg-primary/10 text-primary rounded-full border border-primary/20 font-mono font-bold">Strongest</span>
                  </div>
                  <div>
                    <p className="font-label-md text-label-md text-on-surface-variant mb-1 font-mono text-left">BEST DOMAIN</p>
                    <p className="font-headline-md text-white mt-2 font-bold tracking-tight uppercase text-left">
                      {userDomain === "se" || userDomain === "frontend" || userDomain === "backend" || userDomain === "fullstack" ? "System Design" : userDomain === "pm" ? "Product Metrics" : userDomain === "consulting" ? "Case Structuring" : userDomain === "finance" ? "Financial Valuation" : "Technical Depth"}
                    </p>
                  </div>
                </div>

                {/* Stat Card 3 */}
                <div className="glass-card rounded-xl p-6 flex flex-col gap-4 group hover:shadow-[0_0_30px_rgba(37,99,235,0.15)] transition-all duration-300">
                  <div className="flex justify-between items-start">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                      <span className="material-symbols-outlined text-primary text-xl">task_alt</span>
                    </div>
                    <span className="font-label-sm text-label-sm px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 font-mono font-bold">Active Sprint</span>
                  </div>
                  <div>
                    <p className="font-label-md text-label-md text-on-surface-variant mb-1 font-mono text-left">SESSIONS COMPLETED</p>
                    <p className="font-display-lg text-display-lg text-white text-left">
                      {loadingSessions ? '--' : sessions.length}
                    </p>
                  </div>
                </div>
              </section>

              {/* Gamification Timeline Challenge */}
              <section className="glass-card rounded-xl p-6 flex flex-col gap-6 relative overflow-hidden border border-white/5">
                <div className="absolute -right-16 -top-16 w-36 h-36 bg-primary/10 rounded-full blur-2xl pointer-events-none"></div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-3xl">emoji_events</span>
                    <div>
                      <h2 className="font-headline-md text-headline-md text-white font-bold">Active 15-Day Interview Practice Challenge</h2>
                      <p className="font-label-sm text-label-sm text-primary font-mono font-bold">
                        Day {Math.min(15, sessions.length + 1)} active • {15 - sessions.length > 0 ? `${15 - sessions.length} sessions remaining to claim bonus!` : 'Challenge completed! Click claim to receive your bonus.'}
                      </p>
                    </div>
                  </div>
                  {claimedTimeline ? (
                    <span className="font-label-sm text-label-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-mono font-bold w-fit">
                      Claimed ✓
                    </span>
                  ) : (
                    <button
                      onClick={claimTimelineBonus}
                      disabled={sessions.length < 15}
                      className={`font-label-sm text-label-sm px-3.5 py-1.5 rounded-full font-mono font-bold border transition-all cursor-pointer ${
                        sessions.length >= 15
                          ? 'bg-amber-50 dark:bg-amber-400/20 border-amber-200 dark:border-amber-400/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-400/30'
                          : 'bg-primary/10 border-primary/20 text-primary opacity-60 cursor-not-allowed'
                      }`}
                    >
                      XP Bonus: +500
                    </button>
                  )}
                </div>

                {/* Horizontal Timeline Track */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/5 pr-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 15].map((dayNum) => {
                    const isCompleted = sessions.length >= dayNum;
                    const isActive = sessions.length + 1 === dayNum;
                    
                    if (dayNum === 9) {
                      return (
                        <div key="ellipsis" className="flex flex-col items-center gap-1 opacity-20 shrink-0 select-none">
                          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-on-surface-variant font-mono">...</div>
                          <span className="text-[10px] font-label-sm text-outline font-mono">...</span>
                        </div>
                      );
                    }
                    
                    if (isCompleted) {
                      return (
                        <div key={dayNum} className="flex flex-col items-center gap-1 shrink-0">
                          <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center text-primary font-mono font-bold shadow-[0_0_10px_rgba(37,99,235,0.2)]">✓</div>
                          <span className="text-[10px] font-label-sm text-primary font-mono font-bold">Day {dayNum}</span>
                        </div>
                      );
                    }
                    
                    if (isActive) {
                      return (
                        <div key={dayNum} className="flex flex-col items-center gap-1 shrink-0">
                          <div className="w-10 h-10 rounded-full bg-primary/15 border-2 border-dashed border-primary flex items-center justify-center text-primary font-mono font-bold animate-[pulse_2s_infinite]">{dayNum}</div>
                          <span className="text-[10px] font-label-sm text-primary font-mono font-bold animate-pulse">Active</span>
                        </div>
                      );
                    }
                    
                    return (
                      <div key={dayNum} className={`flex flex-col items-center gap-1 shrink-0 ${dayNum === 15 ? 'opacity-30' : 'opacity-40'}`}>
                        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-on-surface-variant font-mono">{dayNum}</div>
                        <span className="text-[10px] font-label-sm text-outline font-mono">{dayNum === 15 ? 'End' : `Day ${dayNum}`}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* AI-Generated Questions Section */}
              <section className="glass-card rounded-xl p-6 border border-primary/20 bg-[#1E1B4B]/5 relative overflow-hidden text-left shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
                <div className="absolute -right-20 -bottom-20 w-48 h-48 bg-[#1e1b4b]/20 rounded-full blur-3xl pointer-events-none"></div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-3xl">psychology</span>
                    <div>
                      <h2 className="font-headline-md text-headline-md text-white font-bold">🎯 AI-Generated Questions for You</h2>
                      <p className="text-xs text-on-surface-variant">Tailored interview practice based on your resume and domain target.</p>
                    </div>
                  </div>
                  {hasScanQuestions ? (
                    <span className="text-[10px] px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full font-mono font-bold w-fit">
                      Derived from Resume
                    </span>
                  ) : (
                    <span className="text-[10px] px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full font-mono font-bold w-fit">
                      Default Track Questions
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* General / Behavioral Column */}
                  <div className="glass-panel p-5 rounded-xl border border-white/5 bg-black/15 flex flex-col gap-4">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">forum</span>
                      General &amp; Behavioral Questions
                    </h3>
                    <ul className="space-y-3">
                      {(questionsExpanded ? generalQuestions : generalQuestions.slice(0, 3)).map((q, idx) => (
                        <li key={idx} className="flex gap-3 text-xs leading-relaxed text-on-surface-variant hover:text-white transition-colors duration-200 text-left animate-fade-in">
                          <span className="font-mono text-primary font-bold shrink-0">{idx + 1}.</span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Technical / Role-Specific Column */}
                  <div className="glass-panel p-5 rounded-xl border border-white/5 bg-black/15 flex flex-col gap-4">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">code</span>
                      Technical &amp; Role-Specific Questions
                    </h3>
                    <ul className="space-y-3">
                      {(questionsExpanded ? technicalQuestions : technicalQuestions.slice(0, 3)).map((q, idx) => (
                        <li key={idx} className="flex gap-3 text-xs leading-relaxed text-on-surface-variant hover:text-white transition-colors duration-200 text-left animate-fade-in">
                          <span className="font-mono text-primary font-bold shrink-0">{idx + 1}.</span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {(generalQuestions.length > 3 || technicalQuestions.length > 3) && (
                  <div className="flex justify-center mt-5">
                    <button
                      onClick={() => setQuestionsExpanded(!questionsExpanded)}
                      className="px-4 py-2 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary text-[10px] font-mono font-bold tracking-wider uppercase cursor-pointer transition-all flex items-center gap-1.5 border-none select-none"
                    >
                      <span className="material-symbols-outlined text-sm leading-none">
                        {questionsExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                      </span>
                      {questionsExpanded ? 'Show Less' : `Show More (${Math.max(0, generalQuestions.length - 3) + Math.max(0, technicalQuestions.length - 3)} Hidden)`}
                    </button>
                  </div>
                )}

                {!hasScanQuestions && (
                  <div className="mt-5 p-4 rounded-xl bg-primary/5 border border-primary/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-on-surface-variant text-center sm:text-left">
                      🚀 For personalized questions matching your specific experience, projects, and skills, upload your resume!
                    </p>
                    <Link to="/resume-analyzer" className="btn-primary px-6 py-2.5 rounded-lg text-xs font-bold text-white border-none shrink-0 text-center select-none decoration-transparent w-full sm:w-auto">
                      Scan Resume Now
                    </Link>
                  </div>
                )}
              </section>

              {/* Activity Bento Grid */}
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Sessions List */}
                <div className="glass-card rounded-xl p-6 lg:col-span-2 flex flex-col gap-6">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <h2 className="font-headline-md text-headline-md text-white font-bold">Recent Sessions</h2>
                    <button onClick={() => setActiveSidebarTab("sessions")} className="font-label-md text-label-md text-primary hover:text-primary/80 font-mono font-bold transition-colors cursor-pointer border-none bg-transparent">View All</button>
                  </div>

                  <div className="flex flex-col gap-3">
                    {loadingSessions ? (
                      <div className="text-center py-6 text-xs text-on-surface-variant">
                        Loading recent sessions...
                      </div>
                    ) : sessions.length === 0 ? (
                      <div className="text-center py-8 text-xs text-on-surface-variant bg-[#18181b]/30 rounded-xl border border-dashed border-white/10">
                        No completed sessions yet. Start a practice session to see analytics!
                      </div>
                    ) : (
                      sessions.slice(0, 3).map((session) => {
                        const hasReport = !!session.report;
                        const scoreText = hasReport ? `${session.report.score}` : 'Pending';
                        const dateText = new Date(session.completedAt || session.startTime).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                        return (
                          <div 
                            key={session.id}
                            onClick={() => navigate(`/practice/feedback/${session.id}`)}
                            className="group flex items-center justify-between p-4 rounded-xl border border-white/5 bg-[#18181b]/30 hover:bg-[#18181b]/60 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] hover:border-white/20 transition-all duration-300 ease-out cursor-pointer gap-4"
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className={`w-12 h-12 rounded-lg flex items-center justify-center border shrink-0 ${
                                session.mode === 'jd' 
                                  ? 'bg-primary/10 text-primary border-primary/20' 
                                  : 'bg-secondary/10 text-secondary border-secondary/20'
                              }`}>
                                <span className="material-symbols-outlined">
                                  {session.mode === 'jd' ? 'dns' : 'groups'}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-body-md text-body-md font-semibold text-white/90 group-hover:text-white transition-colors text-left truncate">
                                  {session.mode === 'jd' ? `${session.title} at ${session.company}` : "Resume Cross-Examination"}
                                </h3>
                                <p className="font-label-sm text-label-sm text-on-surface-variant font-mono text-left truncate">
                                  {session.mode === 'jd' ? 'Job Focus' : 'Resume Focus'} • {dateText}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-6 shrink-0">
                              <span className={`font-label-sm text-label-sm px-2.5 py-1 rounded-md font-mono font-bold border shrink-0 whitespace-nowrap ${
                                hasReport 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}>
                                <span className="hidden sm:inline">{hasReport ? 'Score: ' : ''}</span>{scoreText}
                              </span>
                              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-white group-hover:translate-x-1 transition-all duration-300">
                                chevron_right
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* AI Job Matching Card */}
                <div className="glass-card rounded-xl p-6 flex flex-col gap-4 relative overflow-hidden border border-primary/20 bg-primary/5">
                  <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none"></div>
                  <div className="flex items-center gap-3 mb-1 text-left">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0 shadow-[0_0_15px_rgba(37,99,235,0.15)]">
                      <span className="material-symbols-outlined text-primary text-xl">work</span>
                    </div>
                    <h2 className="font-headline-md text-headline-md text-white font-bold">AI Job Match</h2>
                  </div>
                  
                  <div className="bg-black/20 border border-white/5 rounded-lg p-3 text-left">
                    <p className="font-label-sm text-label-sm text-primary mb-1 font-mono font-bold">RECOMMENDED POSITION</p>
                    <p className="font-body-md font-bold text-white text-sm">
                      {recommendedJob ? recommendedJob.title : (userDomain === 'pm' ? 'Associate Product Manager' : 'Software Engineer I')}
                    </p>
                    <p className="font-mono text-[10px] text-on-surface-variant mt-1 font-bold">
                      Company: {recommendedJob ? recommendedJob.company : (userDreamCompany || 'Google')}
                    </p>
                  </div>

                  <p className="font-body-md text-body-md text-on-surface-variant text-xs leading-relaxed text-left line-clamp-3">
                    {recommendedJob ? recommendedJob.jdText : `We recommend starting a practice run tailored for ${userDreamCompany || 'Google'}'s standard hiring qualifications.`}
                  </p>

                  <div className="mt-auto space-y-3 pt-4">
                    <button 
                      onClick={() => handleStartInterview(recommendedJob || {
                        title: userDomain === 'pm' ? 'Associate Product Manager' : 'Software Engineer I',
                        company: userDreamCompany || 'Google',
                        jdText: `Standard hiring qualifications for a technical role at ${userDreamCompany || 'Google'}.`,
                        duration: 15
                      })} 
                      className="w-full btn-primary py-3.5 text-xs font-bold border-none cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-sm">play_arrow</span>
                      Apply &amp; Start Mock Interview
                    </button>
                    <button 
                      onClick={() => navigate('/jobs')} 
                      className="w-full btn-secondary py-3 text-xs font-bold text-center block cursor-pointer bg-transparent border border-white/10 hover:bg-white/5 transition-all text-white"
                    >
                      Browse All Open Positions
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeSidebarTab === "sessions" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-2 mb-2 text-left">
                <span className="material-symbols-outlined text-primary text-2xl">history</span>
                <h2 className="font-headline-md text-headline-md text-white font-bold">Mock Interview History</h2>
              </div>
              
              <div className="glass-card rounded-xl p-6 border border-white/5 bg-[#18181b]/35 flex flex-col gap-4">
                <p className="text-xs text-on-surface-variant text-left">
                  Browse through all the mock interview sessions you have completed. Click any session to open the detailed performance critique, feedback scores, and transcript review.
                </p>
                
                <div className="flex flex-col gap-4 mt-2">
                  {loadingSessions ? (
                    <div className="text-center py-10 text-xs text-on-surface-variant">
                      <div className="w-8 h-8 rounded-full border-2 border-dashed border-primary border-t-transparent animate-spin mx-auto mb-3"></div>
                      Loading sessions from database...
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="text-center py-12 text-xs text-on-surface-variant bg-black/10 rounded-xl border border-dashed border-white/10 flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-4xl text-on-surface-variant">info</span>
                      No mock interviews completed yet. Launch a practice session to begin tracking your history.
                      <button onClick={() => navigate('/practice')} className="btn-primary px-6 py-3 rounded-lg text-xs font-bold text-white border-none mt-2 cursor-pointer">
                        Start Practice Session
                      </button>
                    </div>
                  ) : (
                    sessions.map((session) => {
                      const hasReport = !!session.report;
                      const dateText = new Date(session.completedAt || session.startTime).toLocaleString([], {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      
                      return (
                        <div 
                          key={session.id}
                          onClick={() => navigate(`/practice/feedback/${session.id}`)}
                          className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-xl border border-white/5 bg-black/20 hover:bg-[#18181b]/60 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] hover:border-white/20 transition-all duration-300 ease-out cursor-pointer gap-4"
                        >
                          <div className="flex items-start gap-4 min-w-0">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center border shrink-0 ${
                              session.mode === 'jd' 
                                ? 'bg-primary/10 text-primary border-primary/20' 
                                : 'bg-secondary/10 text-secondary border-secondary/20'
                            }`}>
                              <span className="material-symbols-outlined">
                                {session.mode === 'jd' ? 'dns' : 'groups'}
                              </span>
                            </div>
                            <div className="space-y-1 min-w-0">
                              <h3 className="font-body-md text-body-md font-bold text-white/90 group-hover:text-white transition-colors text-left truncate">
                                {session.mode === 'jd' ? `${session.title} at ${session.company}` : "Resume Cross-Examination"}
                              </h3>
                              <p className="font-label-sm text-label-sm text-on-surface-variant font-mono text-left flex items-center gap-1.5 flex-wrap">
                                <span className="px-2 py-0.5 rounded bg-white/5 text-white/70 border border-white/5 shrink-0">{session.mode === 'jd' ? 'Job Focus' : 'Resume Focus'}</span>
                                <span>•</span>
                                <span className="shrink-0">Limit: {session.durationMinutes} min</span>
                                <span>•</span>
                                <span className="truncate">{dateText}</span>
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-none border-white/5 pt-3 sm:pt-0 shrink-0">
                            <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
                              {hasReport ? (
                                <>
                                  <span className="font-label-sm text-label-sm px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-md font-mono font-bold border border-emerald-500/20 shrink-0 whitespace-nowrap">
                                    <span className="hidden sm:inline">Score: </span>{session.report.score}/100
                                  </span>
                                  <span className="text-[10px] text-on-surface-variant font-mono shrink-0 whitespace-nowrap">
                                    {session.report.wpm} WPM • {session.report.fillerWords} fillers
                                  </span>
                                </>
                              ) : (
                                <span className="font-label-sm text-label-sm px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-md font-mono font-bold border border-amber-500/20 animate-pulse shrink-0 whitespace-nowrap">
                                  Generating Report...
                                </span>
                              )}
                            </div>
                            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-white group-hover:translate-x-1 transition-all duration-300">
                              chevron_right
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSidebarTab === "performance" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-2 mb-2 text-left">
                <span className="material-symbols-outlined text-primary text-2xl">analytics</span>
                <h2 className="font-headline-md text-headline-md text-white font-bold">Performance &amp; Telemetry Insights</h2>
              </div>

              {/* General Performance Summary Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card rounded-xl p-5 bg-[#18181b]/35 border border-white/10 text-left flex flex-col justify-between h-[140px]">
                  <p className="font-label-sm text-label-sm text-on-surface-variant font-mono">AVG INTERVIEW SCORE</p>
                  <p className="text-4xl font-extrabold text-white font-mono">
                    {averageMockScore !== null ? `${averageMockScore}` : '--'}
                    <span className="text-sm font-normal text-on-surface-variant"> /100</span>
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                    <span className="material-symbols-outlined text-[12px]">trending_up</span>
                    <span>Stable telemetry rating baseline</span>
                  </div>
                </div>

                <div className="glass-card rounded-xl p-5 bg-[#18181b]/35 border border-white/10 text-left flex flex-col justify-between h-[140px]">
                  <p className="font-label-sm text-label-sm text-on-surface-variant font-mono">TOTAL SPEAKING TIME</p>
                  <p className="text-4xl font-extrabold text-white font-mono">
                    {totalSpeechHours}
                    <span className="text-sm font-normal text-on-surface-variant"> Hours</span>
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-[#818CF8] font-mono">
                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                    <span>Accumulated across all sessions</span>
                  </div>
                </div>

                <div className="glass-card rounded-xl p-5 bg-[#18181b]/35 border border-white/10 text-left flex flex-col justify-between h-[140px]">
                  <p className="font-label-sm text-label-sm text-on-surface-variant font-mono">MOCKS COMPLETED</p>
                  <p className="text-4xl font-extrabold text-white font-mono">
                    {sessions.length}
                    <span className="text-sm font-normal text-on-surface-variant"> Runs</span>
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                    <span className="material-symbols-outlined text-[12px]">check_circle</span>
                    <span>Active practice record</span>
                  </div>
                </div>
              </div>

              {/* Progress & Detailed Telemetry Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* WPM Trend & Distribution */}
                <div className="glass-card rounded-xl p-6 border border-white/5 bg-[#18181b]/35 text-left flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-sm">speed</span>
                    Pacing &amp; Speaking WPM History
                  </h3>
                  
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Optimal speaking speed is between **110 and 150 words per minute (WPM)**. Below is your history of pacing for each mock interview:
                  </p>

                  <div className="space-y-4 mt-2">
                    {sessions.filter(s => s.report).length === 0 ? (
                      <div className="text-center py-8 text-xs text-on-surface-variant italic">
                        No telemetry logs available yet.
                      </div>
                    ) : (
                      sessions.filter(s => s.report).slice(0, 4).map((session) => {
                        const wpmVal = session.report.wpm || 0;
                        const wpmPercentage = Math.min((wpmVal / 200) * 100, 100);
                        const isOptimal = wpmVal >= 110 && wpmVal <= 150;
                        
                        return (
                          <div key={session.id} className="space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-mono">
                              <span className="text-white font-bold">{session.mode === 'jd' ? `${session.title}` : 'Resume Exam'}</span>
                              <span className={isOptimal ? 'text-emerald-400' : 'text-amber-400'}>
                                {wpmVal} WPM ({isOptimal ? 'Optimal' : wpmVal < 110 ? 'Slow' : 'Fast'})
                              </span>
                            </div>
                            <div className="w-full h-2 rounded bg-white/5 relative overflow-hidden">
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

                {/* Filler Words Reduction Performance */}
                <div className="glass-card rounded-xl p-6 border border-white/5 bg-[#18181b]/35 text-left flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                    <span className="material-symbols-outlined text-rose-400 text-sm">sms_failed</span>
                    Crutch Word Telemetry
                  </h3>
                  
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Filler words (like *um*, *uh*, *like*, *so*) reduce communication strength. The goal is to keep crutch words under **5 per session**:
                  </p>

                  <div className="space-y-4 mt-2">
                    {sessions.filter(s => s.report).length === 0 ? (
                      <div className="text-center py-8 text-xs text-on-surface-variant italic">
                        No telemetry logs available yet.
                      </div>
                    ) : (
                      sessions.filter(s => s.report).slice(0, 4).map((session) => {
                        const fillerVal = session.report.fillerWords || 0;
                        const fillerPercentage = Math.min((fillerVal / 20) * 100, 100);
                        const isGood = fillerVal <= 5;
                        
                        return (
                          <div key={session.id} className="space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-mono">
                              <span className="text-white font-bold">{session.mode === 'jd' ? `${session.title}` : 'Resume Exam'}</span>
                              <span className={isGood ? 'text-emerald-400' : 'text-rose-400'}>
                                {fillerVal} fillers ({isGood ? 'Low/Excellent' : 'High'})
                              </span>
                            </div>
                            <div className="w-full h-2 rounded bg-white/5 relative overflow-hidden">
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

              {/* Complete Performance Log */}
              <div className="glass-card rounded-xl p-6 border border-white/5 bg-[#18181b]/35 text-left flex flex-col gap-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-sm">assignment</span>
                  Key Telemetry Logs Table
                </h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-xs text-left text-on-surface-variant border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 font-mono uppercase text-[10px] text-white">
                        <th className="py-3 px-4">Role Title</th>
                        <th className="py-3 px-4 text-center">Score</th>
                        <th className="py-3 px-4 text-center">WPM</th>
                        <th className="py-3 px-4 text-center">Filler Words</th>
                        <th className="py-3 px-4 text-center">Hesitations</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.filter(s => s.report).length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-8 text-center text-on-surface-variant italic">
                            No completed mock sessions registered yet.
                          </td>
                        </tr>
                      ) : (
                        sessions.filter(s => s.report).map((session) => (
                          <tr key={session.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-all">
                            <td className="py-3 px-4 text-white font-medium">
                              {session.mode === 'jd' ? `${session.title} at ${session.company}` : "Resume Cross-Examination"}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold">
                                {session.report.score}/100
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-mono">{session.report.wpm}</td>
                            <td className="py-3 px-4 text-center font-mono">{session.report.fillerWords}</td>
                            <td className="py-3 px-4 text-center font-mono">{session.report.hesitationDuration || '0s'}</td>
                            <td className="py-3 px-4 text-right">
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
            </div>
          )}

          {activeSidebarTab === "settings" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-2 mb-2 text-left">
                <span className="material-symbols-outlined text-primary text-2xl">settings</span>
                <h2 className="font-headline-md text-headline-md text-white font-bold">User Target &amp; Profile Settings</h2>
              </div>

              <div className="glass-card rounded-xl p-8 border border-white/5 bg-[#18181b]/35 text-left max-w-xl flex flex-col gap-6">
                <p className="text-xs text-on-surface-variant">
                  Update your simulation settings to adjust the default parameters of the AI mock interview interviewer and dashboard questions.
                </p>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const name = formData.get('userName');
                  const domain = formData.get('userDomain');
                  const score = formData.get('atsScore');
                  handleSaveSettings(name, domain, score);
                }} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="font-label-md text-label-md text-on-surface-variant block">Candidate Name</label>
                    <input 
                      type="text" 
                      name="userName"
                      defaultValue={userName}
                      className="w-full bg-black/20 border border-outline-variant rounded-lg px-4 py-3 text-xs text-white focus:outline-none focus:border-primary"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-label-md text-label-md text-on-surface-variant block">Target Job Domain / Focus</label>
                    <select 
                      name="userDomain"
                      defaultValue={userDomain}
                      className="w-full bg-[#131315]/80 border border-outline-variant rounded-lg px-4 py-3 text-xs text-white focus:outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="backend">Backend Software Engineer</option>
                      <option value="frontend">Frontend Software Engineer</option>
                      <option value="fullstack">Full-Stack Software Engineer</option>
                      <option value="se">General Software Engineer</option>
                      <option value="ml">Machine Learning / Data Scientist</option>
                      <option value="pm">Product Manager (PM)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-label-md text-label-md text-on-surface-variant block">Mock ATS Resume Baseline Score</label>
                    <input 
                      type="number" 
                      name="atsScore"
                      defaultValue={atsScore}
                      min="30"
                      max="100"
                      className="w-full bg-black/20 border border-outline-variant rounded-lg px-4 py-3 text-xs text-white focus:outline-none focus:border-primary font-mono"
                      required
                    />
                  </div>

                  <button 
                    type="submit"
                    className="btn-primary w-full py-4 rounded-xl text-xs font-bold text-white border-none mt-2 cursor-pointer"
                  >
                    Save Changes
                  </button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>

      <Footer />

      {/* 24/7 Context-Aware AI Chatbot Floating Drawer */}
      <Chatbot />
    </div>
  );
}
