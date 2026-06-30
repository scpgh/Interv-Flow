import express from 'express';
import fs from 'fs';
import { db, admin } from '../config/db.js';
import { verifyAdmin, verifyModerator } from '../middleware/auth.js';
import {
  findUserByEmail,
  saveUser,
  getGlobalSettings,
  saveGlobalSettings,
  logAdminAction,
  getUpgradeRequests,
  updateUpgradeRequestStatus
} from '../helpers/dbHelpers.js';

const router = express.Router();

// Protect administrative and moderation routes
router.use((req, res, next) => {
  // Allow moderators to moderate forum posts
  if (req.path.startsWith('/posts')) {
    return verifyModerator(req, res, next);
  }
  // All other administrative tasks require ADMIN role
  return verifyAdmin(req, res, next);
});

// Helper to escape HTML tags to prevent cross-site scripting (XSS)
const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// GET: Admin Overview Stats
router.get('/stats', async (req, res) => {
  try {
    // 1. Fetch Users counts & stats
    let users = [];
    if (db) {
      try {
        const snapshot = await db.collection('users').get();
        snapshot.forEach(doc => {
          users.push({ email: doc.id, ...doc.data() });
        });
      } catch (e) {
        console.error("Firestore stats read error for users:", e);
      }
    }
    const fallbackUsersPath = './db_users_fallback.json';
    if (fs.existsSync(fallbackUsersPath)) {
      try {
        const localUsers = JSON.parse(fs.readFileSync(fallbackUsersPath, 'utf8') || '[]');
        if (Array.isArray(localUsers)) {
          localUsers.forEach(lu => {
            if (!users.some(u => u.email.toLowerCase().trim() === lu.email.toLowerCase().trim())) {
              users.push(lu);
            }
          });
        }
      } catch (err) {
        console.error("Local stats read fallback failed for users:", err);
      }
    }

    const totalUsers = users.length;
    const activeUsersCount = users.filter(u => u.isActive !== false).length;
    const archivedUsersCount = totalUsers - activeUsersCount;

    // Calculate average ATS Score
    const usersWithAts = users.filter(u => u.atsScore !== undefined && typeof u.atsScore === 'number');
    let avgAtsScore = 0;
    if (usersWithAts.length > 0) {
      const sum = usersWithAts.reduce((acc, u) => acc + u.atsScore, 0);
      avgAtsScore = Math.round(sum / usersWithAts.length);
    } else {
      // General default if no user has run evaluations
      avgAtsScore = 65;
    }

    // 2. Fetch Sessions count
    let sessions = [];
    const sessionsPath = './db_sessions_fallback.json';
    if (fs.existsSync(sessionsPath)) {
      try {
        sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8') || '[]');
      } catch (e) {
        console.error("Error reading sessions fallback for stats:", e);
      }
    }
    if (db) {
      try {
        const snapshot = await db.collection('sessions').get();
        snapshot.forEach(doc => {
          const s = doc.data();
          if (!sessions.some(ls => ls.id === s.id)) {
            sessions.push(s);
          }
        });
      } catch (e) {}
    }
    const totalSessions = sessions.length;

    // 3. Fetch Posts count
    let posts = [];
    const postsPath = './db_community_posts_fallback.json';
    if (fs.existsSync(postsPath)) {
      try {
        posts = JSON.parse(fs.readFileSync(postsPath, 'utf8') || '[]');
      } catch (e) {
        console.error("Error reading posts fallback for stats:", e);
      }
    }
    const totalPosts = posts.length;

    // 4. Fetch Audit Logs
    let auditLogs = [];
    const logsPath = './db_admin_audit_logs_fallback.json';
    if (fs.existsSync(logsPath)) {
      try {
        auditLogs = JSON.parse(fs.readFileSync(logsPath, 'utf8') || '[]');
      } catch (e) {}
    }
    if (db) {
      try {
        const snapshot = await db.collection('admin_audit_logs').get();
        snapshot.forEach(doc => {
          auditLogs.push(doc.data());
        });
      } catch (e) {}
    }

    // Compile Recent activity feed list
    const sortedUsers = [...users].sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0)).slice(0, 30);
    const sortedSessions = [...sessions].sort((a, b) => (b.completedAt || b.startTime || 0) - (a.completedAt || a.startTime || 0)).slice(0, 30);
    const sortedPosts = [...posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 30);
    const sortedAudits = [...auditLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 30);

    const activityFeed = [];
    sortedUsers.forEach(u => {
      activityFeed.push({
        type: 'user_signup',
        message: `New candidate ${u.name} (${u.email}) onboarded to ${u.domain || 'general'}.`,
        timestamp: u.createdAt || new Date().toISOString()
      });
    });
    sortedSessions.forEach(s => {
      activityFeed.push({
        type: 'interview_complete',
        message: `Candidate completed a mock interview for ${s.title} at ${s.company} (Score: ${s.report?.score || 'N/A'}).`,
        timestamp: s.completedAt ? new Date(s.completedAt).toISOString() : new Date(s.startTime).toISOString()
      });
    });
    sortedPosts.forEach(p => {
      activityFeed.push({
        type: 'post_create',
        message: `User ${p.author} published a new topic: "${p.title}".`,
        timestamp: p.createdAt
      });
    });
    sortedAudits.forEach(a => {
      activityFeed.push({
        type: 'admin_action',
        message: `Admin ${a.adminEmail} ran action ${a.action} on ${a.target}.`,
        timestamp: a.timestamp
      });
    });

    activityFeed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const recentActivity = activityFeed.slice(0, 100);

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsersCount,
        archivedUsersCount,
        totalSessions,
        totalPosts,
        avgAtsScore,
        systemHealth: "Healthy",
        apiMetrics: {
          uptime: Math.round(process.uptime()),
          nodeVersion: process.version
        }
      },
      recentActivity
    });
  } catch (err) {
    console.error("GET admin stats error:", err);
    res.status(500).json({ error: "Server error compiling admin stats." });
  }
});

