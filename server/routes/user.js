import express from 'express';
import fs from 'fs';
import { db } from '../config/db.js';
import { findUserByEmail, saveUser } from '../helpers/dbHelpers.js';

const router = express.Router();

// POST: Update candidate profile parameters
router.post('/profile/update', async (req, res) => {
  try {
    const { email, name, domain, experienceYears, highestEducation, dreamCompany, linkedinUrl, githubUrl } = req.body;
    if (!email) {
      return res.status(400).json({ error: "User email is required." });
    }

    const sanitizedEmail = email.toLowerCase().trim();
    const user = await findUserByEmail(sanitizedEmail);
    if (!user) {
      return res.status(404).json({ error: "User account not found." });
    }

    const updatedFields = {
      ...user,
      name: name || user.name,
      domain: domain || user.domain,
      experienceYears: experienceYears || '',
      highestEducation: highestEducation || '',
      dreamCompany: dreamCompany || '',
      linkedinUrl: linkedinUrl || '',
      githubUrl: githubUrl || '',
      updatedAt: new Date().toISOString()
    };

    const saved = await saveUser(updatedFields);
    if (!saved) {
      return res.status(500).json({ error: "Failed to update profile settings in database." });
    }

    res.json({
      success: true,
      user: {
        name: updatedFields.name,
        email: updatedFields.email,
        domain: updatedFields.domain,
        role: updatedFields.role,
        onboardingCompleted: updatedFields.onboardingCompleted,
        experienceYears: updatedFields.experienceYears,
        highestEducation: updatedFields.highestEducation,
        dreamCompany: updatedFields.dreamCompany,
        linkedinUrl: updatedFields.linkedinUrl,
        githubUrl: updatedFields.githubUrl
      }
    });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Server error during profile update." });
  }
});

// DELETE: GDPR Account scrubbing routine
router.delete('/account', async (req, res) => {
  try {
    const email = req.body.email || req.query.email;
    if (!email) {
      return res.status(400).json({ error: "User email is required for account deletion." });
    }

    const sanitizedEmail = email.toLowerCase().trim();

    // 1. Delete user from Firestore/fallback
    if (db) {
      try {
        await db.collection('users').doc(sanitizedEmail).delete();
        console.log(`Deleted user ${sanitizedEmail} from Firestore.`);
      } catch (e) {
        console.error("Firestore user delete error:", e);
      }
    }
    
    const usersPath = './db_users_fallback.json';
    if (fs.existsSync(usersPath)) {
      try {
        let users = JSON.parse(fs.readFileSync(usersPath, 'utf8') || '[]');
        users = users.filter(u => u.email.toLowerCase().trim() !== sanitizedEmail);
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
        console.log(`Deleted user ${sanitizedEmail} from fallback file database.`);
      } catch (e) {
        console.error("Fallback users delete error:", e);
      }
    }

    // 2. Delete user's mock sessions
    const sessionsPath = './db_sessions_fallback.json';
    if (fs.existsSync(sessionsPath)) {
      try {
        let sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8') || '[]');
        sessions = sessions.filter(s => !s.userEmail || s.userEmail.toLowerCase().trim() !== sanitizedEmail);
        fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2), 'utf8');
        console.log(`Deleted sessions for user ${sanitizedEmail} from fallback file database.`);
      } catch (e) {
        console.error("Fallback sessions delete error:", e);
      }
    }

    // 3. Delete user's resume analyses
    if (db) {
      try {
        const snapshot = await db.collection('resume_analyses').where('userEmail', '==', sanitizedEmail).get();
        const batch = db.batch();
        snapshot.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Deleted resume analyses for user ${sanitizedEmail} from Firestore.`);
      } catch (e) {
        console.error("Firestore analyses delete error:", e);
      }
    }
    
    const analysesPath = './db_fallback.json';
    if (fs.existsSync(analysesPath)) {
      try {
        let records = JSON.parse(fs.readFileSync(analysesPath, 'utf8') || '[]');
        records = records.filter(r => !r.userEmail || r.userEmail.toLowerCase().trim() !== sanitizedEmail);
        fs.writeFileSync(analysesPath, JSON.stringify(records, null, 2), 'utf8');
        console.log(`Deleted analyses for user ${sanitizedEmail} from fallback file database.`);
      } catch (e) {
        console.error("Fallback analyses delete error:", e);
      }
    }

    res.json({ success: true, message: "Account and associated data deleted successfully." });
  } catch (err) {
    console.error("Account deletion error:", err);
    res.status(500).json({ error: "Server error during account deletion." });
  }
});

export default router;
