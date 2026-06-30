import fs from 'fs';
import { db, admin } from '../config/db.js';

// Database save helper for resume analyses
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

// Chatbot usage save helper
const saveChatUsage = async (email) => {
  if (!email) return;
  const record = {
    userEmail: email.toLowerCase().trim(),
    createdAt: new Date().toISOString()
  };

  if (db) {
    try {
      await db.collection('chatbot_usage').add(record);
      console.log(`Saved chatbot usage to Firestore for ${email}`);
      return;
    } catch (err) {
      console.error("Firestore chatbot usage write failed:", err);
    }
  }

  try {
    const dbPath = './db_chatbot_usage_fallback.json';
    let records = [];
    if (fs.existsSync(dbPath)) {
      try {
        records = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
      } catch (e) {
        records = [];
      }
    }
    if (!Array.isArray(records)) {
      records = [];
    }
    records.push(record);
    fs.writeFileSync(dbPath, JSON.stringify(records, null, 2), 'utf8');
    console.log(`Saved chatbot usage locally for ${email}`);
  } catch (e) {
    console.error("Local chatbot usage save failed:", e);
  }
};

// User lookup helper
const findUserByEmail = async (email) => {
  const sanitizedEmail = email.toLowerCase().trim();
  let userRecord = null;
  if (db) {
    try {
      const userDoc = await db.collection('users').doc(sanitizedEmail).get();
      if (userDoc.exists) {
        userRecord = { email: sanitizedEmail, ...userDoc.data() };
      }
    } catch (err) {
      console.error("Firestore user fetch failed, falling back to local file:", err);
    }
  }

  if (!userRecord) {
    try {
      const fallbackPath = './db_users_fallback.json';
      if (fs.existsSync(fallbackPath)) {
        const users = JSON.parse(fs.readFileSync(fallbackPath, 'utf8') || '[]');
        userRecord = users.find(u => u.email === sanitizedEmail) || null;
      }
    } catch (err) {
      console.error("Local user fetch fallback failed:", err);
    }
  }

  if (userRecord) {
    if (!userRecord.role) {
      const adminEmails = ["test@example.com", "admin@intervflow.com"];
      const isDevAdmin = adminEmails.includes(sanitizedEmail);
      userRecord.role = isDevAdmin ? 'ADMIN' : 'USER';
    }
    if (userRecord.isActive === undefined) {
      userRecord.isActive = true;
    }
  }

  return userRecord;
};

// User save helper
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

// Global System Settings helper functions
const getGlobalSettings = async () => {
  const defaultSettings = {
    maintenanceMode: false,
    globalXpMultiplier: 1.0,
    defaultAiModel: 'gpt-4o'
  };

  if (db) {
    try {
      const doc = await db.collection('system_settings').doc('global').get();
      if (doc.exists) {
        return { ...defaultSettings, ...doc.data() };
      }
      await db.collection('system_settings').doc('global').set(defaultSettings);
      return defaultSettings;
    } catch (err) {
      console.error("Firestore get settings failed, falling back to local file:", err);
    }
  }

  try {
    const settingsPath = './db_system_settings.json';
    if (fs.existsSync(settingsPath)) {
      return { ...defaultSettings, ...JSON.parse(fs.readFileSync(settingsPath, 'utf8') || '{}') };
    }
    fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2), 'utf8');
    return defaultSettings;
  } catch (err) {
    console.error("Local settings load failed:", err);
  }
  return defaultSettings;
};

const saveGlobalSettings = async (settings) => {
  if (db) {
    try {
      await db.collection('system_settings').doc('global').set(settings, { merge: true });
      return true;
    } catch (err) {
      console.error("Firestore save settings failed:", err);
    }
  }

  try {
    const settingsPath = './db_system_settings.json';
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error("Local settings save failed:", err);
  }
  return false;
};

// Admin Audit Logging helper
const logAdminAction = async (adminEmail, action, target, details = {}, ip = '') => {
  const logEntry = {
    adminEmail,
    action,
    target,
    details,
    ip,
    timestamp: new Date().toISOString()
  };

  if (db) {
    try {
      await db.collection('admin_audit_logs').add(logEntry);
      console.log(`[AUDIT] Logged action ${action} by ${adminEmail} to Firestore.`);
      return true;
    } catch (e) {
      console.error("Firestore audit log error:", e);
    }
  }

  try {
    const logsPath = './db_admin_audit_logs_fallback.json';
    let logs = [];
    if (fs.existsSync(logsPath)) {
      logs = JSON.parse(fs.readFileSync(logsPath, 'utf8') || '[]');
    }
    logs.push(logEntry);
    fs.writeFileSync(logsPath, JSON.stringify(logs, null, 2), 'utf8');
    console.log(`[AUDIT] Logged action ${action} by ${adminEmail} to fallback file database.`);
    return true;
  } catch (err) {
    console.error("Fallback audit log save failed:", err);
  }
  return false;
};

