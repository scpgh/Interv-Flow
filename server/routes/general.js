import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import fs from 'fs';
import { db } from '../config/db.js';
import { saveAnalysis, saveChatUsage, findUserByEmail, saveUser } from '../helpers/dbHelpers.js';
import { callWithRetry, callGroqChat, fallbackResumeAnalysis, fallbackQueryResponse, domainExpectations, ai } from '../helpers/critiqueHelpers.js';

const router = express.Router();

// Configure Multer for in-memory file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // limit file size to 5MB
});

// POST: Parse and Analyze Resume
router.post('/analyze-resume', upload.single('resume'), async (req, res) => {
  try {
    const { domain, resumeText: rawResumeText, email } = req.body;
    const file = req.file;

    if (!file && !rawResumeText) {
      return res.status(400).json({ error: "No resume file uploaded or text provided. Please upload a PDF/DOCX or paste your resume text." });
    }
    if (!domain) {
      return res.status(400).json({ error: "Job role domain target is required." });
    }

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

Evaluate the resume and calculate a STRICTLY REALISTIC, critical ATS score between 20 and 92. Calibration rules:
- Student/fresher resumes (0-1 year experience, projects only): 20–45.
- Junior professional (1-2 years, lacks quantified metrics): 35–55.
- Average candidate (2-4 years, some quantification, minor formatting issues): 45–65.
- Good candidate (4+ years, several quantified bullets, clean formatting): 60–75.
- Excellent/FAANG-ready (well-quantified, XYZ formula, no typos, clean single-column): 76–92.
- NEVER score above 92 under any circumstance.
- DEDUCT 5 points for every typo in a key technology name (e.g. "Kubernetes" spelled wrong).
- DEDUCT 5-10 points for each unquantified accomplishment bullet ("improved performance" without %).
- DEDUCT 10 points if multi-column or table-based layout is detected.
- DEDUCT 5 points if no GitHub/LinkedIn/portfolio link is present.
- DEDUCT 10–20 points if the candidate's domain background heavily mismatches the target role.
- Do NOT inflate scores — when in doubt, score lower rather than higher.

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

    const hasAnyGroqKey = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2, process.env.GROQ_API_KEY_3, process.env.GROQ_API_KEY_4, process.env.GROQ_API_KEY_5].some(k => k && k.trim());
    if (!hasAnyGroqKey) {
      return res.status(503).json({ error: "No Groq API keys configured on the server. Please add GROQ_API_KEY (and optionally GROQ_API_KEY_2, GROQ_API_KEY_3) to server/.env and restart." });
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
      userEmail: email || null,
      domain,
      fileName: file ? file.originalname : "Plain_Text_Paste",
      fileSize: file ? file.size : Buffer.byteLength(resumeText, 'utf8'),
      analysis: analysisResult,
      isFallback: false,
      provider: "groq"
    });

    if (email) {
      try {
        const user = await findUserByEmail(email);
        if (user) {
          user.atsScore = analysisResult.atsScore || 0;
          user.highestEducation = analysisResult.highestEducation || user.highestEducation || 'N/A';
          user.experienceYears = analysisResult.experienceYears || user.experienceYears || '0 Yrs';
          await saveUser(user);
          console.log(`[Resume Sync] Updated user profile for ${email} with ATS Score: ${user.atsScore}`);
        }
      } catch (userErr) {
        console.error("Failed to sync analyzed resume score to user profile:", userErr);
      }
    }

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

// POST: Query Analyzed Resume (Q&A Chat)
router.post('/query-resume', async (req, res) => {
  try {
    const { resumeText, question, userProfile } = req.body;
    if (!resumeText || !question) {
      return res.status(400).json({ error: "Both resumeText and question are required." });
    }

    let answer = "";
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

// POST: General Doubt Chatbot
router.post('/chat', async (req, res) => {
  try {
    const { message, history, domain, resumeText, userProfile, email } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    if (email) {
      saveChatUsage(email).catch(e => console.error("Error logging chat usage:", e));
    }

    let answer = "";
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

    const systemPrompt = `You are Intervflow AI Doubt Tutor, an elite 24/7 technical interviewer and career coach.
You help candidates prepare for SDE, PM, Finance, and Consulting interviews.
Answer the user's question constructively, encouragingly, and concisely (under 3-4 paragraphs or bullet points).

Here is the candidate's personal profile context:
--- PROFILE START ---
${userContextPrompt}
--- PROFILE END ---

${resumeText ? `Here is the candidate's resume context to personalize your advice:\n--- RESUME START ---\n${resumeText}\n--- RESUME END ---\n` : ""}

${historyPrompt}
User's Question: "${message}"`;

    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.trim() === "") {
      return res.status(503).json({ error: "GROQ_API_KEY is not configured on the server." });
    }

    try {
      console.log("Calling Groq API for chatbot...");
      answer = await callWithRetry(() => callGroqChat(
        "You are Intervflow AI Doubt Tutor, an elite career coach. Answer concisely and constructively.",
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

// GET: Public system status endpoint (no auth required)
router.get('/status', async (req, res) => {
  try {
    const { getGlobalSettings } = await import('../helpers/dbHelpers.js');
    const settings = await getGlobalSettings();
    res.json({ maintenance: settings.maintenanceMode === true });
  } catch (err) {
    console.error("Status endpoint error:", err);
    res.json({ maintenance: false });
  }
});

export default router;