// GET: Paginated list of users
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const search = req.query.search ? req.query.search.toLowerCase().trim() : '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';

    let users = [];

    // Load users
    if (db) {
      try {
        const snapshot = await db.collection('users').get();
        snapshot.forEach(doc => {
          users.push({ email: doc.id, ...doc.data() });
        });
      } catch (e) {
        console.error("Firestore user query for admin failed:", e);
      }
    }
    const fallbackUsersPath = './db_users_fallback.json';
    if (fs.existsSync(fallbackUsersPath)) {
      try {
        const localUsers = JSON.parse(fs.readFileSync(fallbackUsersPath, 'utf8') || '[]');
        if (Array.isArray(localUsers)) {
          localUsers.forEach(lu => {
            if (!users.some(u => u.email.toLowerCase().trim() === lu.email.toLowerCase().trim())) {
              users.push(lu);
            }
          });
        }
      } catch (e) {}
    }

    users = users.map(u => {
      const email = u.email.toLowerCase().trim();
      const adminEmails = ["test@example.com", "admin@intervflow.com", "human@intervflow.com"];
      const isDevAdmin = adminEmails.includes(email);
      return {
        role: isDevAdmin ? 'ADMIN' : 'USER',
        isActive: true,
        ...u
      };
    });

    // Apply Search Filter
    if (search) {
      users = users.filter(u => 
        (u.name && u.name.toLowerCase().includes(search)) || 
        (u.email && u.email.toLowerCase().includes(search))
      );
    }

    // Apply Sorting
    users.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      // Handle null/undefined checks
      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string') {
        return sortOrder === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      } else {
        return sortOrder === 'asc' 
          ? valA - valB 
          : valB - valA;
      }
    });

    // Apply Pagination
    const totalCount = users.length;
    const totalPages = Math.ceil(totalCount / limit);
    const startIndex = (page - 1) * limit;
    const paginatedUsers = users.slice(startIndex, startIndex + limit);

    res.json({
      success: true,
      users: paginatedUsers,
      totalCount,
      totalPages,
      currentPage: page
    });
  } catch (err) {
    console.error("GET admin users pagination error:", err);
    res.status(500).json({ error: "Server error fetching paginated users list." });
  }
});

