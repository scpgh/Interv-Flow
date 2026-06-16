import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import admin from 'firebase-admin';
import { WebSocketServer, WebSocket } from 'ws';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Lightweight in-memory rate limiter
const ipRequestCounts = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests per minute

const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  
  if (!ipRequestCounts.has(ip)) {
    ipRequestCounts.set(ip, []);
  }
  
  const timestamps = ipRequestCounts.get(ip);
  const activeTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  
  if (activeTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    console.warn(`Rate limit exceeded for IP: ${ip}`);
    return res.status(429).json({ error: "Too many requests. Please try again after a minute." });
  }
  
  activeTimestamps.push(now);
  ipRequestCounts.set(ip, activeTimestamps);
  next();
};

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/', rateLimiter);

// Helper for calling functions with exponential backoff and jitter on 429 rate limit errors
async function callWithRetry(fn, maxRetries = 5, baseDelay = 1000) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      const isRateLimit = err.status === 429 || 
                          (err.message && err.message.includes("429")) || 
                          (err.message && err.message.includes("Quota exceeded")) || 
                          (err.message && err.message.includes("ResourceExhausted"));

      if (isRateLimit && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.warn(`Gemini API 429 rate limit hit. Retrying attempt ${attempt}/${maxRetries} in ${Math.round(delay)}ms...`);
        try {
          fs.appendFileSync('./pdf_debug.log', `[${new Date().toISOString()}] Gemini API 429 Rate Limit. Retrying attempt ${attempt}/${maxRetries} in ${Math.round(delay)}ms.\n`);
        } catch (e) {}
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }
}

// Helper for calling Groq completions API
async function callGroqChat(systemPrompt, userPrompt, modelName = "llama-3.3-70b-versatile", jsonMode = false) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing in server/.env");
  }

  const requestBody = {
    model: modelName,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.1
  };

  if (jsonMode) {
    requestBody.response_format = { type: "json_object" };
  }

  console.log(`Calling Groq API (model: ${modelName}, jsonMode: ${jsonMode})...`);
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error (status ${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0) {
    throw new Error("Groq API returned an empty completion response.");
  }

  return data.choices[0].message.content;
}

// Configure Multer for in-memory file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // limit file size to 5MB
});

// Initialize Gemini SDK
let ai = null;
if (process.env.GEMINI_API_KEY) {
  try {
    // In @google/generative-ai version 0.x, we initialize with GoogleGenerativeAI
    ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log("Gemini API initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize Gemini API SDK:", err);
  }
} else {
  console.warn("WARNING: GEMINI_API_KEY is missing in server/.env! AI analysis requests will fail with instruction details.");
}

// Initialize Firebase Firestore with local fallback
let db = null;
const hasEnvCredentials = process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY;
const hasFileCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_PATH && fs.existsSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);

if (hasEnvCredentials) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
    db = admin.firestore();
    console.log("Firebase Firestore initialized successfully via environment variables.");
  } catch (err) {
    console.error("Failed to initialize Firebase Firestore via environment variables:", err);
  }
} else if (hasFileCredentials) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log("Firebase Firestore initialized successfully via service account JSON file.");
  } catch (err) {
    console.error("Failed to initialize Firebase Firestore via JSON file:", err);
  }
} else {
  console.log("Firebase credentials not found (neither Env variables nor JSON path). Operating in local fallback JSON database mode.");
}

// Database save helper
const saveAnalysis = async (data) => {
  const record = {
    ...data,
    createdAt: new Date().toISOString()
  };

  if (db) {
    try {
      const docRef = await db.collection('resume_analyses').add(record);
      console.log(`Saved analysis to Firestore with ID: ${docRef.id}`);
      return docRef.id;
    } catch (err) {
      console.error("Firestore write failed, falling back to local file:", err);
    }
  }

  // Local file fallback save
  try {
    const fallbackPath = './db_fallback.json';
    let records = [];
    if (fs.existsSync(fallbackPath)) {
      try {
        records = JSON.parse(fs.readFileSync(fallbackPath, 'utf8') || '[]');
      } catch (e) {
        records = [];
      }
    }
    const localRecord = {
      id: `local_${Date.now()}`,
      ...record
    };
    records.push(localRecord);
    fs.writeFileSync(fallbackPath, JSON.stringify(records, null, 2));
    console.log(`Saved analysis locally in server/db_fallback.json`);
    return localRecord.id;
  } catch (err) {
    console.error("Local save fallback failed:", err);
  }
  return null;
};
  
// User data helper functions
const findUserByEmail = async (email) => {
  const sanitizedEmail = email.toLowerCase().trim();
  if (db) {
    try {
      const userDoc = await db.collection('users').doc(sanitizedEmail).get();
      if (userDoc.exists) {
        return { email: sanitizedEmail, ...userDoc.data() };
      }
      return null;
    } catch (err) {
      console.error("Firestore user fetch failed, falling back to local file:", err);
    }
  }

  // Local file fallback
  try {
    const fallbackPath = './db_users_fallback.json';
    if (fs.existsSync(fallbackPath)) {
      const users = JSON.parse(fs.readFileSync(fallbackPath, 'utf8') || '[]');
      return users.find(u => u.email === sanitizedEmail) || null;
    }
  } catch (err) {
    console.error("Local user fetch fallback failed:", err);
  }
  return null;
};

const saveUser = async (userData) => {
  const sanitizedEmail = userData.email.toLowerCase().trim();
  const record = {
    ...userData,
    email: sanitizedEmail,
    updatedAt: new Date().toISOString()
  };

  if (db) {
    try {
      await db.collection('users').doc(sanitizedEmail).set(record, { merge: true });
      console.log(`Saved user to Firestore: ${sanitizedEmail}`);
      return true;
    } catch (err) {
      console.error("Firestore user write failed, falling back to local file:", err);
    }
  }

  // Local file fallback save
  try {
    const fallbackPath = './db_users_fallback.json';
    let users = [];
    if (fs.existsSync(fallbackPath)) {
      try {
        users = JSON.parse(fs.readFileSync(fallbackPath, 'utf8') || '[]');
      } catch (e) {
        users = [];
      }
    }
    const index = users.findIndex(u => u.email === sanitizedEmail);
    if (index > -1) {
      users[index] = { ...users[index], ...record };
    } else {
      users.push({
        createdAt: new Date().toISOString(),
        ...record
      });
    }
    fs.writeFileSync(fallbackPath, JSON.stringify(users, null, 2));
    console.log(`Saved user locally in server/db_users_fallback.json`);
    return true;
  } catch (err) {
    console.error("Local user save fallback failed:", err);
  }
  return false;
};