// Database migration & Custom Claims sync on startup
const migrateDatabaseOnStartup = async () => {
  console.log("Running database migrations & Firebase Custom Claims sync...");
  const adminEmails = ["test@example.com", "admin@intervflow.com", "human@intervflow.com"];

  if (db) {
    try {
      const usersRef = db.collection('users');
      const snapshot = await usersRef.get();
      const batch = db.batch();
      let updatedCount = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const email = doc.id.toLowerCase().trim();
        let changed = false;
        let updateData = {};

        const isDevAdmin = adminEmails.includes(email);
        const expectedRole = isDevAdmin ? 'ADMIN' : (data.role || 'USER');

        if (data.role !== expectedRole) {
          updateData.role = expectedRole;
          changed = true;
        }
        if (data.isActive === undefined) {
          updateData.isActive = true;
          changed = true;
        }

        if (changed) {
          batch.set(doc.ref, updateData, { merge: true });
          updatedCount++;
        }

        if (admin.apps.length > 0) {
          try {
            const userRecord = await admin.auth().getUserByEmail(email);
            const currentClaims = userRecord.customClaims || {};
            if (currentClaims.role !== expectedRole) {
              await admin.auth().setCustomUserClaims(userRecord.uid, { role: expectedRole });
              console.log(`Synchronized Firebase Custom Claim {role: "${expectedRole}"} for user ${email}`);
            }
          } catch (e) {
            console.warn(`Could not sync Firebase custom claims for ${email}:`, e.message);
          }
        }
      }

      if (updatedCount > 0) {
        await batch.commit();
        console.log(`Successfully migrated ${updatedCount} user documents in Firestore.`);
      } else {
        console.log("Firestore users database is up to date.");
      }
    } catch (err) {
      console.error("Failed to run Firestore user migrations:", err);
    }
  } else {
    try {
      const fallbackPath = './db_users_fallback.json';
      if (fs.existsSync(fallbackPath)) {
        let users = JSON.parse(fs.readFileSync(fallbackPath, 'utf8') || '[]');
        let changed = false;

        users = users.map(u => {
          let updated = { ...u };
          const email = u.email.toLowerCase().trim();
          const isDevAdmin = adminEmails.includes(email);
          const expectedRole = isDevAdmin ? 'ADMIN' : (u.role || 'USER');

          if (updated.role !== expectedRole) {
            updated.role = expectedRole;
            changed = true;
          }
          if (updated.isActive === undefined) {
            updated.isActive = true;
            changed = true;
          }
          return updated;
        });

        if (changed) {
          fs.writeFileSync(fallbackPath, JSON.stringify(users, null, 2), 'utf8');
          console.log("Successfully migrated fallback file database users.");
        } else {
          console.log("Fallback file database users are up to date.");
        }
      }
    } catch (err) {
      console.error("Failed to run fallback database user migrations:", err);
    }
  }
};

// Save session record to database
const saveSessionToDatabase = async (session) => {
  const sessionRecord = {
    id: session.id,
    userEmail: session.userEmail || null,
    jdId: session.jdId || null,
    mode: session.mode,
    title: session.title,
    company: session.company,
    durationMinutes: session.durationMinutes,
    startTime: session.startTime,
    transcript: session.transcript,
    report: session.report || null,
    completedAt: Date.now()
  };

  if (db) {
    try {
      await db.collection('sessions').doc(session.id).set(sessionRecord);
      console.log(`Session ${session.id} successfully saved to Firestore.`);
    } catch (e) {
      console.error("Firestore session save error:", e);
    }
  }

  try {
    const dbPath = './db_sessions_fallback.json';
    let sessions = [];
    if (fs.existsSync(dbPath)) {
      try {
        sessions = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
      } catch (e) {
        sessions = [];
      }
    }
    if (!Array.isArray(sessions)) {
      sessions = [];
    }
    const idx = sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      sessions[idx] = sessionRecord;
    } else {
      sessions.push(sessionRecord);
    }
    fs.writeFileSync(dbPath, JSON.stringify(sessions, null, 2), 'utf8');
    console.log(`Session ${session.id} successfully saved to fallback file database.`);
  } catch (e) {
    console.error("Failed to save session record to local file:", e);
  }
};

