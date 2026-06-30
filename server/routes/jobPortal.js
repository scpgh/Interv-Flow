import express from 'express';
import fs from 'fs';
import { db } from '../config/db.js';
import { verifyUser } from '../middleware/auth.js';
import {
  saveJobDescription,
  getJobDescriptions,
  getSessionsByJdId,
  findUserByEmail
} from '../helpers/dbHelpers.js';

const router = express.Router();

// helper to sanitize inputs
const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  return str.trim();
};

// GET: List all Job Descriptions
router.get('/jobs', async (req, res) => {
  try {
    const jds = await getJobDescriptions();
    res.json({ success: true, jds });
  } catch (err) {
    console.error("GET /jobs failed:", err);
    res.status(500).json({ error: "Server error fetching jobs list." });
  }
});

// POST: Create a Job Description (Recruiter or Admin only)
router.post('/jobs', verifyUser, async (req, res) => {
  try {
    if (req.userRole !== 'RECRUITER' && req.userRole !== 'ADMIN') {
      return res.status(403).json({ error: "Forbidden. Only recruiters and administrators can post jobs." });
    }

    const { title, company, jdText, customSystemPrompt, customQuestions, duration } = req.body;
    if (!title || !company || !jdText) {
      return res.status(400).json({ error: "Job title, company, and JD description are required." });
    }

    const jdData = {
      recruiterEmail: req.userEmail.toLowerCase().trim(),
      title: sanitizeString(title),
      company: sanitizeString(company),
      jdText: sanitizeString(jdText),
      customSystemPrompt: sanitizeString(customSystemPrompt || ''),
      customQuestions: Array.isArray(customQuestions) ? customQuestions : [],
      duration: typeof duration === 'number' ? duration : 15
    };

    const id = await saveJobDescription(jdData);
    if (!id) {
      return res.status(500).json({ error: "Failed to save job description." });
    }

    res.status(201).json({ success: true, jdId: id, message: "Job description posted successfully." });
  } catch (err) {
    console.error("POST /jobs failed:", err);
    res.status(500).json({ error: "Server error saving job posting." });
  }
});

// GET: Retrieve applicants and mock scores for a specific job (Recruiter or Admin only)
router.get('/jobs/:jdId/applicants', verifyUser, async (req, res) => {
  try {
    if (req.userRole !== 'RECRUITER' && req.userRole !== 'ADMIN') {
      return res.status(403).json({ error: "Forbidden. Only recruiters and administrators can access applicant data." });
    }

    const { jdId } = req.params;
    const sessions = await getSessionsByJdId(jdId);

    const applicants = [];
    for (const session of sessions) {
      if (!session.userEmail) continue;
      const user = await findUserByEmail(session.userEmail);
      
      applicants.push({
        sessionId: session.id,
        candidateName: user ? user.name : session.userEmail.split('@')[0],
        candidateEmail: session.userEmail,
        resumeAtsScore: user ? user.atsScore || null : null,
        mockScore: session.report ? session.report.score : null,
        completedAt: session.completedAt || session.startTime,
        transcriptLength: session.transcript ? session.transcript.length : 0
      });
    }

    res.json({ success: true, applicants });
  } catch (err) {
    console.error("GET /jobs/:jdId/applicants failed:", err);
    res.status(500).json({ error: "Server error fetching applicant data." });
  }
});

// GET: Candidates Leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    let sessions = [];
    if (db) {
      try {
        const snapshot = await db.collection('sessions').get();
        snapshot.forEach(doc => sessions.push(doc.data()));
      } catch (e) {
        console.error("Firestore leaderboard sessions read failed:", e);
      }
    }
    const dbPath = './db_sessions_fallback.json';
    if (fs.existsSync(dbPath)) {
      try {
        const local = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
        local.forEach(s => {
          if (!sessions.some(fs => fs.id === s.id)) {
            sessions.push(s);
          }
        });
      } catch (e) {}
    }

    let gradedSessions = sessions.filter(s => s.report && typeof s.report.score === 'number' && s.userEmail);

    const { jdId } = req.query;
    if (jdId) {
      gradedSessions = gradedSessions.filter(s => s.jdId === jdId);
    }

    const userBestScores = {};
    for (const session of gradedSessions) {
      const email = session.userEmail.toLowerCase().trim();
      const score = session.report.score;
      if (!userBestScores[email] || userBestScores[email].score < score) {
        userBestScores[email] = {
          email,
          score,
          title: session.title || 'Technical Interview',
          company: session.company || 'Mock Corp',
          completedAt: session.completedAt || session.startTime
        };
      }
    }

    const leaderboard = [];
    for (const email of Object.keys(userBestScores)) {
      const scoreObj = userBestScores[email];
      const user = await findUserByEmail(email);
      leaderboard.push({
        name: user ? user.name : email.split('@')[0],
        email: email,
        domain: user ? user.domain : 'swe',
        score: scoreObj.score,
        title: scoreObj.title,
        company: scoreObj.company,
        completedAt: scoreObj.completedAt
      });
    }

    leaderboard.sort((a, b) => b.score - a.score);

    res.json({ success: true, leaderboard: leaderboard.slice(0, 50) }); // return top 50
  } catch (err) {
    console.error("GET /leaderboard failed:", err);
    res.status(500).json({ error: "Server error compiling leaderboard." });
  }
});

// GET: Fetch candidate details (profile, domain, resume info) for recruiters
router.get('/candidate/:email', verifyUser, async (req, res) => {
  try {
    if (req.userRole !== 'RECRUITER' && req.userRole !== 'ADMIN') {
      return res.status(403).json({ error: "Forbidden. Only recruiters and administrators can inspect candidate profiles." });
    }

    const { email } = req.params;
    const targetEmail = email.toLowerCase().trim();
    const user = await findUserByEmail(targetEmail);
    if (!user) {
      return res.status(404).json({ error: "Candidate profile not found." });
    }

    res.json({
      success: true,
      candidate: {
        name: user.name,
        email: user.email,
        domain: user.domain,
        experienceYears: user.experienceYears || '0 Yrs',
        highestEducation: user.highestEducation || 'N/A',
        dreamCompany: user.dreamCompany || 'N/A',
        linkedinUrl: user.linkedinUrl || '',
        githubUrl: user.githubUrl || '',
        onboardingCompleted: user.onboardingCompleted || false
      }
    });
  } catch (err) {
    console.error("GET recruiter candidate info failed:", err);
    res.status(500).json({ error: "Server error fetching candidate info." });
  }
});

export default router;