// Local fallback resume analysis when Gemini API is unavailable or rate limited
function fallbackResumeAnalysis(resumeText, domain) {
  const normalizedDomain = (domain || 'swe').toLowerCase().trim();
  
  // Extract candidate name heuristically
  let candidateName = "Chaitanya";
  const lines = resumeText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    if (/^[A-Za-z\s]+$/.test(line) && line.split(/\s+/).length >= 2 && line.split(/\s+/).length <= 4 && line.length < 30) {
      candidateName = line;
      break;
    }
  }

  // Extract highest education heuristically
  let highestEducation = "B.S. Computer Science";
  const eduRegexes = [
    { pattern: /(ph\.?d\.?|doctor of philosophy|doctorate)/i, label: "Ph.D. Computer Science" },
    { pattern: /(m\.?s\.?|master|m\.tech|mba)/i, label: "M.S. Computer Science" },
    { pattern: /(b\.?s\.?|bachelor|b\.tech|b\.e\.)/i, label: "B.S. Computer Science" }
  ];
  for (const item of eduRegexes) {
    if (item.pattern.test(resumeText)) {
      if (/business/i.test(resumeText) && item.label.includes("M.S.")) {
        highestEducation = "MBA";
      } else if (/electrical/i.test(resumeText)) {
        highestEducation = item.label.replace("Computer Science", "Electrical Engineering");
      } else if (/data/i.test(resumeText)) {
        highestEducation = item.label.replace("Computer Science", "Data Science");
      } else {
        highestEducation = item.label;
      }
      break;
    }
  }

  // Extract experience duration heuristically
  let experienceYears = "0 Yrs";
  const expMatch = resumeText.match(/(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)\s*(?:of)?\s*(?:experience|exp|work)/i);
  if (expMatch) {
    experienceYears = `${expMatch[1]} Yrs`;
  } else {
    const hasWorkExperience = /(?:experience|employment|work history|professional background|career history|position held)/i.test(resumeText);
    if (hasWorkExperience) {
      const workCount = (resumeText.match(/(?:experience|work|history|employment|position|job)/gi) || []).length;
      if (workCount > 5) {
        experienceYears = "5.5 Yrs";
      } else if (workCount > 3) {
        experienceYears = "3.5 Yrs";
      } else {
        experienceYears = "2.5 Yrs";
      }
    } else {
      experienceYears = "0 Yrs";
    }
  }

  // Domain keywords definitions
  const domainKeywords = {
    backend: ["Node.js", "Express", "Python", "Go", "Java", "PostgreSQL", "MongoDB", "MySQL", "Redis", "Kafka", "Docker", "AWS", "API", "REST", "gRPC", "Microservices", "GraphQL"],
    frontend: ["React", "Vue", "Angular", "TypeScript", "JavaScript", "HTML5", "CSS3", "Tailwind", "Webpack", "Vite", "Redux", "Zustand", "Sass", "UI/UX", "Responsive", "CSS"],
    fullstack: ["React", "Node.js", "Express", "TypeScript", "JavaScript", "PostgreSQL", "MongoDB", "Docker", "AWS", "API", "HTML5", "CSS3", "Git", "REST", "CI/CD"],
    swe: ["Software Engineering", "Algorithms", "Data Structures", "Java", "Python", "C++", "JavaScript", "TypeScript", "Git", "SQL", "Docker", "Testing", "CI/CD"],
    mobile: ["Swift", "SwiftUI", "Objective-C", "Kotlin", "Java", "Flutter", "React Native", "iOS", "Android", "Mobile", "Xcode", "CocoaPods", "CoreData"],
    devops: ["Docker", "Kubernetes", "Terraform", "Ansible", "Jenkins", "GitHub Actions", "CI/CD", "AWS", "GCP", "Azure", "Linux", "Bash", "Prometheus", "Grafana", "Nginx"],
    ml: ["Python", "PyTorch", "TensorFlow", "Scikit-learn", "Pandas", "NumPy", "Machine Learning", "Deep Learning", "NLP", "Computer Vision", "SQL", "Model", "Hugging Face"],
    dataeng: ["Python", "SQL", "Spark", "Hadoop", "ETL", "Airflow", "Kafka", "Snowflake", "Databricks", "Data Warehouse", "AWS", "PostgreSQL", "NoSQL"],
    security: ["Penetration Testing", "AppSec", "OAuth", "JWT", "SAML", "SSL/TLS", "Firewalls", "OWASP", "Vulnerability", "Cryptography", "Network Security", "IAM"],
    sdet: ["Selenium", "Cypress", "Playwright", "Jest", "Mocha", "JUnit", "QA", "Automation", "Testing", "CI/CD", "Bug Tracking", "Test Plans"],
    pm: ["Product Roadmap", "Agile", "Scrum", "User Stories", "PRD", "SQL", "A/B Testing", "KPIs", "User Research", "Product Strategy", "Figma", "Jira"],
    em: ["Engineering Leadership", "Agile", "Scrum", "Mentorship", "System Design", "Roadmap", "Budgeting", "SLA", "Architecture", "Recruiting", "KPIs"],
    ds: ["Python", "R", "SQL", "Pandas", "Machine Learning", "Statistics", "Tableau", "PowerBI", "Data Visualization", "A/B Testing", "Jupyter"],
    design: ["Figma", "Sketch", "Adobe XD", "UI/UX", "Wireframing", "Prototyping", "Design Systems", "User Research", "HTML", "CSS", "Illustration"],
    cloud: ["AWS", "GCP", "Azure", "Cloud Architecture", "IAM", "VPC", "S3", "EC2", "Serverless", "Terraform", "Kubernetes", "Load Balancer"],
    solutions: ["Enterprise Architecture", "Cloud Solutions", "System Design", "AWS", "Integration", "APIs", "SQL", "Security", "Microservices", "Scalability"],
    consulting: ["Management Consulting", "Strategy", "Data Analysis", "Financial Modeling", "Excel", "PowerPoint", "Market Research", "KPIs", "SWOT", "DCF"],
    finance: ["Financial Analysis", "Valuation", "DCF", "LBO", "Accounting", "Excel", "Bloomberg", "SQL", "VBA", "Portfolio Management", "Equity Research"],
    bizdev: ["Business Development", "Sales Pipeline", "CRM", "Salesforce", "Lead Generation", "Negotiation", "Partnerships", "Market Expansion", "KPIs"],
    financial: ["Financial Statements", "Excel", "Budgeting", "Forecasting", "Auditing", "SQL", "Variance Analysis", "Financial Modeling", "Reporting"],
    strategy: ["Operations", "Strategy", "Business Analyst", "KPIs", "Process Improvement", "SQL", "Tableau", "Agile", "Roadmap", "Cross-functional"],
    vc: ["Venture Capital", "Deal Flow", "Due Diligence", "Financial Modeling", "Valuation", "Startups", "Market Trends", "Excel", "Pitch Deck"]
  };

  const domainKey = normalizedDomain in domainKeywords ? normalizedDomain : 'swe';
  const targetKeywords = domainKeywords[domainKey];
  const foundKeywords = [];
  
  targetKeywords.forEach(kw => {
    const escaped = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(resumeText)) {
      foundKeywords.push(kw);
    }
  });

  const keywordRatio = targetKeywords.length > 0 ? foundKeywords.length / targetKeywords.length : 0.2;
  
  // Calculate base score on keywords
  let baseATS = Math.round(30 + keywordRatio * 50); // range 30 to 80
  let baseMatch = Math.round(30 + keywordRatio * 60); // range 30 to 90
  
  // Adjust based on experience
  if (experienceYears === "0 Yrs") {
    baseATS = Math.max(30, baseATS - 10);
    baseMatch = Math.max(30, baseMatch - 15);
  } else if (experienceYears.includes("0.5") || experienceYears.includes("1 ")) {
    baseATS = Math.max(30, baseATS - 5);
    baseMatch = Math.max(30, baseMatch - 10);
  }
  
  const atsScore = Math.min(95, Math.max(30, baseATS));
  const roleMatch = Math.min(98, Math.max(30, baseMatch));

  const fallbackCritiqueData = {
    backend: {
      grammar: [
        { id: "g1", type: "warning", title: "Casing of Database Technologies", text: "Ensure database technologies like 'PostgreSQL' and 'MongoDB' are correctly capitalized, not written as lowercase." },
        { id: "g2", type: "warning", title: "Action Verbs Tense Consistency", text: "Some bullet points under previous experience use mixed tenses (e.g., 'analyzing' vs 'developed'). Keep them in the past tense." }
      ],
      technical: [
        { id: "t1", type: "error", title: "Missing Scale Patterns", text: "Lacks mentions of critical horizontal scaling patterns: sharding, consistent hashing, caching (Redis/Memcached), or message queues (Kafka/RabbitMQ)." },
        { id: "t2", type: "warning", title: "API Standards Specification", text: "Uses generic 'created API endpoints' instead of specifying standards like REST, GraphQL, or gRPC interfaces." }
      ],
      impact: [
        { id: "i1", type: "error", title: "Unquantified Database Query Latency", text: "Under 'Optimized SQL queries,' you fail to show numerical outcomes. Quantify the throughput increase or CPU reduction (e.g., 'Reduced query latency by 35%')." },
        { id: "i2", type: "warning", title: "Passive Action Verbs", text: "Passive verb 'Helped migrate legacy codebase' detected. Replace with high-signal verbs like 'Orchestrated' or 'Engineered'." }
      ],
      formatting: [
        { id: "f1", type: "error", title: "Multi-Column Layout Risk", text: "Dual-column layout detected. Standard ATS parsers read horizontally, causing sidebar skills to merge into job details." },
        { id: "f2", type: "warning", title: "Missing GitHub Portfolio Link", text: "Missing active GitHub or technical profile link in the header section." }
      ],
      gapAdvice: 'Your backend resume is missing scale patterns (caching/queues) and performance metrics. Focus on explaining query optimization and API standards.',
      atsKeywords: ["Distributed Systems", "Redis Cache", "gRPC / REST APIs", "Message Queues (Kafka)", "CI/CD Pipeline Security"]
    },
    frontend: {
      grammar: [
        { id: "g1", type: "warning", title: "Branding Casing Consistency", text: "Ensure terms like 'React' and 'TypeScript' are capitalized correctly, not written as 'Reactjs' or 'typescript'." },
        { id: "g2", type: "warning", title: "Double Spacings", text: "Double spacing detected in components description text. Clean up spacing errors." }
      ],
      technical: [
        { id: "t1", type: "error", title: "Vague State Management Details", text: "React profile lacks details on state management tools (e.g., Redux Toolkit, Zustand, Context API) used for complex states." },
        { id: "t2", type: "error", title: "No Performance Metrics Mentioned", text: "Lacks references to frontend performance tuning: Core Web Vitals, code-splitting, lazy-loading, or image compression." }
      ],
      impact: [
        { id: "i1", type: "error", title: "Unquantified Page Speed Accomplishments", text: "Bullet point says 'Improved website speed.' Convert this to: 'Decreased initial bundle size by 30%, leading to a 1.2s improvement in TTI'." },
        { id: "i2", type: "warning", title: "Weak User Conversion Outcomes", text: "Fails to link UI redesigns to business outcomes. Replace 'Redesigned product pages' with 'Redesigned checkout layouts, boosting conversions by 12%'." }
      ],
      formatting: [
        { id: "f1", type: "error", title: "Skill Rating Progress Bars", text: "Using progress bars or dots to self-rate skills is unparseable by standard ATS and wastes page space." },
        { id: "f2", type: "warning", title: "Missing Portfolio Link", text: "Ensure a Figma, Dribbble, or personal website portfolio URL is clearly accessible in the header." }
      ],
      gapAdvice: 'Your resume lacks frontend speed and loading metrics. We recommend including Core Web Vitals optimizations and specifying state management tools.',
      atsKeywords: ["Core Web Vitals", "State Management (Redux/Zustand)", "Code Splitting", "Vite / Webpack Bundling", "Responsive Design"]
    },
    fullstack: {
      grammar: [
        { id: "g1", type: "warning", title: "Capitalization Errors", text: "Ensure framework names like 'JavaScript', 'MongoDB', and 'Tailwind CSS' are correctly capitalized." },
        { id: "g2", type: "warning", title: "Sentence Ending Periods", text: "Keep bullet list punctuation consistent. Add periods to the ends of all bullet descriptions." }
      ],
      technical: [
        { id: "t1", type: "error", title: "Rendering Paradigm Vague", text: "Lacks description of SSR/SSG/ISR rendering paradigms when detailing Next.js or Nuxt.js implementations." },
        { id: "t2", type: "warning", title: "No Database Schema Context", text: "Mentions SQL and NoSQL databases but doesn't specify data-modeling choices (e.g., relational normalization vs. embedded documents)." }
      ],
      impact: [
        { id: "i1", type: "error", title: "Weak Collaboration Verbs", text: "Passive verb 'Assisted in code reviews' found. Replace with high-signal verbs: 'Orchestrated pull-request quality gates' or 'Mentored junior devs'." },
        { id: "i2", type: "warning", title: "Lack of User Scale Metrics", text: "Missing user volume scaling metrics. Suggest adding metrics like: 'supporting 10k+ active daily users' or 'handling 2M+ monthly API calls'." }
      ],
      formatting: [
        { id: "f1", type: "error", title: "OCR Blocking Dividers", text: "Horizontal divider lines and colored header banners block OCR scans. Replace with clean white borders or text-based spacing." },
        { id: "f2", type: "warning", title: "Missing Professional Profiles", text: "Ensure both active LinkedIn profile and GitHub links are formatted properly in header." }
      ],
      gapAdvice: 'Fullstack profiles require both client-side and server-side metrics. Add user volume stats and specify Next.js rendering paths used.',
      atsKeywords: ["Next.js SSR/ISR", "REST/GraphQL Endpoints", "Database Modeling", "CI/CD (GitHub Actions)", "AWS Deployment"]
    },
    swe: {
      grammar: [
        { id: "g1", type: "warning", title: "Casing Consistency", text: "Review framework casing (e.g., 'JavaScript' instead of 'javascript', 'SQL' instead of 'sql')." },
        { id: "g2", type: "warning", title: "Typographic Spacing", text: "Ensure spaces are placed correctly after commas and around slash marks." }
      ],
      technical: [
        { id: "t1", type: "error", title: "Core Architecture Description Lacking", text: "Needs description of backend design patterns (e.g., MVC, microservices, repository patterns) used in projects." },
        { id: "t2", type: "warning", title: "Testing Methodologies Absent", text: "Resume mentions code development but lacks mention of testing frameworks (e.g., Jest, JUnit, PyTest) and test coverage levels." }
      ],
      impact: [
        { id: "i1", type: "error", title: "Unquantified Project Impact", text: "Describe achievements using Google XYZ formula. Instead of 'built dashboard', use 'engineered performance dashboards, reducing data fetch latency by 20%'." },
        { id: "i2", type: "warning", title: "Passive Tone", text: "Passive verbs like 'worked on' or 'helped with' reduce impact. Use 'spearheaded', 'automated', or 'developed'." }
      ],
      formatting: [
        { id: "f1", type: "error", title: "Unparseable Graphic Elements", text: "Remove styling elements (skills stars, custom layouts) that break standard parsing logic." },
        { id: "f2", type: "warning", title: "Contact Header Incomplete", text: "Ensure email, phone number, and location (City, State) are clearly structured at the top." }
      ],
      gapAdvice: 'Incorporate software testing practices (unit/integration testing) and show quantitative impact (XYZ formula) in your project experience.',
      atsKeywords: ["Algorithms & Data Structures", "Design Patterns", "Unit & Integration Testing", "Git Version Control", "SQL Database Optimization"]
    },
    ml: {
      grammar: [
        { id: "g1", type: "warning", title: "AI Framework Casing", text: "Make sure terms like 'PyTorch' and 'TensorFlow' are capitalized correctly." },
        { id: "g2", type: "warning", title: "Hyphenation Typos", text: "Use standard 'scikit-learn' instead of 'scikit learn' in your technical list." }
      ],
      technical: [
        { id: "t1", type: "error", title: "Model Optimization Details Missing", text: "Lacks details on regularization or model optimization techniques (e.g., dropout, weight decay, hyperparameter tuning)." },
        { id: "t2", type: "error", title: "No Serving Frameworks Reference", text: "Mentions ML models but fails to explain deployment/serving tools used in production (e.g., FastAPI, ONNX, Triton, or Docker)." }
      ],
      impact: [
        { id: "i1", type: "error", title: "Unquantified Model Performance", text: "Fails Google XYZ formula: 'Built prediction systems' should show model performance (e.g., 'Improved F1-score from 0.81 to 0.94, reducing false positives by 22%')." },
        { id: "i2", type: "warning", title: "Weak Action Verbs", text: "Fails to showcase ownership: 'Worked on ML model'. Replace with 'Trained, evaluated, and deployed deep learning architectures'." }
      ],
      formatting: [
        { id: "f1", type: "error", title: "Math Symbols Rendering Issues", text: "Complex LaTeX symbols (like ∑ or β) in body text often fail ATS translation, appearing as garbled text strings." },
        { id: "f2", type: "warning", title: "Missing Hugging Face or Kaggle Link", text: "No Hugging Face, Kaggle, or GitHub link found. Essential for showcasing open-source machine learning portfolios." }
      ],
      gapAdvice: 'Your machine learning resume is missing model deployment details (MLOps) and model evaluation metrics (accuracy, F1-score). Add FastAPI/Docker serving details.',
      atsKeywords: ["MLOps & Serving (Triton/FastAPI)", "Hyperparameter Tuning", "Deep Learning Architectures", "PyTorch / TensorFlow", "Model Evaluation Metrics"]
    },
    devops: {
      grammar: [
        { id: "g1", type: "warning", title: "Tool Casing Consistency", text: "Ensure terms like 'Kubernetes' and 'Terraform' are correctly capitalized, not spelled as 'kubernets' or 'terraform'." },
        { id: "g2", type: "warning", title: "Punctuation consistency", text: "End all bullet points consistently with a period." }
      ],
      technical: [
        { id: "t1", type: "error", title: "Infrastructure as Code Details Vague", text: "Mentions cloud setup but lacks specific Terraform or CloudFormation details (e.g., modularization, state management)." },
        { id: "t2", type: "warning", title: "Monitoring Stack Missing", text: "Lacks references to observability tools like Prometheus, Grafana, ELK stack, or Datadog." }
      ],
      impact: [
        { id: "i1", type: "error", title: "Unquantified Cost/Deployment Improvements", text: "Bullet point says 'Reduced cloud costs.' Specify by how much (e.g., 'Orchestrated AWS cost governance, reducing monthly spend by 28%')." },
        { id: "i2", type: "warning", title: "Deployment latency not stated", text: "Instead of 'automated deployment pipeline', write 'Reduced deployment cycle time by 45% using GitHub Actions'." }
      ],
      formatting: [
        { id: "f1", type: "error", title: "Multi-Column Layout", text: "Dual-column layout causes parser to read DevOps tools and experience in a garbled sequence." },
        { id: "f2", type: "warning", title: "No Docker Hub or GitHub Link", text: "Provide a link to your GitHub to showcase your Infrastructure-as-Code repositories." }
      ],
      gapAdvice: 'Add quantitative metrics for cloud cost reductions and deployment speed improvements. Detail your infrastructure monitoring and alerting setup.',
      atsKeywords: ["Infrastructure as Code (Terraform)", "Kubernetes Container Orchestration", "CI/CD Pipelines (Jenkins/Actions)", "Cloud Infrastructure (AWS/GCP)", "Observability (Prometheus/Grafana)"]
    },
    pm: {
      grammar: [
        { id: "g1", type: "warning", title: "Terminology Capitalization", text: "Ensure product management terms like 'Scrum', 'Agile', and 'Jira' are capitalized correctly." },
        { id: "g2", type: "warning", title: "Abbreviations clarification", text: "Explain abbreviations like PRD or MVP on first mention, or use standard terms." }
      ],
      technical: [
        { id: "t1", type: "error", title: "Process Methodologies", text: "Lacks references to specific metric tracking structures: burndown charts, sprint velocity analytics, or OKR mapping." },
        { id: "t2", type: "warning", title: "Data Analytics tools missing", text: "Product managers need data. Mention analytics tools like SQL, Amplitude, Mixpanel, or Tableau." }
      ],
      impact: [
        { id: "i1", type: "error", title: "Weak Facilitation Verbs", text: "Passive verb 'Led scrum meetings' found. Replace with high-impact verbs: 'Facilitated agile iterations' or 'Orchestrated cross-functional roadmaps'." },
        { id: "i2", type: "warning", title: "No Delivery Metric", text: "Fails to quantify project delivery successes. Add metric details like: 'delivered product roadmap 3 weeks ahead of schedule, saving $35k in overhead'." }
      ],
      formatting: [
        { id: "f1", type: "error", title: "Floating Text Frames", text: "Floating text boxes/frames are skipped entirely by standard ATS engines. Ensure all text sits in main flow." },
        { id: "f2", type: "warning", title: "No Professional LinkedIn link", text: "Ensure your LinkedIn profile is clearly linked at the top of the resume." }
      ],
      gapAdvice: 'Your PM resume needs to highlight product metrics (conversion, retention, user growth) and data analysis skills (SQL/Mixpanel). Explain cross-functional leadership.',
      atsKeywords: ["Product Strategy & Roadmaps", "Agile/Scrum Methodology", "Cross-Functional Leadership", "Data Analytics (SQL/Amplitude)", "User Research & PRDs"]
    }
  };

  const mappedDomainGroup = {
    backend: 'backend', devops: 'devops', dataeng: 'backend', cloud: 'backend', solutions: 'backend', security: 'backend',
    frontend: 'frontend', design: 'frontend',
    fullstack: 'fullstack', swe: 'swe', mobile: 'fullstack', sdet: 'swe',
    ml: 'ml', ds: 'ml',
    pm: 'pm', em: 'pm'
  };

  const critiqueKey = mappedDomainGroup[normalizedDomain] || 'swe';
  const selectedCritique = fallbackCritiqueData[critiqueKey] || fallbackCritiqueData.swe;

  const fallbackQuestions = {
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
    swe: {
      general: [
        "Describe a challenging feature you implemented that required maintaining code quality and writing unit/integration tests.",
        "How do you stay up-to-date with software design patterns and best practices?",
        "Explain a time when you had to balance building features quickly with technical debt.",
        "How do you approach reviewing code for other team members, and what qualities do you look for?",
        "Describe a project where you had to work with complex legacy code that had little to no documentation.",
        "Tell me about a time you had to pivot your technical implementation late in a sprint due to changing requirements.",
        "Describe a time you had to resolve a high-pressure dispute between members of your engineering team.",
        "How do you communicate complex software architectural choices to non-technical stakeholders?",
        "Tell me about a time you proposed a tool or workflow change that significantly improved your team's velocity.",
        "Describe your process for onboarding to a large and highly complex software codebase."
      ],
      technical: [
        "Explain the difference between a process and a thread, and how multi-threading is handled in your primary programming language.",
        "How would you design a rate-limiting middleware for a public API endpoint?",
        "What data structures would you use to implement a lookup system that requires fast key-value retrieval and range queries?",
        "How does garbage collection work in your primary programming language, and how can you write code to avoid memory leaks?",
        "Explain how you would design a URL shortener service under a constraint of 10,000 requests per second.",
        "Describe how you would design a file-sharing system like Dropbox, highlighting metadata storage and chunk uploads.",
        "What is the difference between concurrency and parallelism, and how does your language of choice implement concurrency?",
        "Explain the SOLID design principles with concrete examples of how you apply them in object-oriented programming.",
        "How do you diagnose and resolve a deadlock in a multi-threaded or distributed database application?",
        "Explain compile-time vs run-time binding, and how polymorphism is resolved dynamically in your language."
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
    devops: {
      general: [
        "Describe a time when you had to manage an outage or post-mortem investigation for a production system.",
        "How do you approach introducing automated CI/CD processes to a team that is used to manual deployments?",
        "Tell me about a time you had to optimize cloud costs or resource utilization without affecting application performance.",
        "How do you balance developer speed (self-service deployments) with security constraints and cost budgets?",
        "Describe your strategy for conducting a blameless post-mortem after a critical cloud infrastructure outage.",
        "Tell me about a time you had to advocate for security improvements that slowed down the developer deployment loop.",
        "Describe a project where you migrated infrastructure from one cloud provider to another or from on-prem to cloud.",
        "How do you educate and onboard developers on containerization and logging practices?",
        "Tell me about a time you had to manage scaling infrastructure for a massive, sudden spike in traffic (e.g., Black Friday).",
        "How do you handle pager duties and prevent developer/operator alert fatigue?"
      ],
      technical: [
        "How would you design a multi-region high-availability infrastructure setup on AWS or GCP using Terraform?",
        "Explain the differences between containerization (Docker) and virtualization, and how Kubernetes schedules pods.",
        "How do you configure centralized logging and metric collection (Prometheus/Grafana/ELK) for a microservices cluster?",
        "How do you manage secrets, API keys, and environment variables securely in a Kubernetes-based production environment?",
        "What is blue-green deployment versus canary deployment, and how do you implement rollback triggers in CI/CD?",
        "Explain the difference between Terraform state files storage in local files vs. remote backends with state-locking.",
        "How does a Kubernetes Ingress controller differ from a NodePort service, and how would you configure SSL termination?",
        "What is GitOps, and how do tools like ArgoCD or Flux manage reconciliation loops between git repo and K8s clusters?",
        "Explain the difference between horizontal pod autoscaling (HPA) and cluster autoscaling (CA) in Kubernetes.",
        "How would you write a bash script or custom runner to automatically audit Dockerfiles for security leaks and root users?"
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

  const domainQuestions = fallbackQuestions[critiqueKey] || fallbackQuestions.swe;

  return {
    isFallback: true,
    fallbackReason: "Gemini API rate limited or quota exceeded",
    atsScore,
    roleMatch,
    candidateName,
    highestEducation,
    experienceYears,
    critique: {
      grammar: selectedCritique.grammar,
      technical: selectedCritique.technical,
      impact: selectedCritique.impact,
      formatting: selectedCritique.formatting
    },
    gapAdvice: selectedCritique.gapAdvice,
    atsKeywords: selectedCritique.atsKeywords,
    generalQuestions: domainQuestions.general,
    technicalQuestions: domainQuestions.technical
  };
}

const domainExpectations = {
  backend: {
    skills: ["Node.js", "Express", "Python", "Go", "Java", "PostgreSQL", "MongoDB", "Redis", "Kafka", "Docker", "AWS", "API", "REST", "gRPC", "Microservices", "GraphQL"],
    concepts: ["horizontal scaling", "database sharding", "caching layers", "distributed locks", "message queues", "ACID vs BASE", "API gateway", "query optimization"],
    metrics: ["API response latency (ms)", "database throughput (QPS)", "CPU/Memory resource reduction", "cache hit ratio"]
  },
  frontend: {
    skills: ["React", "Vue", "Angular", "TypeScript", "JavaScript", "HTML5", "CSS3", "Tailwind", "Webpack", "Vite", "Redux", "Zustand", "Sass", "UI/UX", "CSS"],
    concepts: ["Core Web Vitals (LCP, CLS, FID)", "state management paradigms", "bundle size optimization", "code splitting", "client-side caching", "SSR vs SSG vs ISR", "responsive design", "web accessibility (a11y)"],
    metrics: ["bundle size reduction (%)", "Time to Interactive (TTI)", "Largest Contentful Paint (LCP) reduction", "conversion rate improvements"]
  },
  fullstack: {
    skills: ["React", "Node.js", "Express", "TypeScript", "JavaScript", "PostgreSQL", "MongoDB", "Docker", "AWS", "REST", "GraphQL", "HTML5", "CSS3"],
    concepts: ["end-to-end data flow", "session/JWT auth patterns", "database modeling", "SSR vs client-side rendering", "API integration", "CI/CD pipelines", "WebSocket real-time communication"],
    metrics: ["user onboarding funnel optimization", "page speed improvements", "API latency", "daily active users (DAU) support"]
  },
  mobile: {
    skills: ["Swift", "SwiftUI", "Kotlin", "Java", "Flutter", "React Native", "iOS", "Android", "Xcode", "Android Studio"],
    concepts: ["offline caching", "mobile state management", "App Store/Play Store guidelines", "memory leak profiling", "push notifications", "cross-platform vs native layouts"],
    metrics: ["app crash rate reduction (%)", "app launch time reduction", "app bundle size reduction", "retention metrics"]
  },
  devops: {
    skills: ["Docker", "Kubernetes", "Terraform", "Ansible", "Jenkins", "GitHub Actions", "CI/CD", "AWS", "GCP", "Azure", "Linux", "Bash", "Prometheus", "Grafana"],
    concepts: ["Infrastructure as Code (IaC)", "container orchestration", "observability & telemetry stacks", "blue-green/canary deployments", "CI/CD automated testing gates", "cloud cost optimization"],
    metrics: ["deployment cycle time reduction", "cloud budget/infra cost reduction (%)", "mean time to recovery (MTTR)", "deployment frequency increase"]
  },
  ml: {
    skills: ["Python", "PyTorch", "TensorFlow", "Scikit-learn", "Pandas", "NumPy", "SQL", "Hugging Face", "FastAPI", "ONNX", "Triton"],
    concepts: ["model training and validation", "MLOps & serving pipelines", "hyperparameter tuning", "data & concept drift detection", "evaluation metrics (F1, ROC-AUC)", "deep learning neural architectures"],
    metrics: ["model inference latency (ms)", "model F1-score/Accuracy improvements", "false positive reduction (%)", "GPU utilization optimization"]
  },
  dataeng: {
    skills: ["Python", "SQL", "Spark", "Hadoop", "ETL", "Airflow", "Kafka", "Snowflake", "Databricks", "Data Warehouse", "AWS", "PostgreSQL"],
    concepts: ["data pipeline modeling", "ETL/ELT orchestration", "data warehouse schema design (Star/Snowflake)", "real-time stream processing", "data cataloging & governance", "query partitioning & clustering"],
    metrics: ["pipeline execution latency reduction", "query speed increase", "data ingestion volume support (TB/PB)", "data freshness improvement"]
  },
  security: {
    skills: ["Penetration Testing", "AppSec", "OAuth", "JWT", "SAML", "SSL/TLS", "Firewalls", "OWASP", "Vulnerability", "Cryptography", "IAM"],
    concepts: ["threat modeling", "secure authentication & token flows", "security vulnerability auditing (OWASP Top 10)", "role-based access control (RBAC)", "incident response planning", "secure software development lifecycle (SSDLC)"],
    metrics: ["vulnerability detection window reduction", "open high/critical CVE count", "security audit compliance rating"]
  },
  sdet: {
    skills: ["Selenium", "Cypress", "Playwright", "Jest", "Mocha", "JUnit", "QA", "Automation", "Testing", "CI/CD", "Jira"],
    concepts: ["end-to-end automation testing", "unit vs integration vs system test coverage", "continuous testing in CI/CD", "bug lifecycle tracking", "performance & load testing (k6/JMeter)", "test case management"],
    metrics: ["automated test coverage (%)", "release cycle bug leak rate", "test suite execution time reduction", "manual QA hours saved"]
  },
  swe: {
    skills: ["Software Engineering", "Algorithms", "Data Structures", "Java", "Python", "C++", "JavaScript", "TypeScript", "Git", "SQL", "Docker", "CI/CD"],
    concepts: ["clean code patterns (SOLID)", "object-oriented design", "data structures & search/sort algorithms", "git branch management", "unit testing & mock frameworks", "system design basics"],
    metrics: ["refactoring code coverage increase", "feature delivery velocity", "technical debt ticket reduction"]
  },
  pm: {
    skills: ["Product Roadmap", "Agile", "Scrum", "User Stories", "PRD", "SQL", "A/B Testing", "KPIs", "User Research", "Figma", "Jira"],
    concepts: ["product strategy & OKRs", "cross-functional roadmap coordination", "user journey mapping", "A/B testing statistical significance", "product requirements documents (PRD)", "retention vs acquisition metrics"],
    metrics: ["user conversion rate increase (%)", "user retention rate increase", "net promoter score (NPS) improvement", "time-to-market for major product feature"]
  },
  em: {
    skills: ["Engineering Leadership", "Agile", "Scrum", "Mentorship", "System Design", "Roadmap", "Budgeting", "SLA", "Architecture", "KPIs"],
    concepts: ["team delivery velocity tracking", "mentorship & career path mapping", "architectural governance & tech stack reviews", "resource allocation & hiring budget", "SLAs & platform uptime commitments", "agile sprint planning"],
    metrics: ["sprint velocity predictability (%)", "team retention rate", "platform uptime SLA percentage", "engineering cycle time reduction"]
  },
  ds: {
    skills: ["Python", "R", "SQL", "Pandas", "Machine Learning", "Statistics", "Tableau", "PowerBI", "A/B Testing", "Jupyter"],
    concepts: ["statistical hypothesis testing", "exploratory data analysis (EDA)", "data visualization techniques", "A/B testing sample size & power analysis", "predictive model selection", "cohort analysis"],
    metrics: ["analytical model accuracy", "A/B test business metric uplift", "business decision time reduction"]
  },
  design: {
    skills: ["Figma", "Sketch", "Adobe XD", "UI/UX", "Wireframing", "Prototyping", "Design Systems", "User Research"],
    concepts: ["user research & usability testing", "responsive wireframe layout", "interactive prototype design", "design system asset consistency", "user accessibility guidelines (WCAG)", "information architecture"],
    metrics: ["user task completion rate (%)", "user friction points reduction", "design handoff time reduction"]
  },
  cloud: {
    skills: ["AWS", "GCP", "Azure", "Cloud Architecture", "IAM", "VPC", "S3", "EC2", "Serverless", "Terraform", "Kubernetes"],
    concepts: ["multi-region disaster recovery", "cloud security shared responsibility model", "cost optimization & budget alerts", "serverless architecture", "infrastructure capacity planning", "hybrid cloud networking"],
    metrics: ["cloud infrastructure cost reduction (%)", "uptime/availability SLA improvement", "provisioning speed reduction"]
  },
  solutions: {
    skills: ["Enterprise Architecture", "Cloud Solutions", "System Design", "AWS", "Integration", "APIs", "SQL", "Microservices", "Scalability"],
    concepts: ["enterprise application integration (EAI)", "solutions design blueprinting", "vendor technical evaluation", "cloud migration strategies", "system scalability planning", "data flow security protocols"],
    metrics: ["integration timeline reduction", "migration budget cost savings", "uptime reliability metrics"]
  },
  consulting: {
    skills: ["Management Consulting", "Strategy", "Data Analysis", "Financial Modeling", "Excel", "PowerPoint", "KPIs"],
    concepts: ["MECE structuring", "profitability & market sizing frameworks", "industry vertical business models", "slide deck design & narrative storyboarding", "quantitative business analysis", "stakeholder interviews"],
    metrics: ["operating expense reduction recommendations ($)", "revenue optimization percentage", "project delivery timeliness"]
  },
  finance: {
    skills: ["Financial Analysis", "Valuation", "DCF", "LBO", "Accounting", "Excel", "Bloomberg", "SQL", "Equity Research"],
    concepts: ["three-statement financial modeling", "Discounted Cash Flow (DCF) valuation", "Leveraged Buyout (LBO) analysis", "comparable company analysis (CCA)", "equity research metrics", "capital asset pricing model (CAPM)"],
    metrics: ["valuation projection precision", "model audit correction rate", "investment return recommendations (%)"]
  },
  bizdev: {
    skills: ["Business Development", "Sales Pipeline", "CRM", "Salesforce", "Lead Generation", "Negotiation", "Partnerships", "KPIs"],
    concepts: ["sales pipeline management", "strategic partnership sourcing", "contract negotiation parameters", "CRM contact database maintenance", "target market outreach scripts", "sales presentation messaging"],
    metrics: ["sales quota achievement percentage", "pipeline deal volume expansion", "partnership contract revenue ($)"]
  },
  financial: {
    skills: ["Financial Statements", "Excel", "Budgeting", "Forecasting", "Auditing", "SQL", "Variance Analysis", "Reporting"],
    concepts: ["budget variance analysis", "forecasting capital expenditure", "financial reporting compliance", "cost-benefit project evaluation", "internal audit review guidelines", "treasury cache management"],
    metrics: ["forecasting error rate reduction", "audit compliance issues resolved", "reporting cycle timeline reduction"]
  },
  strategy: {
    skills: ["Operations", "Strategy", "Business Analyst", "KPIs", "Process Improvement", "SQL", "Tableau", "Agile", "Roadmap"],
    concepts: ["process bottlenecks mapping (Six Sigma)", "strategic priority prioritization (matrix)", "operational throughput balancing", "key performance indicator tracking dashboards", "cross-functional project coordination", "customer experience improvement loops"],
    metrics: ["process cycle time reduction", "operational throughput efficiency increase (%)", "resource allocation savings ($)"]
  },
  vc: {
    skills: ["Venture Capital", "Deal Flow", "Due Diligence", "Financial Modeling", "Valuation", "Startups", "Market Trends", "Pitch Deck"],
    concepts: ["deal flow vetting criteria", "comprehensive startup due diligence", "cap table mechanics & dilution modeling", "market sizing (TAM/SAM/SOM)", "startup valuation analysis", "exit return scenario analysis"],
    metrics: ["deal conversion/vetting rate", "investment return prediction accuracy", "deal flow pipeline volume"]
  }
};

// Local Q&A fallback query responder
function fallbackQueryResponse(resumeText, question) {
  const q = (question || "").toLowerCase();
  let answer = "";

  if (q.includes("project") || q.includes("work") || q.includes("experience") || q.includes("achieve") || q.includes("done")) {
    answer = `Based on your resume, you have solid experience. Our local analysis engine highlights the following:
• Your professional background spans multiple projects and roles, indicating strong technical execution.
• Key achievements focus on building applications, deploying systems, and handling user requirements.
• To improve your experience descriptions, we suggest framing each point using the Google XYZ formula: 'Accomplished [X] as measured by [Y], by doing [Z]'.

If you have specific questions about a particular role or project, feel free to ask! (Note: Running in local fallback mode due to Gemini rate limits).`;
  } else if (q.includes("skill") || q.includes("tech") || q.includes("language") || q.includes("framework") || q.includes("tool")) {
    const commonTech = ["react", "node", "javascript", "typescript", "python", "sql", "postgres", "mongodb", "aws", "docker", "kubernetes", "git", "java", "c++", "terraform", "html", "css"];
    const found = [];
    commonTech.forEach(t => {
      if (new RegExp(`\\b${t}\\b`, 'i').test(resumeText)) {
        found.push(t.charAt(0).toUpperCase() + t.slice(1));
      }
    });
    
    answer = `Reviewing the technologies in your resume, here are the tools we identified:
• **Detected Stack:** ${found.length > 0 ? found.join(", ") : "General programming tools"}
• **Strengths:** You have key languages/tools that form a strong core for your domain.
• **Suggestions:** Make sure to highlight not just *knowing* these tools, but how you applied them to solve scale, performance, or business problems. For example, explain how you configured cache sizes in Redis or modularized states in Redux.

(Note: Running in local fallback mode due to Gemini rate limits).`;
  } else if (q.includes("education") || q.includes("degree") || q.includes("college") || q.includes("university") || q.includes("study")) {
    answer = `Analyzing the education section of your resume:
• Your profile lists your academic background, which establishes your foundational computer science/engineering/business concepts.
• **Advice:** Keep this section concise. Unless you are a recent graduate (less than 1-2 years out), your work experience and projects should take priority on your resume. Limit GPA mentions unless it is above 3.8.

(Note: Running in local fallback mode due to Gemini rate limits).`;
  } else if (q.includes("gap") || q.includes("weak") || q.includes("miss") || q.includes("improve") || q.includes("ats")) {
    answer = `To optimize your resume for ATS and recruiter scans, focus on these areas:
1. **Remove self-rating visual bars/stars:** These cannot be parsed by standard OCR and ATS algorithms.
2. **Quantify achievements:** Ensure at least 60% of your experience bullet points include a measurable outcome (e.g. '% speedup', 'hours saved', '$ saved').
3. **Include core terms in context:** Don't just list technologies in a 'Skills' section; integrate them into your job description bullets to prove hands-on usage.

(Note: Running in local fallback mode due to Gemini rate limits).`;
  } else {
    answer = `Hello! Based on a local scan of your resume:
• Your resume contains a solid foundation for your target domain.
• To optimize it, ensure your layout is single-column, remove tables/graphics, and write clear, impact-focused accomplishments.
• Let me know if you want to know about your technical stack, projects, or how to phrase a specific bullet point!

(Note: Running in local fallback mode due to Gemini rate limits).`;
  }

  return {
    success: true,
    isFallback: true,
    answer
  };
}

// Route: Parse and Analyze Resume
app.post('/api/analyze-resume', upload.single('resume'), async (req, res) => {
  try {
    const { domain, resumeText: rawResumeText } = req.body;
    const file = req.file;

    if (!file && !rawResumeText) {
      return res.status(400).json({ error: "No resume file uploaded or text provided. Please upload a PDF/DOCX or paste your resume text." });
    }
    if (!domain) {
      return res.status(400).json({ error: "Job role domain target is required." });
    }

    // 2. Extract Text
    let resumeText = "";
    if (file) {
      const mimeType = file.mimetype;
      const originalName = file.originalname || "";
      const ext = originalName.split('.').pop().toLowerCase();

      const isPdf = mimeType === 'application/pdf' || ext === 'pdf';
      const isWord = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                     mimeType === 'application/msword' || 
                     ext === 'docx' || 
                     ext === 'doc';

      // Logging for diagnostics
      try {
        const debugLog = `[${new Date().toISOString()}] Uploaded file: name="${originalName}", size=${file.size} bytes, mimeType="${mimeType}", ext="${ext}", isPdf=${isPdf}, isWord=${isWord}\n`;
        fs.appendFileSync('./pdf_debug.log', debugLog);
      } catch (e) {
        console.error("Failed to write debug log:", e);
      }

      if (isPdf) {
        try {
          const parsed = await pdfParse(file.buffer);
          resumeText = parsed.text;
          try {
            fs.appendFileSync('./pdf_debug.log', `[${new Date().toISOString()}] PDF parsing succeeded. Extracted characters length: ${resumeText.length}\n`);
          } catch (e) {}
        } catch (err) {
          console.error("PDF extraction failed:", err);
          try {
            fs.appendFileSync('./pdf_debug.log', `[${new Date().toISOString()}] PDF parsing FAILED: ${err.message}\nStack: ${err.stack}\n`);
          } catch (e) {}
          return res.status(500).json({ error: "Failed to parse PDF document structure." });
        }
      } else if (isWord) {
        try {
          const parsed = await mammoth.extractRawText({ buffer: file.buffer });
          resumeText = parsed.value;
          try {
            fs.appendFileSync('./pdf_debug.log', `[${new Date().toISOString()}] Word parsing succeeded. Extracted characters length: ${resumeText.length}\n`);
          } catch (e) {}
        } catch (err) {
          console.error("Word document extraction failed:", err);
          try {
            fs.appendFileSync('./pdf_debug.log', `[${new Date().toISOString()}] Word parsing FAILED: ${err.message}\nStack: ${err.stack}\n`);
          } catch (e) {}
          return res.status(500).json({ error: "Failed to parse DOCX document text. Please make sure it is a valid .docx file (binary .doc is not supported)." });
        }
      } else {
        try {
          fs.appendFileSync('./pdf_debug.log', `[${new Date().toISOString()}] File rejected: unsupported format.\n`);
        } catch (e) {}
        return res.status(400).json({ error: "Unsupported file type. Please upload a PDF (.pdf) or Word (.docx) document." });
      }
    } else {
      resumeText = rawResumeText;
      try {
        fs.appendFileSync('./pdf_debug.log', `[${new Date().toISOString()}] Plain text resume received. Characters length: ${resumeText.length}\n`);
      } catch (e) {}
    }

    if (!resumeText.trim()) {
      return res.status(400).json({ error: "Could not extract text. Ensure document/text is not empty." });
    }

    console.log(`Extracted ${resumeText.length} characters of resume text. Prompting Groq AI for domain: ${domain}...`);

    const targetDomainKey = (domain || 'swe').toLowerCase().trim();
    const expectations = domainExpectations[targetDomainKey] || domainExpectations.swe;
    const domainExpectationsPrompt = `
For the target role "${domain}", here are the specific technical/business expectations you MUST evaluate the resume against:
- Core Required Skills/Stack: ${expectations.skills.join(", ")}
- Essential Concepts & Architectural/Strategic Paradigms: ${expectations.concepts.join(", ")}
- Key Quantifiable Metrics Expected: ${expectations.metrics.join(", ")}
`;

    let analysisResult;

    const systemPrompt = `You are a professional ATS (Applicant Tracking System) parser and an elite technical recruiter.
Analyze the following resume text against the target job domain/role: "${domain}".

You must perform a deep, individualized, and highly context-specific comparison between the candidate's actual resume content and the requirements of the target role:
- Read the target domain requirements listed below and perform a rigorous comparative audit.
- DO NOT use generic, boilerplate templates or repetitive suggestions.
- If there is a domain mismatch (e.g., the candidate's background is mostly React frontend or marketing, but the target role is Backend, Machine Learning / AI, or Cloud Architect), you MUST be highly critical: the "atsScore" and "roleMatch" MUST be strictly set below 50.
- Every single critique item in your response MUST refer to specific words, projects, companies, or technologies that are actually present (or clearly missing) in the user's resume.
- For spelling and casing mistakes: point out the exact typo and the surrounding context.
- For technical gaps: detail the exact concepts or frameworks from the target domain expectations that are missing and suggest how they should be integrated into the candidate's existing projects.
- For impact: pick a specific bullet point from their resume and rewrite it using the Google XYZ formula (Accomplished [X], as measured by [Y], by doing [Z]).
- For ATS layout issues: analyze the actual structure and outline risks (like multi-columns or graphics) if present.

${domainExpectationsPrompt}

Evaluate the resume and calculate a realistic, critical ATS score between 30 and 95. Be highly critical and objective:
- Freshers/students or weak resumes with no professional experience should score between 30 and 55.
- An average resume should score between 40 and 70.
- Do NOT output high scores (e.g. 80-90+) unless the resume is exceptionally well-tailored, quantified with Google XYZ formula metrics, and free of typos/layout issues.
- Calculate the score realistically: deduct points for each typo, layout risk, unquantified metric, or missing core domain technology.

Return your analysis strictly as a JSON object matching this schema:
{
  "atsScore": 85,
  "roleMatch": 90,
  "candidateName": "Extracted Candidate Name (or default to 'Alex Rivera' if name is not found)",
  "highestEducation": "Extracted Education (e.g., 'B.S. Computer Science' or 'M.S. Comp Sci' or 'MBA' or default to 'B.S. Computer Science' if not found)",
  "experienceYears": "Extracted Experience length (e.g. '3.5 Yrs' or '0 Yrs' for freshers/students, or default to '0 Yrs' if no experience is found)",
  "critique": {
    "grammar": [
      { "id": "g1", "type": "error", "title": "Issue Title", "text": "Specific critique text explaining spelling, typos, casing, or punctuation issues." }
    ],
    "technical": [
      { "id": "t1", "type": "error", "title": "Missing Technologies", "text": "Specific critique explaining missing scale patterns, databases, frameworks, or cloud infrastructure needed for this role." }
    ],
    "impact": [
      { "id": "i1", "type": "warning", "title": "Action Verb / Metrics", "text": "Critique pointing out passive/weak verbs or lack of quantified accomplishments." }
    ],
    "formatting": [
      { "id": "f1", "type": "error", "title": "Formatting Risk", "text": "Critique pointing out multi-column layout risks, star rating systems, or missing profile contact URLs." }
    ]
  },
  "gapAdvice": "General advice summarizing key domain gaps found in the resume.",
  "atsKeywords": ["Recommended key, comma-separated ATS terms to add"],
  "generalQuestions": ["Array of exactly 10 customized general/behavioral interview questions based on the candidate's resume and target domain."],
  "technicalQuestions": ["Array of exactly 10 customized technical/role-specific interview questions based on the candidate's resume and target domain."]
}

Guidelines for the critique items and questions:
- Make sure each critique category contains 2 to 4 detailed items.
- Set type: 'error' for severe issues (e.g. multi-column layouts, typos in critical keywords like Kubernetes, or major lack of core domain stack).
- Set type: 'warning' for minor improvements (e.g. double spacing, weak action verbs, lack of metrics).
- Ensure all critique texts are actionable and explain both the issue and the correction.
- Ensure the generalQuestions array contains exactly 10 customized, high-quality general or behavioral questions.
- Ensure the technicalQuestions array contains exactly 10 customized, high-quality technical or role-specific questions.

Resume Text to Analyze:
---
${resumeText}
---

IMPORTANT: Return ONLY the raw valid JSON string. Do not wrap the JSON object in markdown blocks (like \`\`\`json ... \`\`\`) or include any introductory/concluding explanations. The response must be directly parsable by JSON.parse() in Javascript.`;

    // Call Groq directly — no fallbacks
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.trim() === "") {
      return res.status(503).json({ error: "GROQ_API_KEY is not configured on the server. Please add it to server/.env and restart." });
    }

    try {
      console.log("Calling Groq API for resume analysis...");
      const responseText = await callWithRetry(() => callGroqChat(
        "You are a professional ATS parser and technical recruiter. Output strictly valid JSON objects matching user schema. No preamble, no postamble.",
        systemPrompt,
        "llama-3.3-70b-versatile",
        true
      ));

      let cleanedText = responseText.trim();
      cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      analysisResult = JSON.parse(cleanedText);

      if (!analysisResult.generalQuestions || !Array.isArray(analysisResult.generalQuestions)) analysisResult.generalQuestions = [];
      if (!analysisResult.technicalQuestions || !Array.isArray(analysisResult.technicalQuestions)) analysisResult.technicalQuestions = [];

      console.log("Groq API resume analysis succeeded.");
      try { fs.appendFileSync('./pdf_debug.log', `[${new Date().toISOString()}] Groq API succeeded.\n`); } catch (e) {}
    } catch (err) {
      console.error("Groq API resume analysis failed:", err.message);
      try { fs.appendFileSync('./pdf_debug.log', `[${new Date().toISOString()}] Groq API FAILED: ${err.message}\n`); } catch (e) {}
      return res.status(503).json({ error: `Groq API error: ${err.message}` });
    }

    // Save to Database
    const savedId = await saveAnalysis({
      domain,
      fileName: file ? file.originalname : "Plain_Text_Paste",
      fileSize: file ? file.size : Buffer.byteLength(resumeText, 'utf8'),
      analysis: analysisResult,
      isFallback: false,
      provider: "groq"
    });

    // Response
    res.json({
      success: true,
      analysisId: savedId,
      extractedText: resumeText,
      provider: "groq",
      ...analysisResult
    });

  } catch (error) {
    console.error("API analysis route error:", error);
    res.status(500).json({ error: error.message || "Server error during resume analysis pipeline." });
  }
});

// Route: Query Analyzed Resume (Q&A Chat)
app.post('/api/query-resume', async (req, res) => {
  try {
    const { resumeText, question, userProfile } = req.body;
    if (!resumeText || !question) {
      return res.status(400).json({ error: "Both resumeText and question are required." });
    }

    let answer = "";
    let isFallbackMode = false;
    let activeProvider = "groq";

    let userContextPrompt = "";
    if (userProfile && typeof userProfile === 'object') {
      const { name, domain, experience, education, dreamCompany, atsScore, roleMatch } = userProfile;
      userContextPrompt = `Candidate Profile:
- Name: ${name || "Candidate"}
- Target Domain: ${domain || "Software Engineering"}
- Experience Level: ${experience || "0 Yrs"}
- Highest Education: ${education || "N/A"}
- Dream Target Company: ${dreamCompany || "Google/Stripe"}
- Current ATS Score: ${atsScore || "N/A"}
- Role Match Rating: ${roleMatch || "N/A"}
`;
    }

    const systemPrompt = `You are a professional technical recruiter and career coach.
Answer the candidate's query constructively and concisely based on the following candidate's details:

${userContextPrompt}

--- RESUME START ---
${resumeText}
--- RESUME END ---

Candidate Question: "${question}"

Provide a highly relevant, encouraging, and actionable answer.`;

    // Call Groq directly — no fallbacks
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.trim() === "") {
      return res.status(503).json({ error: "GROQ_API_KEY is not configured on the server." });
    }

    try {
      console.log("Calling Groq API for resume Q&A...");
      answer = await callWithRetry(() => callGroqChat(
        "You are a professional technical recruiter and career coach. Answer questions constructively based on resume context.",
        systemPrompt,
        "llama-3.3-70b-versatile",
        false
      ));
      console.log("Groq API Q&A succeeded.");
    } catch (err) {
      console.error("Groq API Q&A failed:", err.message);
      return res.status(503).json({ error: `Groq API error: ${err.message}` });
    }

    res.json({
      success: true,
      isFallback: false,
      provider: "groq",
      answer
    });
  } catch (error) {
    console.error("Resume query endpoint error:", error);
    res.status(500).json({ error: error.message || "Server error during Q&A chatbot response." });
  }
});

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, domain } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const newUser = {
      name,
      email,
      password,
      domain: domain || 'swe',
      onboardingCompleted: false
    };

    await saveUser(newUser);

    res.json({
      success: true,
      user: {
        name: newUser.name,
        email: newUser.email,
        domain: newUser.domain,
        onboardingCompleted: false
      }
    });
  } catch (err) {
    console.error("Signup endpoint error:", err);
    res.status(500).json({ error: "Server error during registration." });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await findUserByEmail(email);
    if (!user || user.password !== password) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    res.json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        domain: user.domain,
        onboardingCompleted: user.onboardingCompleted || false,
        experienceYears: user.experienceYears || '',
        highestEducation: user.highestEducation || '',
        dreamCompany: user.dreamCompany || '',
        linkedinUrl: user.linkedinUrl || '',
        githubUrl: user.githubUrl || ''
      }
    });
  } catch (err) {
    console.error("Login endpoint error:", err);
    res.status(500).json({ error: "Server error during login." });
  }
});

