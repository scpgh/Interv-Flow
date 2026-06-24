import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini SDK
let ai = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log("Gemini API initialized successfully in critiqueHelpers.");
  } catch (err) {
    console.error("Failed to initialize Gemini API SDK in critiqueHelpers:", err);
  }
} else {
  console.warn("WARNING: GEMINI_API_KEY is missing in server/.env! AI analysis requests will fail with instruction details.");
}

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

// Helper for calling Groq completions API with multi-key fallback
async function callGroqChat(systemPrompt, userPrompt, modelName = "llama-3.3-70b-versatile", jsonMode = false) {
  const apiKeys = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5,
  ].filter(k => k && k.trim() !== "");

  if (apiKeys.length === 0) {
    throw new Error("No Groq API keys are configured. Please add GROQ_API_KEY to server/.env");
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

  let lastError = null;
  for (let keyIdx = 0; keyIdx < apiKeys.length; keyIdx++) {
    const apiKey = apiKeys[keyIdx];
    const keyLabel = keyIdx === 0 ? "GROQ_API_KEY" : `GROQ_API_KEY_${keyIdx + 1}`;
    console.log(`Calling Groq API with ${keyLabel} (model: ${modelName}, jsonMode: ${jsonMode})...`);

    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey.trim()}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          const isRateLimit = response.status === 429 ||
            errorText.includes("Rate limit") ||
            errorText.includes("quota") ||
            errorText.includes("exhausted");

          if (isRateLimit) {
            console.warn(`${keyLabel} hit rate limit (attempt ${attempt + 1}/2). ${keyIdx + 1 < apiKeys.length ? 'Rotating to next key...' : 'No more keys.'}`);
            lastError = new Error(`Groq rate limit on ${keyLabel}: ${errorText}`);
            break;
          }
          throw new Error(`Groq API error with ${keyLabel} (status ${response.status}): ${errorText}`);
        }

        const data = await response.json();
        if (!data.choices || data.choices.length === 0) {
          throw new Error(`Groq API returned an empty completion response with ${keyLabel}.`);
        }

        if (keyIdx > 0) {
          console.log(`Succeeded using fallback ${keyLabel}.`);
        }
        return data.choices[0].message.content;

      } catch (err) {
        clearTimeout(timeoutId);
        const isTimeout = err.name === 'AbortError' || (err.message && err.message.includes('aborted'));
        const isRateLimit = isTimeout || (err.message && (
          err.message.includes("429") ||
          err.message.includes("Rate limit") ||
          err.message.includes("quota") ||
          err.message.includes("exhausted")
        ));
        if (isRateLimit) {
          lastError = isTimeout ? new Error(`Groq API request timed out on ${keyLabel}`) : err;
          break;
        }
        if (attempt === 0) {
          console.warn(`${keyLabel} transient error, retrying... (${err.message})`);
          await new Promise(r => setTimeout(r, 500));
        } else {
          throw err;
        }
      }
    }
  }

  throw lastError || new Error("All Groq API keys are exhausted or rate-limited. Please add more keys or wait.");
}

// Local fallback resume analysis when Gemini API is unavailable or rate limited
function fallbackResumeAnalysis(resumeText, domain) {
  const normalizedDomain = (domain || 'swe').toLowerCase().trim();
  
  let candidateName = "Chaitanya";
  const lines = resumeText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    if (/^[A-Za-z\s]+$/.test(line) && line.split(/\s+/).length >= 2 && line.split(/\s+/).length <= 4 && line.length < 30) {
      candidateName = line;
      break;
    }
  }

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
    solutions: ["Enterprise Architecture", "Cloud Solutions", "System Design", "AWS", "Integration", "APIs", "SQL", "Microservices", "Scalability"],
    consulting: ["Management Consulting", "Strategy", "Data Analysis", "Financial Modeling", "Excel", "PowerPoint", "KPIs"],
    finance: ["Financial Analysis", "Valuation", "DCF", "LBO", "Accounting", "Excel", "Bloomberg", "SQL", "Equity Research"],
    bizdev: ["Business Development", "Sales Pipeline", "CRM", "Salesforce", "Lead Generation", "Negotiation", "Partnerships", "KPIs"],
    financial: ["Financial Statements", "Excel", "Budgeting", "Forecasting", "Auditing", "SQL", "Variance Analysis", "Reporting"],
    strategy: ["Operations", "Strategy", "Business Analyst", "KPIs", "Process Improvement", "SQL", "Tableau", "Agile", "Roadmap"],
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
  let baseATS = Math.round(20 + keywordRatio * 42);
  let baseMatch = Math.round(20 + keywordRatio * 50);
  
  if (experienceYears === "0 Yrs") {
    baseATS = Math.max(20, baseATS - 12);
    baseMatch = Math.max(20, baseMatch - 18);
  } else if (experienceYears.includes("0.5") || experienceYears.startsWith("1 ")) {
    baseATS = Math.max(25, baseATS - 8);
    baseMatch = Math.max(25, baseMatch - 12);
  } else if (experienceYears.startsWith("2 ") || experienceYears.startsWith("2.")) {
    baseATS = Math.max(30, baseATS - 4);
    baseMatch = Math.max(30, baseMatch - 6);
  }
  
  const atsScore = Math.min(72, Math.max(20, baseATS));
  const roleMatch = Math.min(78, Math.max(20, baseMatch));

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
      atsKeywords: ["Algorithms & Data Structures", "Unit & Integration Testing", "Git Version Control", "SQL Database Optimization", "Clean Code Design Patterns"]
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
        { id: "f1", type: "error", title: "Math Symbols Rendering Issues", text: "Complex LaTeX symbols in body text often fail ATS translation, appearing as garbled text strings." },
        { id: "f2", type: "warning", title: "Missing Hugging Face or Kaggle Link", text: "No Hugging Face, Kaggle, or GitHub link found. Essential for showcasing open-source machine learning portfolios." }
      ],
      gapAdvice: 'Your machine learning resume is missing model deployment details (MLOps) and model evaluation metrics. Add FastAPI/Docker serving details.',
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
        { id: "i2", type: "warning", title: "No Delivery Metric", text: "Fails to quantify product delivery successes. Add metric details like: 'delivered product roadmap 3 weeks ahead of schedule, saving $35k in overhead'." }
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
        "What key metrics would you track for a new AI-powered search tool, and how would you set OKRs?",
        "Explain how you would design and analyze an A/B test for a core checkout page modification to ensure statistical significance.",
        "How do you approach managing technical debt with your engineering lead while still delivering business value?",
        "How do you use telemetry and SQL queries to perform funnel analysis and locate drop-offs in an onboarding flow?",
        "What is the difference between leading and lagging indicators, and how do you select KPIs for a marketplace model?",
        "Explain how you would run a cohort retention analysis to see if a newly launched feature is driving repeat usage.",
        "How would you estimate the market size (TAM, SAM, SOM) for a new developer tool targeted at mobile developers?",
        "Describe how you calculate Customer Acquisition Cost (CAC) and Customer Lifetime Value (LTV), and what ratio is considered healthy.",
        "How do you conduct competitive analysis, and what frameworks do you find most useful?",
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

export {
  ai,
  callWithRetry,
  callGroqChat,
  fallbackResumeAnalysis,
  fallbackQueryResponse,
  domainExpectations
};