// POST: Create a new user account (admin-initiated)
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, domain, role, experienceYears, highestEducation, dreamCompany } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }
    const validRoles = ['USER', 'MODERATOR', 'ADMIN'];
    const assignedRole = validRoles.includes(role) ? role : 'USER';
    const sanitizedEmail = email.toLowerCase().trim();

    // Check if user already exists in DB
    const existing = await findUserByEmail(sanitizedEmail);
    if (existing) {
      return res.status(409).json({ error: `An account with email ${sanitizedEmail} already exists.` });
    }

    let firebaseUid = null;

    // Create user in Firebase Auth
    if (admin.apps.length > 0) {
      try {
        const firebaseUser = await admin.auth().createUser({
          email: sanitizedEmail,
          password,
          displayName: sanitizeString(name),
          emailVerified: true
        });
        firebaseUid = firebaseUser.uid;

        // Set custom claims for role
        await admin.auth().setCustomUserClaims(firebaseUid, { role: assignedRole });
        console.log(`[ADMIN CREATE] Created Firebase user ${sanitizedEmail} (uid: ${firebaseUid}) with role ${assignedRole}`);
      } catch (fbErr) {
        if (fbErr.code === 'auth/email-already-exists') {
          return res.status(409).json({ error: `A Firebase Auth account for ${sanitizedEmail} already exists. Use the existing account.` });
        }
        console.error("[ADMIN CREATE] Firebase Auth createUser failed:", fbErr.message);
        return res.status(500).json({ error: `Failed to create Firebase account: ${fbErr.message}` });
      }
    }

    // Save user record to Firestore/fallback
    const newUser = {
      email: sanitizedEmail,
      name: sanitizeString(name),
      domain: domain ? sanitizeString(domain) : 'swe',
      role: assignedRole,
      experienceYears: experienceYears ? sanitizeString(experienceYears) : '0 Yrs',
      highestEducation: highestEducation ? sanitizeString(highestEducation) : '',
      dreamCompany: dreamCompany ? sanitizeString(dreamCompany) : '',
      onboardingCompleted: true,
      isActive: true,
      bonusXp: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(firebaseUid ? { uid: firebaseUid } : {})
    };

    await saveUser(newUser);

    // Log admin action
    const clientIp = req.ip || req.socket.remoteAddress || '';
    await logAdminAction(req.adminEmail, "CREATE_USER", sanitizedEmail, { role: assignedRole }, clientIp);

    res.status(201).json({ success: true, user: newUser });
  } catch (err) {
    console.error("POST admin create user error:", err);
    res.status(500).json({ error: "Server error creating user account." });
  }
});

// GET: Fetch single candidate profile details by email
router.get('/users/:email', async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(400).json({ error: "User email param is required." });
    }
    const targetEmail = email.toLowerCase().trim();
    const user = await findUserByEmail(targetEmail);
    if (!user) {
      return res.status(404).json({ error: "Candidate profile not found." });
    }
    res.json({
      success: true,
      user
    });
  } catch (err) {
    console.error("GET admin user detail error:", err);
    res.status(500).json({ error: "Server error fetching candidate profile." });
  }
});

// PUT: Modify a user's details or role
router.put('/users/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const { name, domain, experienceYears, highestEducation, dreamCompany, role, isActive, bonusXp } = req.body;

    if (!email) {
      return res.status(400).json({ error: "User email param is required." });
    }

    const targetEmail = email.toLowerCase().trim();
    const user = await findUserByEmail(targetEmail);
    if (!user) {
      return res.status(404).json({ error: "Candidate profile not found." });
    }

    // Strictly validate inputs
    if (role && !['USER', 'MODERATOR', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: "Invalid role. Role must be USER, MODERATOR, or ADMIN." });
    }

    // Validate bonusXp
    let parsedBonusXp = user.bonusXp || 0;
    if (bonusXp !== undefined) {
      parsedBonusXp = parseInt(bonusXp, 10);
      if (isNaN(parsedBonusXp) || parsedBonusXp < 0) {
        return res.status(400).json({ error: "bonusXp must be a non-negative integer." });
      }
    }

    const updatedUser = {
      ...user,
      name: name ? sanitizeString(name) : user.name,
      domain: domain ? sanitizeString(domain) : user.domain,
      experienceYears: experienceYears !== undefined ? sanitizeString(experienceYears) : user.experienceYears,
      highestEducation: highestEducation !== undefined ? sanitizeString(highestEducation) : user.highestEducation,
      dreamCompany: dreamCompany !== undefined ? sanitizeString(dreamCompany) : user.dreamCompany,
      role: role || user.role || 'USER',
      isActive: isActive !== undefined ? !!isActive : (user.isActive !== undefined ? user.isActive : true),
      bonusXp: parsedBonusXp,
      updatedAt: new Date().toISOString()
    };

    // Save updated record
    await saveUser(updatedUser);

    // Sync Firebase Custom Claims on role change
    if (admin.apps.length > 0) {
      try {
        const firebaseUser = await admin.auth().getUserByEmail(targetEmail);
        await admin.auth().setCustomUserClaims(firebaseUser.uid, { role: updatedUser.role });
        console.log(`[ADMIN CLI] Synchronized Custom Claim {role: "${updatedUser.role}"} for user ${targetEmail}`);
      } catch (e) {
        console.warn(`[ADMIN CLI] Could not sync Firebase claims for ${targetEmail}:`, e.message);
      }
    }

    // Log admin audit action
    const clientIp = req.ip || req.socket.remoteAddress || '';
    await logAdminAction(
      req.adminEmail,
      "UPDATE_USER",
      targetEmail,
      { changedFields: { name: name !== undefined, role: role !== undefined, isActive: isActive !== undefined, bonusXp: bonusXp !== undefined } },
      clientIp
    );

    res.json({
      success: true,
      user: updatedUser
    });
  } catch (err) {
    console.error("PUT admin update user error:", err);
    res.status(500).json({ error: "Server error during candidate profile update." });
  }
});

