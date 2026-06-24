import express from 'express';
import fs from 'fs';
import multer from 'multer';
import { db, admin } from '../config/db.js';
import { callWithRetry, callGroqChat, ai } from '../helpers/critiqueHelpers.js';

const router = express.Router();

// Configure Multer for audio uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const activeReportPromises = new Map();

// POST: Transcribe audio recording
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided." });
    }

    const audioBuffer = req.file.buffer;
    let mimeType = req.file.mimetype || 'audio/webm';
    mimeType = mimeType.split(';')[0].trim();
    const filename = req.file.originalname || `recording.${mimeType.split('/')[1] || 'webm'}`;

    console.log(`Transcribing uploaded audio of size ${audioBuffer.length} bytes (Mime: ${mimeType})...`);

    let text = "";
    let transcriptionError = null;

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
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Check Firestore first if database connected
    if (db) {
      try {
        const doc = await db.collection('sessions').doc(sessionId).get();
        if (doc.exists) {
          return res.json({ success: true, session: doc.data() });
        }
      } catch (e) {
        console.error("Firestore read session failed, checking local file:", e);
      }
    }

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

// GET: Fetch all completed interview sessions for user
router.get('/sessions', async (req, res) => {
  try {
    const { email } = req.query;
    let sessions = [];

    // Load from Firestore if active
    if (db) {
      try {
        let query = db.collection('sessions');
        if (email) {
          query = query.where('userEmail', '==', email.toLowerCase().trim());
        }
        const snapshot = await query.get();
        snapshot.forEach(doc => {
          sessions.push(doc.data());
        });
      } catch (e) {
        console.error("Firestore sessions fetch error, checking local fallback:", e);
      }
    }

    // Always merge with fallback logs to ensure offline tests remain intact
    const dbPath = './db_sessions_fallback.json';
    if (fs.existsSync(dbPath)) {
      try {
        let localSessions = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
        if (Array.isArray(localSessions)) {
          if (email) {
            const cleanEmail = email.toLowerCase().trim();
            localSessions = localSessions.filter(s => s.userEmail && s.userEmail.toLowerCase().trim() === cleanEmail);
          }
          // Deduplicate based on ID if we retrieved some from Firestore already
          localSessions.forEach(s => {
            if (!sessions.some(fs => fs.id === s.id)) {
              sessions.push(s);
            }
          });
        }
      } catch (e) {
        console.error("Error reading database sessions fallback:", e);
      }
    }

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
router.post('/report', async (req, res) => {
  try {
    const { sessionId, customTranscript } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required." });
    }

    if (activeReportPromises.has(sessionId)) {
      console.log(`[Single-Flight] Report generation already in progress for session ${sessionId}. Coalescing...`);
      try {
        const reportResult = await activeReportPromises.get(sessionId);
        return res.json(reportResult);
      } catch (err) {
        return res.status(500).json({ error: err.message || "Failed to generate interview report." });
      }
    }

    const generateTask = (async () => {
      let session = null;

      if (db) {
        try {
          const doc = await db.collection('sessions').doc(sessionId).get();
          if (doc.exists) {
            session = doc.data();
          }
        } catch (e) {
          console.error("Firestore report generator read session failed:", e);
        }
      }

      if (!session) {
        const dbPath = './db_sessions_fallback.json';
        let sessions = [];
        if (fs.existsSync(dbPath)) {
          try {
            sessions = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
          } catch (e) {
            console.error("Error reading database sessions fallback:", e);
          }
        }
        session = sessions.find(s => s.id === sessionId);
      }
      
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

      if (session.report) {
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

      const systemPrompt = `You are an elite, highly critical senior technical interviewer and principal engineer auditing a completed interview transcript.
Analyze the conversation transcript between the candidate and the interviewer.
Calculate metrics and evaluate performance strictly:
1. You must grade VERY CRITICALLY and STRICTLY. Do not hand out high scores easily. Average answers should get around 40-60. Excellent answers should get 75-85. Outstanding answers 85+.
2. If the candidate gives unnecessary, irrelevant, vague, off-topic, or filler-filled answers, penalize them heavily.
3. CRITICAL PENALTY FOR MEDIOCRE ANSWERS: If a candidate response is irrelevant, empty, off-topic, waffling, or repeating the question without real technical depth, you MUST grade that turn extremely low (score of 0-30 for that turn) and pull down the overall score significantly.
4. Evaluate correctness against real software engineering principles. If they waffle or ramble without concrete facts, grade it as poor.

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
      "idealAnswer": "Provide the exact ideal technical answer they should have formulated, including industry-standard terms."
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
          true
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
          console.error("Gemini fallback also failed for interview audit, building baseline report:", geminiErr.message);
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

      // Save report in Database (Firestore or Local fallback file)
      session.report = reportJson;

      if (db) {
        try {
          await db.collection('sessions').doc(sessionId).set(session, { merge: true });
          console.log(`Saved feedback report for session ${sessionId} to Firestore.`);
        } catch (e) {
          console.error("Firestore report save error:", e);
        }
      }

      // Re-read local sessions to prevent race-condition overwrite of other concurrent sessions
      const dbPath = './db_sessions_fallback.json';
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

      const sidx = freshSessions.findIndex(s => s.id === sessionId);
      if (sidx >= 0) {
        freshSessions[sidx] = { ...freshSessions[sidx], report: reportJson };
      } else {
        freshSessions.push(session);
      }
      fs.writeFileSync(dbPath, JSON.stringify(freshSessions, null, 2), 'utf8');

      return {
        success: true,
        report: reportJson,
        sessionDetails: {
          id: session.id,
          mode: session.mode,
          title: session.title,
          company: session.company,
          transcript: session.transcript
        }
      };
    })();

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

export default router;