// Recruiter upgrade requests db helpers
const saveUpgradeRequest = async (email, userName) => {
  const record = {
    email: email.toLowerCase().trim(),
    userName,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  if (db) {
    try {
      await db.collection('upgrade_requests').doc(record.email).set(record);
      return true;
    } catch (e) {
      console.error("Firestore saveUpgradeRequest error:", e);
    }
  }

  try {
    const dbPath = './db_upgrade_requests_fallback.json';
    let requests = [];
    if (fs.existsSync(dbPath)) {
      requests = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
    }
    const idx = requests.findIndex(r => r.email === record.email);
    if (idx >= 0) {
      requests[idx] = record;
    } else {
      requests.push(record);
    }
    fs.writeFileSync(dbPath, JSON.stringify(requests, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error("Fallback saveUpgradeRequest error:", e);
  }
  return false;
};

const getUpgradeRequests = async () => {
  let requests = [];
  if (db) {
    try {
      const snapshot = await db.collection('upgrade_requests').get();
      snapshot.forEach(doc => requests.push(doc.data()));
      return requests;
    } catch (e) {
      console.error("Firestore getUpgradeRequests error:", e);
    }
  }

  try {
    const dbPath = './db_upgrade_requests_fallback.json';
    if (fs.existsSync(dbPath)) {
      requests = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
    }
  } catch (e) {
    console.error("Fallback getUpgradeRequests error:", e);
  }
  return requests;
};

const updateUpgradeRequestStatus = async (email, status) => {
  const cleanEmail = email.toLowerCase().trim();
  if (db) {
    try {
      await db.collection('upgrade_requests').doc(cleanEmail).update({ status });
    } catch (e) {
      console.error("Firestore updateUpgradeRequestStatus error:", e);
    }
  }

  try {
    const dbPath = './db_upgrade_requests_fallback.json';
    if (fs.existsSync(dbPath)) {
      let requests = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
      const idx = requests.findIndex(r => r.email === cleanEmail);
      if (idx >= 0) {
        requests[idx].status = status;
        fs.writeFileSync(dbPath, JSON.stringify(requests, null, 2), 'utf8');
      }
    }
    return true;
  } catch (e) {
    console.error("Fallback updateUpgradeRequestStatus error:", e);
  }
  return false;
};

// Job description db helpers
const saveJobDescription = async (jdData) => {
  const id = jdData.id || `jd_${Date.now()}`;
  const record = {
    id,
    ...jdData,
    createdAt: new Date().toISOString()
  };

  if (db) {
    try {
      await db.collection('jds').doc(id).set(record);
      return id;
    } catch (e) {
      console.error("Firestore saveJobDescription error:", e);
    }
  }

  try {
    const dbPath = './db_jds_fallback.json';
    let jds = [];
    if (fs.existsSync(dbPath)) {
      jds = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
    }
    jds.push(record);
    fs.writeFileSync(dbPath, JSON.stringify(jds, null, 2), 'utf8');
    return id;
  } catch (e) {
    console.error("Fallback saveJobDescription error:", e);
  }
  return null;
};

const getJobDescriptions = async () => {
  let jds = [];
  if (db) {
    try {
      const snapshot = await db.collection('jds').get();
      snapshot.forEach(doc => jds.push(doc.data()));
      return jds;
    } catch (e) {
      console.error("Firestore getJobDescriptions error:", e);
    }
  }

  try {
    const dbPath = './db_jds_fallback.json';
    if (fs.existsSync(dbPath)) {
      jds = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
    }
  } catch (e) {
    console.error("Fallback getJobDescriptions error:", e);
  }
  return jds;
};

const getSessionsByJdId = async (jdId) => {
  let sessions = [];
  if (db) {
    try {
      const snapshot = await db.collection('sessions').where('jdId', '==', jdId).get();
      snapshot.forEach(doc => sessions.push(doc.data()));
      return sessions;
    } catch (e) {
      console.error("Firestore getSessionsByJdId error:", e);
    }
  }

  try {
    const dbPath = './db_sessions_fallback.json';
    if (fs.existsSync(dbPath)) {
      const allSessions = JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
      sessions = allSessions.filter(s => s.jdId === jdId);
    }
  } catch (e) {
    console.error("Fallback getSessionsByJdId error:", e);
  }
  return sessions;
};

export {
  saveAnalysis,
  saveChatUsage,
  findUserByEmail,
  saveUser,
  getGlobalSettings,
  saveGlobalSettings,
  logAdminAction,
  migrateDatabaseOnStartup,
  saveSessionToDatabase,
  saveUpgradeRequest,
  getUpgradeRequests,
  updateUpgradeRequestStatus,
  saveJobDescription,
  getJobDescriptions,
  getSessionsByJdId
};