// DELETE: Soft delete / toggle active state on a user
router.delete('/users/:email', async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(400).json({ error: "User email param is required." });
    }

    const targetEmail = email.toLowerCase().trim();
    const user = await findUserByEmail(targetEmail);
    if (!user) {
      return res.status(404).json({ error: "Candidate profile not found." });
    }

    // Soft delete: flip isActive status
    const previousStatus = user.isActive !== false;
    user.isActive = false; // Soft delete sets active status to false
    user.updatedAt = new Date().toISOString();

    await saveUser(user);

    // Log audit log
    const clientIp = req.ip || req.socket.remoteAddress || '';
    await logAdminAction(
      req.adminEmail,
      "SOFT_DELETE_USER",
      targetEmail,
      { previousStatus, newStatus: false },
      clientIp
    );

    res.json({
      success: true,
      message: `User ${targetEmail} soft-deleted successfully.`
    });
  } catch (err) {
    console.error("DELETE admin user soft delete failed:", err);
    res.status(500).json({ error: "Server error during soft deletion." });
  }
});

// GET: Fetch paginated completed sessions logs
router.get('/sessions', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const search = req.query.search ? req.query.search.toLowerCase().trim() : '';

    let sessions = [];
    const dbPath = './db_sessions_fallback.json';
    if (fs.existsSync(dbPath)) {
      try {
        sessions = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
      } catch (e) {}
    }
    if (db) {
      try {
        const snapshot = await db.collection('sessions').get();
        snapshot.forEach(doc => {
          const s = doc.data();
          if (!sessions.some(ls => ls.id === s.id)) {
            sessions.push(s);
          }
        });
      } catch (e) {}
    }

    // Apply Search Filter
    if (search) {
      sessions = sessions.filter(s => 
        (s.userEmail && s.userEmail.toLowerCase().includes(search)) || 
        (s.title && s.title.toLowerCase().includes(search)) || 
        (s.company && s.company.toLowerCase().includes(search))
      );
    }

    // Sort descending by completion time
    sessions.sort((a, b) => (b.completedAt || b.startTime || 0) - (a.completedAt || a.startTime || 0));

    const totalCount = sessions.length;
    const totalPages = Math.ceil(totalCount / limit);
    const startIndex = (page - 1) * limit;
    const paginatedSessions = sessions.slice(startIndex, startIndex + limit);

    res.json({
      success: true,
      sessions: paginatedSessions,
      totalCount,
      totalPages,
      currentPage: page
    });
  } catch (err) {
    console.error("GET admin sessions pagination error:", err);
    res.status(500).json({ error: "Server error fetching sessions logs." });
  }
});