app.post('/api/auth/onboarding', async (req, res) => {
  try {
    const { email, experienceYears, highestEducation, dreamCompany, linkedinUrl, githubUrl } = req.body;
    if (!email) {
      return res.status(400).json({ error: "User email is required." });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "User account not found." });
    }

    const updatedFields = {
      ...user,
      experienceYears: experienceYears || '',
      highestEducation: highestEducation || '',
      dreamCompany: dreamCompany || '',
      linkedinUrl: linkedinUrl || '',
      githubUrl: githubUrl || '',
      onboardingCompleted: true
    };

    await saveUser(updatedFields);

    res.json({
      success: true,
      user: {
        name: updatedFields.name,
        email: updatedFields.email,
        domain: updatedFields.domain,
        onboardingCompleted: true,
        experienceYears: updatedFields.experienceYears,
        highestEducation: updatedFields.highestEducation,
        dreamCompany: updatedFields.dreamCompany,
        linkedinUrl: updatedFields.linkedinUrl,
        githubUrl: updatedFields.githubUrl
      }
    });
  } catch (err) {
    console.error("Onboarding endpoint error:", err);
    res.status(500).json({ error: "Server error during onboarding." });
  }
});

// Route: General Doubt Chatbot
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, domain, resumeText, userProfile } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    let answer = "";
    let isFallbackMode = false;
    let activeProvider = "groq";

    // Build history content if present
    let historyPrompt = "";
    if (history && Array.isArray(history)) {
      historyPrompt = "Conversation history:\n" + history.map(h => `${h.sender === 'user' ? 'User' : 'AI'}: ${h.text}`).join('\n') + "\n";
    }

    let userContextPrompt = "";
    if (userProfile && typeof userProfile === 'object') {
      const { name, experience, education, dreamCompany, atsScore, roleMatch } = userProfile;
      userContextPrompt = `Candidate Profile Context:
- Name: ${name || "Candidate"}
- Target Domain: ${domain || "Software Engineering"}
- Experience Level: ${experience || "0 Yrs"}
- Highest Education: ${education || "N/A"}
- Dream Target Company: ${dreamCompany || "Google/Stripe"}
- Current ATS Score: ${atsScore || "N/A"}
- Role Match Rating: ${roleMatch || "N/A"}
`;
    } else {
      userContextPrompt = `Candidate Domain: ${domain || "Software Engineering"}\n`;
    }

    const systemPrompt = `You are Stitch AI Doubt Tutor, an elite 24/7 technical interviewer and career coach.
You help candidates prepare for SDE, PM, Finance, and Consulting interviews.
Answer the user's question constructively, encouragingly, and concisely (under 3-4 paragraphs or bullet points).

Here is the candidate's personal profile context:
--- PROFILE START ---
${userContextPrompt}
--- PROFILE END ---

${resumeText ? `Here is the candidate's resume context to personalize your advice:\n--- RESUME START ---\n${resumeText}\n--- RESUME END ---\n` : ""}

