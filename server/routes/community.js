import express from 'express';
import fs from 'fs';
import { db } from '../config/db.js';
import { getGlobalSettings } from '../helpers/dbHelpers.js';

const router = express.Router();

// GET: Fetch community leaderboard lists (filtered and scaled by XP multiplier)
router.get('/leaderboard', async (req, res) => {
  try {
    // 1. Fetch settings to apply XP multiplier
    const settings = await getGlobalSettings();
    const xpMultiplier = settings.globalXpMultiplier || 1.0;

    // 2. Fetch users
    let users = [];
    if (db) {
      try {
        const usersSnapshot = await db.collection('users').get();
        usersSnapshot.forEach(doc => {
          users.push({ email: doc.id, ...doc.data() });
        });
      } catch (e) {
        console.error("Firestore user read error for leaderboard:", e);
      }
    }
    const fallbackPath = './db_users_fallback.json';
    if (fs.existsSync(fallbackPath)) {
      try {
        const localUsers = JSON.parse(fs.readFileSync(fallbackPath, 'utf8') || '[]');
        if (Array.isArray(localUsers)) {
          // Merge and avoid duplicates
          localUsers.forEach(lu => {
            if (!users.some(u => u.email.toLowerCase().trim() === lu.email.toLowerCase().trim())) {
              users.push(lu);
            }
          });
        }
      } catch (err) {
        console.error("Local user read fallback failed for leaderboard:", err);
      }
    }

    // 3. Fetch completed sessions
    let sessions = [];
    const sessionsPath = './db_sessions_fallback.json';
    if (fs.existsSync(sessionsPath)) {
      try {
        sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8') || '[]');
      } catch (e) {
        console.error("Error reading sessions fallback for leaderboard:", e);
      }
    }
    if (db) {
      try {
        const fsSessions = await db.collection('sessions').get();
        fsSessions.forEach(doc => {
          const s = doc.data();
          if (!sessions.some(ls => ls.id === s.id)) {
            sessions.push(s);
          }
        });
      } catch (e) {}
    }

    // 4. Fetch community posts
    let posts = [];
    const postsPath = './db_community_posts_fallback.json';
    if (fs.existsSync(postsPath)) {
      try {
        posts = JSON.parse(fs.readFileSync(postsPath, 'utf8') || '[]');
      } catch (e) {
        console.error("Error reading posts fallback for leaderboard:", e);
      }
    }

    // 5. Fetch resume analyses
    let analyses = [];
    if (db) {
      try {
        const analysesSnapshot = await db.collection('resume_analyses').get();
        analysesSnapshot.forEach(doc => {
          analyses.push(doc.data());
        });
      } catch (e) {
        console.error("Firestore resume analyses read error for leaderboard:", e);
      }
    }
    const analysesPath = './db_fallback.json';
    if (fs.existsSync(analysesPath)) {
      try {
        const localAnalyses = JSON.parse(fs.readFileSync(analysesPath, 'utf8') || '[]');
        if (Array.isArray(localAnalyses)) {
          analyses = analyses.concat(localAnalyses);
        }
      } catch (e) {
        console.error("Error reading analyses fallback for leaderboard:", e);
      }
    }

    // 6. Calculate statistics & XP for active real users
    // Filter: Exclude users who are marked as soft-deleted (isActive === false)
    const activeUsers = users.filter(u => u.email && u.name && u.isActive !== false);

    const leaderboard = activeUsers.map(user => {
      const email = user.email.toLowerCase().trim();

      const userSessions = sessions.filter(s => s.userEmail && s.userEmail.toLowerCase().trim() === email);
      const completedSessions = userSessions.filter(s => s.report && s.completedAt);
      const completedSessionsCount = completedSessions.length;
      let highestScore = 0;
      completedSessions.forEach(s => {
        if (s.report && typeof s.report.score === 'number' && s.report.score > highestScore) {
          highestScore = s.report.score;
        }
      });

      const userName = user.name || "";
      const userPosts = posts.filter(p => {
        if (p.userEmail && p.userEmail.toLowerCase().trim() === email) {
          return true;
        }
        if (p.author && (p.author === `${userName} (You)` || p.author.toLowerCase() === userName.toLowerCase())) {
          return true;
        }
        return false;
      });
      const postsCount = userPosts.length;

      const userAnalyses = analyses.filter(a => a.userEmail && a.userEmail.toLowerCase().trim() === email);
      let highestResumeScore = 0;
      userAnalyses.forEach(a => {
        const score = a.atsScore || 0;
        if (score > highestResumeScore) {
          highestResumeScore = score;
        }
      });

      const uniqueDates = new Set();
      userSessions.forEach(s => {
        const dateVal = s.completedAt || s.startTime;
        if (dateVal) {
          const d = new Date(dateVal);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          uniqueDates.add(dateStr);
        }
      });
      userAnalyses.forEach(a => {
        const dateVal = a.createdAt;
        if (dateVal) {
          const d = new Date(dateVal);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          uniqueDates.add(dateStr);
        }
      });

      const getDateOffsetStr = (offset) => {
        const d = new Date();
        d.setDate(d.getDate() - offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      const todayStr = getDateOffsetStr(0);
      const yesterdayStr = getDateOffsetStr(1);

      let streak = 0;
      let referenceDateStr = "";

      if (uniqueDates.has(todayStr)) {
        streak = 1;
        referenceDateStr = todayStr;
      } else if (uniqueDates.has(yesterdayStr)) {
        streak = 1;
        referenceDateStr = yesterdayStr;
      }

      if (streak > 0) {
        let offset = 1;
        if (referenceDateStr === yesterdayStr) {
          offset = 2;
        }
        while (true) {
          const prevDateStr = getDateOffsetStr(offset);
          if (uniqueDates.has(prevDateStr)) {
            streak++;
            offset++;
          } else {
            break;
          }
        }
      }

      const hasMarathon = completedSessionsCount >= 2;
      const hasHighScorer = highestScore >= 75;
      const hasResumeCalibrator = highestResumeScore >= 80;
      const has15DayChallenge = completedSessionsCount >= 15;

      const challengeBonuses = (hasMarathon ? 200 : 0) + (hasHighScorer ? 300 : 0) + (hasResumeCalibrator ? 150 : 0) + (has15DayChallenge ? 500 : 0);
      
      // Apply the global XP multiplier — bonusXp is admin-assigned and NOT multiplied
      const bonusXp = user.bonusXp || 0;
      const baseXP = (completedSessionsCount * 100) + (postsCount * 5) + challengeBonuses;
      const xp = Math.round(baseXP * xpMultiplier) + bonusXp;

      let techStack = ["Algorithms", "Data Structures", "System Design", "Git"];
      if (user.domain === 'backend') {
        techStack = ["Go", "Node.js", "MongoDB", "Docker", "Redis"];
      } else if (user.domain === 'frontend') {
        techStack = ["React", "JavaScript", "Tailwind CSS", "CSS", "Vite"];
      } else if (user.domain === 'pm') {
        techStack = ["Product Roadmap", "User Personas", "Agile", "KPI metrics"];
      } else if (user.domain === 'fullstack') {
        techStack = ["React", "Node.js", "Express", "TypeScript", "PostgreSQL", "Docker"];
      }

      const badges = [];
      if (streak > 0) {
        badges.push({ emoji: "🔥", name: "Streak Active", desc: `Maintained practice streak for ${streak} days.` });
      }
      if (highestScore >= 80) {
        badges.push({ emoji: "💻", name: "Systems Design", desc: "Demonstrated baseline database architecture capability." });
      }
      if (highestResumeScore >= 75) {
        badges.push({ emoji: "📝", name: "ATS 75+", desc: "Resume analyzer score exceeds 75%." });
      }
      if (completedSessionsCount >= 3) {
        badges.push({ emoji: "🏆", name: "Marathoner", desc: "Completed 3 or more mock interviews." });
      }
      if (badges.length === 0) {
        badges.push({ emoji: "🌟", name: "Active Member", desc: "Welcome to the IntervFlow community." });
      }

      const domainLabel = user.domain === 'backend'
        ? 'Backend Eng'
        : user.domain === 'frontend'
          ? 'Frontend Eng'
          : user.domain === 'pm'
            ? 'Product Manager'
            : 'Candidate Partner';

      let summaries = userPosts.map(p => ({
        company: p.title.split(' - ')[0] || "Target Company",
        role: p.title.split(' - ')[1] || domainLabel,
        text: p.description
      }));

      if (summaries.length === 0) {
        summaries = [{
          company: user.dreamCompany || "IntervFlow",
          role: "Active Candidate",
          text: "Practicing behavioral STAR responses and resume keyword indexing logs."
        }];
      }

      const initials = userName.split(/\s+/).map(n => n[0]).join("").slice(0, 2).toUpperCase() || "IF";

      return {
        name: userName,
        email: email,
        streak: `${streak} Day${streak !== 1 ? 's' : ''}`,
        streakCount: streak,
        xp: `${xp} XP`,
        xpNumber: xp,
        title: `${domainLabel} at ${user.dreamCompany || 'IntervFlow'}`,
        initials,
        techStack,
        badges,
        summaries,
        mentorKey: null
      };
    });

    leaderboard.sort((a, b) => b.xpNumber - a.xpNumber);
    res.json({ success: true, leaderboard });
  } catch (err) {
    console.error("GET community leaderboard error:", err);
    res.status(500).json({ error: err.message || "Server error fetching leaderboard." });
  }
});

// GET: Fetch community posts
router.get('/posts', async (req, res) => {
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
    if (!Array.isArray(posts)) {
      posts = [];
    }
    // Sort posts descending by creation date
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, posts });
  } catch (err) {
    console.error("GET community posts error:", err);
    res.status(500).json({ error: err.message || "Server error fetching community posts." });
  }
});

// POST: Add a new community post
router.post('/posts', async (req, res) => {
  try {
    const { title, category, description, author, authorMeta, codeSnippet, gridData, anonymous, email } = req.body;
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
      anonymous: !!anonymous,
      userEmail: email || null
    };

    posts.push(newPost);
    fs.writeFileSync(dbPath, JSON.stringify(posts, null, 2), 'utf8');

    res.json({ success: true, post: newPost });
  } catch (err) {
    console.error("POST community post error:", err);
    res.status(500).json({ error: err.message || "Server error creating community post." });
  }
});

// POST: Upvote a community post
router.post('/posts/:postId/upvote', async (req, res) => {
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
      post.votedEmails.splice(emailIndex, 1);
      post.upvotes = Math.max(0, (post.upvotes || 1) - 1);
    } else {
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

// POST: Add comment to a community post
router.post('/posts/:postId/comments', async (req, res) => {
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

export default router;