// DELETE: Hide / remove session
router.delete('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "Session ID param is required." });
    }

    // 1. Delete from Firestore
    if (db) {
      try {
        await db.collection('sessions').doc(id).delete();
      } catch (e) {}
    }

    // 2. Delete from local file database
    const dbPath = './db_sessions_fallback.json';
    if (fs.existsSync(dbPath)) {
      try {
        let sessions = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
        sessions = sessions.filter(s => s.id !== id);
        fs.writeFileSync(dbPath, JSON.stringify(sessions, null, 2), 'utf8');
      } catch (e) {}
    }

    // Log audit log
    const clientIp = req.ip || req.socket.remoteAddress || '';
    await logAdminAction(req.adminEmail, "DELETE_SESSION", id, {}, clientIp);

    res.json({ success: true, message: `Session ${id} deleted successfully.` });
  } catch (err) {
    console.error("DELETE admin session error:", err);
    res.status(500).json({ error: "Server error deleting session." });
  }
});

// GET: Paginated community posts moderation query
router.get('/posts', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const search = req.query.search ? req.query.search.toLowerCase().trim() : '';

    let posts = [];
    const dbPath = './db_community_posts_fallback.json';
    if (fs.existsSync(dbPath)) {
      try {
        posts = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
      } catch (e) {}
    }

    if (search) {
      posts = posts.filter(p => 
        (p.title && p.title.toLowerCase().includes(search)) || 
        (p.description && p.description.toLowerCase().includes(search)) || 
        (p.author && p.author.toLowerCase().includes(search))
      );
    }

    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalCount = posts.length;
    const totalPages = Math.ceil(totalCount / limit);
    const startIndex = (page - 1) * limit;
    const paginatedPosts = posts.slice(startIndex, startIndex + limit);

    res.json({
      success: true,
      posts: paginatedPosts,
      totalCount,
      totalPages,
      currentPage: page
    });
  } catch (err) {
    console.error("GET admin posts pagination error:", err);
    res.status(500).json({ error: "Server error fetching forum posts." });
  }
});

// DELETE: Moderate and remove forum post
router.delete('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "Post ID param is required." });
    }

    const dbPath = './db_community_posts_fallback.json';
    let posts = [];
    if (fs.existsSync(dbPath)) {
      try {
        posts = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
      } catch (e) {}
    }

    const postExists = posts.some(p => p.id === id);
    if (!postExists) {
      return res.status(404).json({ error: "Post not found." });
    }

    posts = posts.filter(p => p.id !== id);
    fs.writeFileSync(dbPath, JSON.stringify(posts, null, 2), 'utf8');

    // Log audit log
    const clientIp = req.ip || req.socket.remoteAddress || '';
    await logAdminAction(req.adminEmail, "DELETE_POST", id, {}, clientIp);

    res.json({ success: true, message: `Post ${id} moderated and deleted successfully.` });
  } catch (err) {
    console.error("DELETE admin post error:", err);
    res.status(500).json({ error: "Server error moderating forum post." });
  }
});

// GET: System Config settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await getGlobalSettings();
    res.json({ success: true, settings });
  } catch (err) {
    console.error("GET admin settings error:", err);
    res.status(500).json({ error: "Server error fetching settings." });
  }
});

// POST: Save system configurations
router.post('/settings', async (req, res) => {
  try {
    const { maintenanceMode, globalXpMultiplier, defaultAiModel } = req.body;

    const previousSettings = await getGlobalSettings();
    const settings = {
      maintenanceMode: maintenanceMode !== undefined ? !!maintenanceMode : previousSettings.maintenanceMode,
      globalXpMultiplier: globalXpMultiplier !== undefined ? parseFloat(globalXpMultiplier) : previousSettings.globalXpMultiplier,
      defaultAiModel: defaultAiModel ? sanitizeString(defaultAiModel) : previousSettings.defaultAiModel
    };

    await saveGlobalSettings(settings);

    // Log audit log
    const clientIp = req.ip || req.socket.remoteAddress || '';
    await logAdminAction(
      req.adminEmail,
      "UPDATE_SETTINGS",
      "global_settings",
      { previousSettings, newSettings: settings },
      clientIp
    );

    res.json({ success: true, settings });
  } catch (err) {
    console.error("POST admin settings error:", err);
    res.status(500).json({ error: "Server error saving settings config." });
  }
});