${historyPrompt}
User's Question: "${message}"`;

    // Call Groq directly — no fallbacks
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.trim() === "") {
      return res.status(503).json({ error: "GROQ_API_KEY is not configured on the server." });
    }

    try {
      console.log("Calling Groq API for chatbot...");
      answer = await callWithRetry(() => callGroqChat(
        "You are Stitch AI Doubt Tutor, an elite career coach. Answer concisely and constructively.",
        systemPrompt,
        "llama-3.3-70b-versatile",
        false
      ));
      console.log("Groq API chatbot query succeeded.");
    } catch (err) {
      console.error("Groq API chatbot failed:", err.message);
      return res.status(503).json({ error: `Groq API error: ${err.message}` });
    }

    res.json({
      success: true,
      isFallback: false,
      provider: "groq",
      answer
    });
  } catch (error) {
    console.error("General chatbot endpoint error:", error);
    res.status(500).json({ error: error.message || "Server error during chatbot doubt resolution." });
  }
});

// POST: Local audio transcription fallback endpoint
app.post('/api/interview/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided." });
    }

    const audioBuffer = req.file.buffer;
    let mimeType = req.file.mimetype || 'audio/webm';
    // Clean mimeType from codecs parameters (e.g. "audio/webm;codecs=opus" -> "audio/webm")
    mimeType = mimeType.split(';')[0].trim();
    const filename = req.file.originalname || `recording.${mimeType.split('/')[1] || 'webm'}`;

    console.log(`Transcribing uploaded audio of size ${audioBuffer.length} bytes (Mime: ${mimeType})...`);

    let text = "";
    let transcriptionError = null;

    // Primary: Try Groq Whisper (Whisper large v3 is extremely fast and accurate)
    try {
      const apiKey = process.env.GROQ_API_KEY;
      if (apiKey && apiKey.trim() !== "") {
        const formData = new FormData();
        const blob = new Blob([audioBuffer], { type: mimeType });
        formData.append('file', blob, filename);
        formData.append('model', 'whisper-large-v3');
        formData.append('language', 'en');
        formData.append('prompt', "Transcribe the speech exactly as spoken, retaining verbal stutters, repetitions, and filler words like 'um', 'uh', 'like', 'so', 'you know', 'actually', 'basically'. Recognize tech and software engineer acronyms correctly like SDE, SDE1, SDE2, JavaScript, React, Kubernetes.");

        console.log("Calling Groq Whisper transcription API...");
        const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey.trim()}`
          },
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          text = (data.text || "").trim();
          console.log(`Successfully transcribed audio via Groq Whisper: "${text}"`);
        } else {
          const errText = await response.text();
          throw new Error(`Groq Whisper failed (status ${response.status}): ${errText}`);
        }
      } else {
        throw new Error("GROQ_API_KEY is missing or empty.");
      }
    } catch (groqErr) {
      console.warn("Groq Whisper transcription failed or skipped, attempting Gemini fallback:", groqErr.message);
      transcriptionError = groqErr;
    }

    // Secondary/Fallback: Try Gemini 2.0 Flash
    if (!text && ai) {
      try {
        const base64Audio = audioBuffer.toString('base64');
        const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });
        console.log("Calling Gemini 2.0 Flash fallback transcription API...");
        const response = await callWithRetry(async () => {
          return await model.generateContent([
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Audio
              }
            },
            "Transcribe this spoken response exactly as heard in English. Be accurate with technical and software development terms like SDE, SDE1, SDE2, etc. Keep all verbal stutters and filler words like 'um', 'uh', 'like', 'so', 'you know', 'actually', 'basically'. If there is no speech or it is silent, respond with an empty string. Do not include any explanations, headers, formatting, or prefixes."
          ]);
        });

        text = response.response.text().trim();
        console.log(`Successfully transcribed audio via Gemini: "${text}"`);
      } catch (geminiErr) {
        console.error("Gemini transcription fallback also failed:", geminiErr.message);
        transcriptionError = geminiErr;
      }
    }

    if (!text && transcriptionError) {
      throw transcriptionError;
    }

    res.json({ success: true, text });
  } catch (error) {
    console.error("Transcription endpoint error:", error);
    res.status(500).json({ error: error.message || "Failed to transcribe audio." });
  }
});

// GET: Fetch session details and report by ID
app.get('/api/interview/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const dbPath = './db_sessions_fallback.json';
    let sessions = [];
    if (fs.existsSync(dbPath)) {
      try {
        sessions = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
      } catch (e) {
        console.error("Error reading database sessions fallback:", e);
      }
    }
    if (!Array.isArray(sessions)) {
      sessions = [];
    }
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }
    res.json({
      success: true,
      session
    });
  } catch (err) {
    console.error("GET session error:", err);
    res.status(500).json({ error: err.message || "Server error fetching session details." });
  }
});

// GET: Fetch all completed interview sessions
app.get('/api/interview/sessions', async (req, res) => {
  try {
    const dbPath = './db_sessions_fallback.json';
    let sessions = [];
    if (fs.existsSync(dbPath)) {
      try {
        sessions = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
      } catch (e) {
        console.error("Error reading database sessions fallback:", e);
      }
    }
    if (!Array.isArray(sessions)) {
      sessions = [];
    }
    // Sort by completion time or start time descending
    sessions.sort((a, b) => (b.completedAt || b.startTime || 0) - (a.completedAt || a.startTime || 0));
    res.json({
      success: true,
      sessions
    });
  } catch (err) {
    console.error("GET all sessions error:", err);
    res.status(500).json({ error: err.message || "Server error fetching sessions list." });
  }
});

// POST: Generate Post-Interview Feedback Report
const activeReportPromises = new Map();

app.post('/api/interview/report', async (req, res) => {
  try {
    const { sessionId, customTranscript } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required." });
    }

    // Single-Flight: Coalesce concurrent requests for the same session ID
    if (activeReportPromises.has(sessionId)) {
      console.log(`[Single-Flight] Report generation already in progress for session ${sessionId}. Coalescing request...`);
      try {
        const reportResult = await activeReportPromises.get(sessionId);
        return res.json(reportResult);
      } catch (err) {
        return res.status(500).json({ error: err.message || "Failed to generate interview report in parallel worker." });
      }
    }

    // Define the async generator task
    const generateTask = (async () => {
      // Load the session from db_sessions_fallback.json
      const dbPath = './db_sessions_fallback.json';
      let sessions = [];
      if (fs.existsSync(dbPath)) {
        try {
          sessions = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
        } catch (e) {
          console.error("Error reading database sessions fallback:", e);
        }
      }
      if (!Array.isArray(sessions)) {
        sessions = [];
      }

      let session = sessions.find(s => s.id === sessionId);
      
      // If session is not found but customTranscript is provided, we can simulate or create one
      if (!session && customTranscript) {
        session = {
          id: sessionId,
          mode: 'jd',
          title: 'Interview Session',
          company: 'Target Company',
          transcript: customTranscript
        };
      }

      if (!session) {
        throw new Error("Interview session not found.");
      }

      // If a report is already saved in the database during our wait or check, return it immediately
      if (session.report) {
        console.log(`[Single-Flight] Cached report found in database during task initialization for session ${sessionId}.`);
        return {
          success: true,
          report: session.report,
          sessionDetails: {
            id: session.id,
            mode: session.mode,
            title: session.title,
            company: session.company,
            transcript: session.transcript
          }
        };
      }

      const transcriptText = session.transcript
        .map(item => `${item.sender === 'candidate' ? 'Candidate' : 'Interviewer'}: ${item.text}`)
        .join('\n');

      if (!transcriptText || session.transcript.length === 0) {
        throw new Error("Cannot analyze an empty interview transcript.");
      }
      console.log(`Generating feedback report for session ${sessionId} with ${session.transcript.length} turns...`);

      // Prepare system instructions for Groq analysis
      const systemPrompt = `You are an elite, highly critical senior technical interviewer and principal engineer auditing a completed interview transcript.
Analyze the conversation transcript between the candidate and the interviewer.
Calculate metrics and evaluate performance strictly:
1. You must grade VERY CRITICALLY and STRICTLY. Do not hand out high scores easily. Average answers should get around 40-60. Excellent answers should get 75-85. Outstanding answers 85+.
2. If the candidate gives unnecessary, irrelevant, vague, off-topic, or filler-filled answers, penalize them heavily.
3. CRITICAL PENALTY FOR UNNECESSARY OR MEDIOCRE ANSWERS: If a candidate response is irrelevant, empty, off-topic, waffling, or repeating the question without real technical depth, you MUST grade that turn extremely low (score of 0-30 for that turn) and pull down the overall score significantly. Even if the text seems long, if it doesn't answer the question correctly or says unnecessary things, mark it as poor.
4. Evaluate correctness against real software engineering principles, system architecture designs, and technical accuracy. If they waffle or ramble without concrete facts, grade it as poor.
5. The overall "score" (0-100) must reflect the exact average quality of their answers. If their response is irrelevant or empty, give a score of 0-30 for that turn.

You must output a valid JSON object matching the exact structure below. Do not wrap in markdown or prefix/suffix the response. Renders MUST be pure, valid JSON:
{
  "score": 75,
  "wpm": 120,
  "fillerWords": 12,
  "hesitationDuration": "15 seconds",
  "correctnessFeedback": "Summary of answer accuracy compared to the expected technical baseline.",
  "clarityFeedback": "Summary of whether they explained complex ideas concisely or rambled.",
  "qaAudit": [
    {
      "question": "Question asked by the interviewer",
      "userResponse": "Response given by the candidate",
      "critique": "Brief evaluation of what was good, what was wrong, and what was missing.",
      "idealAnswer": "Provide the exact ideal technical answer they should have formulated, including industry-standard terms and framework metrics."
    }
  ]
}`;

      const userPrompt = `Interview Mode: ${session.mode || 'jd'}
Job Title: ${session.title || 'Technical Role'}
Company Target: ${session.company || 'Target Company'}

Conversation Transcript:
--- TRANSCRIPT START ---
${transcriptText}
--- TRANSCRIPT END ---

Evaluate this interview transcript and respond with the exact JSON formatting structure requested.`;

      let reportText = "";
      try {
        if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.trim() === "") {
          throw new Error("GROQ_API_KEY is not configured on the server.");
        }

        reportText = await callWithRetry(() => callGroqChat(
          systemPrompt,
          userPrompt,
          "llama-3.3-70b-versatile",
          true // JSON Mode
        ));
      } catch (err) {
        console.error("Groq API failed for interview audit, attempting Gemini fallback:", err.message);
        try {
          if (!ai) {
            throw new Error("Gemini AI client instance is not initialized.");
          }
          console.log("Calling Gemini 2.0 Flash fallback for interview report generation...");
          const model = ai.getGenerativeModel({ 
            model: "gemini-2.0-flash",
            generationConfig: { responseMimeType: "application/json" }
          });
          const result = await callWithRetry(async () => {
            return await model.generateContent([
              systemPrompt,
              userPrompt
            ]);
          });
          reportText = result.response.text();
        } catch (geminiErr) {
          console.error("Gemini fallback also failed for interview audit:", geminiErr.message);
          reportText = JSON.stringify({
            score: 50,
            wpm: 100,
            fillerWords: 12,
            hesitationDuration: "15 seconds",
            correctnessFeedback: "API rate limit or connection issue. Local analysis fallback activated. Baseline grading applied. Detailed AI evaluation could not be run.",
            clarityFeedback: "Response structures could not be analyzed dynamically.",
            qaAudit: session.transcript
              .filter(t => t.sender === 'interviewer')
              .map((q, idx) => {
                const userAns = session.transcript.find((u, uidx) => uidx > idx && u.sender === 'candidate');
                return {
                  question: q.text,
                  userResponse: userAns ? userAns.text : "No response recorded.",
                  critique: "The candidate answered but did not provide specific KPIs or architectural parameters.",
                  idealAnswer: "Incorporate system scale specs, specific technologies used, and state performance improvements."
                };
              })
          });
        }
      }

      let reportJson = {};
      try {
        let cleanedText = reportText.trim();
        cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        reportJson = JSON.parse(cleanedText);
      } catch (e) {
        console.error("Failed to parse report JSON, serving fallback:", e);
        reportJson = {
          score: 45,
          wpm: 100,
          fillerWords: 12,
          hesitationDuration: "15 seconds",
          correctnessFeedback: "Failed to parse API output format. Please review transcript logs.",
          clarityFeedback: "Review speech pacing manually.",
          qaAudit: []
        };
      }

      // Re-read sessions from file before writing to prevent race-condition overwrite of other sessions
      let freshSessions = [];
      if (fs.existsSync(dbPath)) {
        try {
          freshSessions = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
        } catch (e) {
          console.error("Error re-reading database sessions fallback:", e);
        }
      }
      if (!Array.isArray(freshSessions)) {
        freshSessions = [];
      }

      const freshSession = freshSessions.find(s => s.id === sessionId) || session;
      freshSession.report = reportJson;

      const sidx = freshSessions.findIndex(s => s.id === sessionId);
      if (sidx >= 0) {
        freshSessions[sidx] = freshSession;
      } else {
        freshSessions.push(freshSession);
      }
      fs.writeFileSync(dbPath, JSON.stringify(freshSessions, null, 2), 'utf8');

      return {
        success: true,
        report: reportJson,
        sessionDetails: {
          id: freshSession.id,
          mode: freshSession.mode,
          title: freshSession.title,
          company: freshSession.company,
          transcript: freshSession.transcript
        }
      };
    })();

    // Store the generation promise
    activeReportPromises.set(sessionId, generateTask);

    try {
      const result = await generateTask;
      res.json(result);
    } catch (err) {
      console.error(`Report generation failed for session ${sessionId}:`, err);
      res.status(500).json({ error: err.message || "Failed to generate report." });
    } finally {
      activeReportPromises.delete(sessionId);
    }

  } catch (error) {
    console.error("Interview report generator endpoint error:", error);
    res.status(500).json({ error: error.message || "Server error during post-interview feedback compiles." });
  }
});

// Route: Get community posts
app.get('/api/community/posts', async (req, res) => {
  try {
    const dbPath = './db_community_posts_fallback.json';
    let posts = [];
    if (fs.existsSync(dbPath)) {
      try {
        posts = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
      } catch (e) {
        console.error("Error reading community posts fallback:", e);
      }
    }
    // Sort by createdAt descending (most recent first)
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, posts });
  } catch (err) {
    console.error("GET community posts error:", err);
    res.status(500).json({ error: err.message || "Server error fetching community posts." });
  }
});

// Route: Add a new community post
app.post('/api/community/posts', async (req, res) => {
  try {
    const { title, category, description, author, authorMeta, codeSnippet, gridData, anonymous } = req.body;
    if (!title || !category || !description) {
      return res.status(400).json({ error: "Title, category, and description are required." });
    }

    const dbPath = './db_community_posts_fallback.json';
    let posts = [];
    if (fs.existsSync(dbPath)) {
      try {
        posts = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
      } catch (e) {
        console.error("Error reading community posts fallback:", e);
      }
    }

    const newPost = {
      id: `post_${Date.now()}`,
      title,
      category,
      description,
      author: author || "Alex Chen (You)",
      authorMeta: authorMeta || "Just now • Candidate Partner",
      codeSnippet: codeSnippet || null,
      gridData: gridData || null,
      upvotes: 0,
      comments: 0,
      createdAt: new Date().toISOString(),
      votedEmails: [],
      commentsList: [],
      anonymous: !!anonymous
    };

    posts.push(newPost);
    fs.writeFileSync(dbPath, JSON.stringify(posts, null, 2), 'utf8');

    res.json({ success: true, post: newPost });
  } catch (err) {
    console.error("POST community post error:", err);
    res.status(500).json({ error: err.message || "Server error creating community post." });
  }
});

// Route: Upvote a community post (with single-vote toggle constraint)
app.post('/api/community/posts/:postId/upvote', async (req, res) => {
  try {
    const { postId } = req.params;
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "User email is required for upvote context." });
    }

    const dbPath = './db_community_posts_fallback.json';
    let posts = [];
    if (fs.existsSync(dbPath)) {
      try {
        posts = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
      } catch (e) {
        console.error("Error reading community posts fallback:", e);
      }
    }

    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex === -1) {
      return res.status(404).json({ error: "Post not found." });
    }

    const post = posts[postIndex];
    if (!post.votedEmails) {
      post.votedEmails = [];
    }

    const emailIndex = post.votedEmails.indexOf(email);
    if (emailIndex > -1) {
      // User has already upvoted, retract the vote
      post.votedEmails.splice(emailIndex, 1);
      post.upvotes = Math.max(0, (post.upvotes || 1) - 1);
    } else {
      // User has not upvoted, register the vote
      post.votedEmails.push(email);
      post.upvotes = (post.upvotes || 0) + 1;
    }

    fs.writeFileSync(dbPath, JSON.stringify(posts, null, 2), 'utf8');
    res.json({ success: true, post });
  } catch (err) {
    console.error("POST upvote post error:", err);
    res.status(500).json({ error: err.message || "Server error upvoting community post." });
  }
});

// Route: Add a comment to a community post
app.post('/api/community/posts/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const { author, text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Comment text is required." });
    }

    const dbPath = './db_community_posts_fallback.json';
    let posts = [];
    if (fs.existsSync(dbPath)) {
      try {
        posts = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
      } catch (e) {
        console.error("Error reading community posts fallback:", e);
      }
    }

    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex === -1) {
      return res.status(404).json({ error: "Post not found." });
    }

    const post = posts[postIndex];
    if (!post.commentsList) {
      post.commentsList = [];
    }

    const newComment = {
      id: `c_${Date.now()}`,
      author: author || "Alex Chen (You)",
      text: text.trim(),
      createdAt: new Date().toISOString()
    };

    post.commentsList.push(newComment);
    post.comments = post.commentsList.length;

    fs.writeFileSync(dbPath, JSON.stringify(posts, null, 2), 'utf8');
    res.json({ success: true, post });
  } catch (err) {
    console.error("POST comment error:", err);
    res.status(500).json({ error: err.message || "Server error posting comment." });
  }
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error("Global error handler caught an error:", err);
  try {
    fs.appendFileSync('./pdf_debug.log', `[${new Date().toISOString()}] Global Error caught: ${err.message}\nStack: ${err.stack}\n`);
  } catch (e) {}
  
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(500).json({
    error: err.message || "An unexpected server error occurred during the resume analysis pipeline."
  });
});

// WebSocket Server Initialization Function
function initializeWebSocketServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url, `http://${request.headers.host}`);
    if (pathname === '/api/interview/session') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws, req) => {
    console.log("New client connected to interview WebSocket session");
    
    let geminiWs = null;
    let sessionId = Math.random().toString(36).substring(2, 15);
    let sessionState = {
      id: sessionId,
      transcript: [],
      startTime: Date.now(),
      timer: null,
      mode: 'jd',
      title: 'Interview Session',
      company: 'Target Company',
      durationMinutes: 15
    };

    // Tell client their session ID
    ws.send(JSON.stringify({ type: 'session_created', sessionId }));

    ws.on('message', async (message) => {
      try {
        const payload = JSON.parse(message.toString());

        // Handle initial configuration
        if (payload.type === 'setup') {
          const { mode, jdText, resumeText, jobTitle, company, duration } = payload;
          sessionState.mode = mode || 'jd';
          sessionState.title = jobTitle || 'Technical Interview';
          sessionState.company = company || 'Target Company';
          sessionState.durationMinutes = duration || 15;

          console.log(`Setting up ${mode} interview for ${jobTitle} at ${company} (Duration: ${duration}m)`);

          // Start server side timer to prevent lingering sessions
          const durationMs = sessionState.durationMinutes * 60 * 1000;
          sessionState.timer = setTimeout(() => {
            console.log(`Session ${sessionId} reached duration limit. Terminating.`);
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: 'timer_expired', message: "Your interview session has reached the time limit." }));
            }
            ws.close();
          }, durationMs + 30000); // 30s grace period

          // Construct custom system instructions based on JD/Resume mode
          let systemInstructions = "";
          if (sessionState.mode === 'jd') {
            systemInstructions = `You are a strict, highly professional technical hiring manager interviewing a candidate for the position of "${jobTitle}" at "${company}".
Role description/Job Details:
--- JOB DESCRIPTION START ---
${jdText || "General Software Engineering expectations"}
--- JOB DESCRIPTION END ---

Conduct a realistic, rigorous technical interview. Ask challenging, relevant questions one by one. Listen carefully to the candidate's answers, ask follow-up questions, probe their reasoning, and check for depth. 
Be conversational, realistic, and do not repeat questions. Keep your responses short (1-3 sentences) so the conversation flows naturally.
Do not provide feedback or score them during the interview itself. Wrap up cleanly when the interview concludes.`;
          } else {
            systemInstructions = `You are a strict, highly professional technical hiring manager interviewing a candidate based on their resume.
Candidate Resume Details:
--- RESUME START ---
${resumeText || "No resume details available."}
--- RESUME END ---

Conduct a realistic, rigorous interview cross-examining their specific bullet points, projects, and technologies. Question their claims, check their actual depth of knowledge, and ask relevant behavioral or technical questions one by one.
Keep your responses short (1-3 sentences) so the conversation flows naturally.
Do not provide feedback or score them during the interview itself. Wrap up cleanly when the interview concludes.`;
          }

          // Initialize Google Gemini WebSocket connection
          const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${process.env.GEMINI_API_KEY}`;
          
          let useFallback = false;
          let setupCompleted = false;
          let connectionTimeout = setTimeout(() => {
            if (!setupCompleted) {
              console.log(`[TIMEOUT] Gemini Live connection timed out for session ${sessionId}. Activating fallback.`);
              activateFallback();
            }
          }, 3500);

          function activateFallback() {
            if (useFallback) return;
            useFallback = true;
            setupCompleted = true;
            clearTimeout(connectionTimeout);

            console.log(`[FALLBACK] Initializing Fallback Voice Interview Engine for session ${sessionId}...`);

            const hasDialogue = sessionState.transcript.length > 0;

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ 
                type: 'session_ready', 
                isFallback: true 
              }));

              if (!hasDialogue) {
                // Generate initial introductory question based on job details
                const firstQuestion = `Hello! Welcome. Thank you for joining the interview today for the "${jobTitle}" position at "${company}". Let's start by having you introduce yourself and walk me through your background and relevant experiences.`;
                
                sessionState.transcript.push({
                  sender: 'interviewer',
                  text: firstQuestion,
                  timestamp: Date.now()
                });

                // Send the initial question to trigger speechSynthesis on client
                setTimeout(() => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'fallback_speech',
                      text: firstQuestion,
                      transcript: sessionState.transcript
                    }));
                  }
                }, 1000);
              } else {
                console.log(`[FALLBACK] Switched mid-interview for session ${sessionId}. Dialogue turns: ${sessionState.transcript.length}`);
                
                // If mid-interview, notify the client that we switched, and send the current transcript
                const lastTurn = sessionState.transcript[sessionState.transcript.length - 1];
                if (lastTurn && lastTurn.sender === 'candidate') {
                  ws.send(JSON.stringify({ type: 'interviewer_thinking' }));
                  generateFallbackQuestion(sessionState).then(nextQuestion => {
                    sessionState.transcript.push({
                      sender: 'interviewer',
                      text: nextQuestion,
                      timestamp: Date.now()
                    });
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        type: 'fallback_speech',
                        text: nextQuestion,
                        transcript: sessionState.transcript
                      }));
                    }
                  }).catch(err => {
                    console.error("Mid-interview fallback question generation error:", err);
                  });
                } else if (lastTurn && lastTurn.sender === 'interviewer') {
                  ws.send(JSON.stringify({
                    type: 'fallback_speech',
                    text: lastTurn.text,
                    transcript: sessionState.transcript
                  }));
                }
              }
            }
          }

          console.log(`Connecting to Gemini Live API WebSocket for session ${sessionId}...`);
          geminiWs = new WebSocket(geminiUrl);

          geminiWs.on('open', () => {
            console.log("Connected to Google Gemini Live WebSocket API");
            
            // Send setup payload to Gemini
            const setupMessage = {
              setup: {
                model: "models/gemini-2.0-flash-exp",
                generationConfig: {
                  responseModalities: ["audio"],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: {
                        voiceName: "Aoede" // Choices: Aoede, Puck, Charon, Kore, Fenrir
                      }
                    }
                  }
                },
                systemInstruction: {
                  parts: [
                    {
                      text: systemInstructions
                    }
                  ]
                }
              }
            };
            geminiWs.send(JSON.stringify(setupMessage));
            
            // Wait 1 second to see if the connection is closed instantly by the API
            setTimeout(() => {
              if (geminiWs && geminiWs.readyState === WebSocket.OPEN && !useFallback) {
                setupCompleted = true;
                clearTimeout(connectionTimeout);
                ws.send(JSON.stringify({ type: 'session_ready', isFallback: false }));
              }
            }, 1000);
          });

          geminiWs.on('message', (geminiMsg) => {
            try {
              if (ws.readyState === ws.OPEN) {
                const rawData = geminiMsg.toString();
                ws.send(rawData);

                // Parse the message to compile the server-side transcript
                const parsed = JSON.parse(rawData);
                if (parsed.serverContent) {
                  // Model's speech output
                  if (parsed.serverContent.modelTurn && parsed.serverContent.modelTurn.parts) {
                    parsed.serverContent.modelTurn.parts.forEach(part => {
                      if (part.text) {
                        const len = sessionState.transcript.length;
                        if (len > 0 && sessionState.transcript[len - 1].sender === 'interviewer') {
                          sessionState.transcript[len - 1].text += part.text;
                        } else {
                          sessionState.transcript.push({
                            sender: 'interviewer',
                            text: part.text,
                            timestamp: Date.now()
                          });
                        }
                      }
                    });
                  }
                  // User's speech input (transcribed by Gemini)
                  if (parsed.serverContent.userTurn && parsed.serverContent.userTurn.parts) {
                    parsed.serverContent.userTurn.parts.forEach(part => {
                      if (part.text) {
                        const len = sessionState.transcript.length;
                        if (len > 0 && sessionState.transcript[len - 1].sender === 'candidate') {
                          sessionState.transcript[len - 1].text += part.text;
                        } else {
                          sessionState.transcript.push({
                            sender: 'candidate',
                            text: part.text,
                            timestamp: Date.now()
                          });
                        }
                      }
                    });
                  }
                }
              }
            } catch (err) {
              console.error("Error parsing Gemini WebSocket message:", err);
            }
          });

          geminiWs.on('error', (err) => {
            console.error("Gemini WebSocket API Error:", err);
            if (!useFallback) {
              activateFallback();
            }
          });

          geminiWs.on('close', (code, reason) => {
            console.log(`Gemini WebSocket connection closed: ${code} - ${reason}`);
            if (!useFallback) {
              activateFallback();
            }
          });
        }

        // Handle raw audio chunks or realtimeInput from Client
        else if (payload.realtimeInput && geminiWs && geminiWs.readyState === WebSocket.OPEN) {
          geminiWs.send(JSON.stringify(payload));
        }

        // Handle client manual transcription updates
        else if (payload.type === 'transcript_update') {
          sessionState.transcript = payload.transcript;
        }

        // Handle client speech text in fallback mode
        else if (payload.type === 'user_response') {
          if (sessionState.isGenerating) {
            console.log(`[FALLBACK] Question generation already in progress for session ${sessionId}. Ignoring duplicate 'user_response'.`);
            return;
          }
          sessionState.isGenerating = true;

          const userText = payload.text;
          console.log(`[FALLBACK] Received candidate response for session ${sessionId}: "${userText}"`);

          // Append user response to transcript if not already appended
          const lastTurn = sessionState.transcript[sessionState.transcript.length - 1];
          if (!lastTurn || lastTurn.sender !== 'candidate' || lastTurn.text !== userText) {
            sessionState.transcript.push({
              sender: 'candidate',
              text: userText,
              timestamp: Date.now()
            });
          }

          // Send thinking notification to client
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'interviewer_thinking' }));
          }

          try {
            const nextQuestion = await generateFallbackQuestion(sessionState);
            console.log(`[FALLBACK] Generated next question: "${nextQuestion}"`);
            
            sessionState.transcript.push({
              sender: 'interviewer',
              text: nextQuestion,
              timestamp: Date.now()
            });

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'fallback_speech',
                text: nextQuestion,
                transcript: sessionState.transcript
              }));
            }
          } catch (err) {
            console.error("Error generating fallback question:", err);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'error',
                message: "Interviewer failed to process response. Please try again."
              }));
            }
          } finally {
            sessionState.isGenerating = false;
          }
        }

      } catch (e) {
        if (Buffer.isBuffer(message) && geminiWs && geminiWs.readyState === WebSocket.OPEN) {
          const base64Audio = message.toString('base64');
          const clientAudioChunk = {
            realtimeInput: {
              mediaChunks: [
                {
                  mimeType: "audio/pcm",
                  data: base64Audio
                }
              ]
            }
          };
          geminiWs.send(JSON.stringify(clientAudioChunk));
        } else {
          console.error("WebSocket message parsing error:", e);
        }
      }
    });

    ws.on('close', () => {
      console.log(`Client connection closed for session ${sessionId}`);
      if (sessionState.timer) {
        clearTimeout(sessionState.timer);
      }
      if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.close();
      }
      saveSessionToDatabase(sessionState);
    });

    ws.on('error', (err) => {
      console.error(`Client WebSocket error for session ${sessionId}:`, err);
    });
  });

  // Fallback engine: generate interviewer questions via Groq or Gemini API
  async function generateFallbackQuestion(session) {
    let systemPrompt = "";
    if (session.mode === 'jd') {
      systemPrompt = `You are a strict, highly professional technical hiring manager interviewing a candidate for the position of "${session.title}" at "${session.company}".

Instructions:
Conduct a realistic, rigorous technical interview. Ask challenging, relevant questions one by one based on candidate answers or standard expectations for this role.
Be conversational, realistic, and do not repeat questions. Keep your responses short (1-2 sentences) so the conversation flows naturally.
Do not provide feedback or score them during the interview itself.
Ask exactly ONE question and nothing else. Do not output any markdown formatting, headers, or pleasantries other than your dialog.`;
    } else {
      systemPrompt = `You are a strict, highly professional technical hiring manager interviewing a candidate based on their resume.
Interview Details:
- Job Title Focus: ${session.title}
- Company Focus: ${session.company}

Instructions:
Conduct a realistic, rigorous interview cross-examining their specific bullet points, projects, and technologies. Question their claims, check their actual depth of knowledge, and ask relevant behavioral or technical questions one by one.
Keep your responses short (1-2 sentences) so the conversation flows naturally.
Do not provide feedback or score them during the interview itself.
Ask exactly ONE question and nothing else. Do not output any markdown formatting, headers, or pleasantries other than your dialog.`;
    }

    const historyText = session.transcript.map(turn => {
      const senderLabel = turn.sender === 'candidate' ? 'Candidate' : 'Interviewer';
      return `${senderLabel}: ${turn.text}`;
    }).join("\n");

    const userPrompt = `Here is the conversation history so far:\n${historyText}\n\nProvide your next interviewer response. Ask a follow-up or a new question. Keep it concise (1-2 sentences).`;

    try {
      // Primary: Groq Llama 3.3
      const responseText = await callGroqChat(systemPrompt, userPrompt, "llama-3.3-70b-versatile");
      return responseText.trim().replace(/^Interviewer:\s*/i, '');
    } catch (groqErr) {
      console.warn("Groq failed in fallback generator, attempting standard Gemini API:", groqErr);
      if (ai) {
        try {
          const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });
          const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
          const result = await model.generateContent(fullPrompt);
          return result.response.text().trim().replace(/^Interviewer:\s*/i, '');
        } catch (geminiErr) {
          console.error("Gemini fallback also failed:", geminiErr);
          throw new Error("Both Groq and Gemini API are unavailable for fallback generation.");
        }
      } else {
        throw new Error("Groq failed and Gemini API is not initialized.");
      }
    }
  }

  // Simple local database save helper
  function saveSessionToDatabase(session) {
    try {
      const dbPath = './db_sessions_fallback.json';
      let sessions = [];
      if (fs.existsSync(dbPath)) {
        try {
          sessions = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
        } catch (e) {
          console.error("Error reading db_sessions_fallback.json", e);
        }
      }
      if (!Array.isArray(sessions)) {
        sessions = [];
      }
      const idx = sessions.findIndex(s => s.id === session.id);
      const sessionRecord = {
        id: session.id,
        mode: session.mode,
        title: session.title,
        company: session.company,
        durationMinutes: session.durationMinutes,
        startTime: session.startTime,
        transcript: session.transcript,
        report: session.report || null,
        completedAt: Date.now()
      };
      if (idx >= 0) {
        sessions[idx] = sessionRecord;
      } else {
        sessions.push(sessionRecord);
      }
      fs.writeFileSync(dbPath, JSON.stringify(sessions, null, 2), 'utf8');
      console.log(`Session ${session.id} successfully saved to local database.`);
    } catch (e) {
      console.error("Failed to save session record:", e);
    }
  }
}

// Start Server
const server = app.listen(PORT, () => {
  console.log("Server is running on http://localhost:" + PORT);
});

// Attach WebSockets
initializeWebSocketServer(server);