// GET: Paginated Admin Audit Logs
router.get('/audit-logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const search = req.query.search ? req.query.search.toLowerCase().trim() : '';

    let logs = [];
    const logsPath = './db_admin_audit_logs_fallback.json';
    if (fs.existsSync(logsPath)) {
      try {
        logs = JSON.parse(fs.readFileSync(logsPath, 'utf8') || '[]');
      } catch (e) {}
    }
    if (db) {
      try {
        const snapshot = await db.collection('admin_audit_logs').get();
        snapshot.forEach(doc => {
          logs.push(doc.data());
        });
      } catch (e) {}
    }

    // Apply Search Filter
    if (search) {
      logs = logs.filter(l => 
        (l.adminEmail && l.adminEmail.toLowerCase().includes(search)) || 
        (l.action && l.action.toLowerCase().includes(search)) || 
        (l.target && l.target.toLowerCase().includes(search))
      );
    }

    // Sort descending by timestamp
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const totalCount = logs.length;
    const totalPages = Math.ceil(totalCount / limit);
    const startIndex = (page - 1) * limit;
    const paginatedLogs = logs.slice(startIndex, startIndex + limit);

    res.json({
      success: true,
      logs: paginatedLogs,
      totalCount,
      totalPages,
      currentPage: page
    });
  } catch (err) {
    console.error("GET admin audit logs error:", err);
    res.status(500).json({ error: "Server error fetching audit trail logs." });
  }
});

// POST: Trigger Secure Impersonation context for troubleshooting
router.post('/impersonate', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Target email is required for impersonation." });
    }

    const targetEmail = email.toLowerCase().trim();
    const targetUser = await findUserByEmail(targetEmail);
    if (!targetUser) {
      return res.status(404).json({ error: "Candidate profile not found." });
    }

    // Log audit log
    const clientIp = req.ip || req.socket.remoteAddress || '';
    await logAdminAction(
      req.adminEmail,
      "IMPERSONATION_START",
      targetEmail,
      { candidateEmail: targetEmail },
      clientIp
    );

    res.json({
      success: true,
      impersonatedUser: {
        name: targetUser.name,
        email: targetUser.email,
        domain: targetUser.domain,
        onboardingCompleted: targetUser.onboardingCompleted,
        experienceYears: targetUser.experienceYears || '',
        highestEducation: targetUser.highestEducation || '',
        dreamCompany: targetUser.dreamCompany || ''
      }
    });
  } catch (err) {
    console.error("POST impersonation trigger failed:", err);
    res.status(500).json({ error: "Server error initializing impersonation session." });
  }
});

// GET: Fetch pending recruiter upgrade requests
router.get('/recruiter/requests', async (req, res) => {
  try {
    const requests = await getUpgradeRequests();
    res.json({ success: true, requests });
  } catch (err) {
    console.error("GET recruiter requests failed:", err);
    res.status(500).json({ error: "Server error fetching recruiter requests." });
  }
});

// POST: Approve or reject recruiter upgrade request
router.post('/recruiter/approve', async (req, res) => {
  try {
    const { email, status } = req.body; // status: 'approved' | 'rejected'
    if (!email || !status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: "Email and valid status ('approved' | 'rejected') are required." });
    }

    const targetEmail = email.toLowerCase().trim();
    
    // Update upgrade request status
    await updateUpgradeRequestStatus(targetEmail, status);

    if (status === 'approved') {
      // Fetch user profile and update role
      const user = await findUserByEmail(targetEmail);
      if (user) {
        user.role = 'RECRUITER';
        user.updatedAt = new Date().toISOString();
        await saveUser(user);

        // Sync Firebase Custom Claims
        if (admin.apps.length > 0) {
          try {
            const firebaseUser = await admin.auth().getUserByEmail(targetEmail);
            await admin.auth().setCustomUserClaims(firebaseUser.uid, { role: 'RECRUITER' });
            console.log(`[ADMIN APPROVE] Set role RECRUITER for user ${targetEmail}`);
          } catch (e) {
            console.warn(`[ADMIN APPROVE] Failed to set Custom Claims for ${targetEmail}:`, e.message);
          }
        }
      }
    }

    // Log admin action
    const clientIp = req.ip || req.socket.remoteAddress || '';
    await logAdminAction(req.adminEmail, "RECRUITER_APPROVAL", targetEmail, { status }, clientIp);

    res.json({ success: true, message: `Recruiter request ${status} successfully for ${targetEmail}.` });
  } catch (err) {
    console.error("POST recruiter approve failed:", err);
    res.status(500).json({ error: "Server error during recruiter request approval." });
  }
});

export default router;
